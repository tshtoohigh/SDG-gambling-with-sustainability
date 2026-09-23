/* ==========================================================================
   Second Spin — account model
   --------------------------------------------------------------------------
   Owns everything that persists for a signed-in visitor: their sealed boxes,
   the real draw when a box is opened, the vault of items they've kept, home
   delivery requests, sell-back, and store credit.

   ⚠️  PROTOTYPE STORAGE. All of this lives in localStorage, in the visitor's
   own browser. There is no server, no database and no authentication — signing
   in is an email address and nothing else. Consequences, stated plainly
   because the UI states them too:

     - Data is per-browser. Clear site data and it is gone. It does not follow
       you to another device.
     - There is no password. Anyone using this browser is "you".
     - THE DRAW CAN BE TAMPERED WITH. It resolves client-side, so anyone with
       devtools can hand themselves a Vintage Rare.

   The last point is the one that matters, and it is why `resolveDraw()` below
   is deliberately the only place randomness happens. In production that
   function becomes a single POST to a server that owns the RNG, writes an
   audit row, and returns a signed result — and nothing else in this file or
   the UI has to change, because everything downstream already treats the
   result as opaque.
   ========================================================================== */

const ACCOUNT_KEY = 'secondspin.account.v1';

/**
 * Store credit paid when a visitor sells a piece back to us.
 *
 * Deliberately well below the resale bands in site-data.js — we have to
 * re-grade, re-photograph, re-list and re-ship anything that comes back.
 * Selling back is always worse value than keeping or wearing the piece, and
 * the UI says so. It exists so nothing gets binned, not as an investment.
 *
 * Credit is STORE CREDIT ONLY: never cash, never withdrawable, never
 * transferable. That is load-bearing for the claim on faq.html that this is
 * not gambling — there is no cash-out.
 */
const BUYBACK = {
  rare: 28,
  designer: 18,
  statement: 10,
  seasonal: 6,
  everyday: 3,
};

const Account = (() => {
  const listeners = [];

  function blank() {
    return {
      email: null,
      createdAt: null,
      credit: 0,
      boxes: [],       // { id, tierId, purchasedAt, status: 'sealed'|'opened', openedAt }
      items: [],       // { uid, itemId, rarity, slot, boxId, status, acquiredAt, soldFor }
      deliveries: [],  // { id, itemUids, requestedAt, status }
      ledger: [],      // { at, type, amount, note }
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return blank();
      return Object.assign(blank(), JSON.parse(raw));
    } catch {
      return blank();
    }
  }

  function save() {
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state)); }
    catch { /* private mode — session-only */ }
    listeners.forEach((fn) => fn(state));
  }

  const onChange = (fn) => { listeners.push(fn); fn(state); };
  const get = () => state;
  const isSignedIn = () => Boolean(state.email);

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function note(type, amount, text) {
    state.ledger.unshift({ at: Date.now(), type, amount, note: text });
    state.ledger = state.ledger.slice(0, 60);
  }

  /* ------------------------------------------------------------- sign in/out */

  function signIn(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return { ok: false, error: 'That email address does not look right.' };
    if (state.email && state.email !== clean) state = blank();   // different person, fresh slate
    if (!state.email) {
      state.email = clean;
      state.createdAt = Date.now();
      note('account', 0, 'Account created');
    }
    save();
    return { ok: true };
  }

  function signOut() {
    /* Sign-out only forgets the session pointer; the data stays so signing
       back in with the same address restores the vault. */
    state.email = null;
    save();
  }

  function deleteEverything() {
    state = blank();
    try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* ignore */ }
    save();
  }

  /* ---------------------------------------------------------------- purchase */

  /** Called at checkout. Boxes arrive sealed and unopened. */
  function addBoxes(lines) {
    const added = [];
    lines.forEach(({ tierId, qty }) => {
      const tier = TIER_BY_ID[tierId];
      if (!tier) return;
      for (let i = 0; i < qty; i++) {
        const box = { id: uid('box'), tierId, purchasedAt: Date.now(), status: 'sealed' };
        state.boxes.push(box);
        added.push(box);
      }
    });
    const total = lines.reduce((n, l) => n + (TIER_BY_ID[l.tierId]?.price || 0) * l.qty, 0);
    note('purchase', -total, `${added.length} box${added.length === 1 ? '' : 'es'} purchased`);
    save();
    return added;
  }

  /** Apply store credit to an order. Returns how much was actually used. */
  function spendCredit(amount) {
    const used = Math.min(state.credit, Math.max(0, amount));
    if (used > 0) {
      state.credit = Math.round((state.credit - used) * 100) / 100;
      note('credit-spent', -used, 'Store credit applied to an order');
      save();
    }
    return used;
  }

  /* ================================================================= THE DRAW
     The ONLY place randomness happens. Replace the body with a server call and
     the rest of the app is unaffected — see the file header.
     ====================================================================== */
  function resolveDraw(tier) {
    const results = [];
    for (let i = 0; i < tier.featureSlots; i++) {
      results.push({ slot: 'feature', rarity: drawRarity(tier.odds, RARITY_ORDER) });
    }
    for (let i = 0; i < tier.everydaySlots; i++) {
      results.push({ slot: 'staple', rarity: 'everyday' });
    }
    return results;
  }

  /** Pick a concrete catalogue garment for a drawn rarity. */
  function pickArt(rarity) {
    if (typeof ITEM_CATALOG === 'undefined') return null;
    const options = ITEM_CATALOG.filter((i) => i.rarity === rarity);
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  /**
   * Open a sealed box for real. Resolves the draw, writes the items into the
   * vault, and marks the box opened. Idempotent: a box can only be opened once.
   */
  function openBox(boxId) {
    const box = state.boxes.find((b) => b.id === boxId);
    if (!box || box.status !== 'sealed') return null;
    const tier = TIER_BY_ID[box.tierId];
    if (!tier) return null;

    const drawn = resolveDraw(tier).map((d, i) => {
      const art = pickArt(d.rarity);
      return {
        uid: `${box.id}-${i}`,
        itemId: art ? art.id : null,
        rarity: d.rarity,
        slot: d.slot,
        boxId: box.id,
        status: 'vault',
        acquiredAt: Date.now(),
        soldFor: null,
      };
    });

    box.status = 'opened';
    box.openedAt = Date.now();
    state.items.push(...drawn);

    const features = drawn.filter((d) => d.slot === 'feature');
    note('open', 0,
      `${tier.name} opened — ${features.map((f) => RARITIES[f.rarity].label).join(', ')}`);
    save();
    return { box, items: drawn, features };
  }

  /* ------------------------------------------------------------------- vault */

  const sealedBoxes = () => state.boxes.filter((b) => b.status === 'sealed');
  const openedBoxes = () => state.boxes.filter((b) => b.status === 'opened');
  const vaultItems = () => state.items.filter((i) => i.status === 'vault');
  const soldItems = () => state.items.filter((i) => i.status === 'sold');
  const deliveryItems = () => state.items.filter((i) => i.status === 'delivery_requested');

  /** Catalogue record for a vault item, or null if the catalogue isn't loaded. */
  function art(item) {
    if (typeof ITEM_CATALOG === 'undefined' || !item.itemId) return null;
    return ITEM_CATALOG.find((c) => c.id === item.itemId) || null;
  }

  const buybackValue = (item) => BUYBACK[item.rarity] || 0;

  /** Sell pieces back to us for store credit. */
  function sellBack(uids) {
    let gained = 0;
    const labels = [];
    uids.forEach((u) => {
      const item = state.items.find((i) => i.uid === u && i.status === 'vault');
      if (!item) return;
      const value = buybackValue(item);
      item.status = 'sold';
      item.soldFor = value;
      gained += value;
      labels.push(RARITIES[item.rarity].label);
    });
    if (!gained) return 0;
    state.credit = Math.round((state.credit + gained) * 100) / 100;
    note('sell-back', gained,
      `Sold back ${labels.length} piece${labels.length === 1 ? '' : 's'} (${labels.join(', ')}) — re-circulated, not binned`);
    save();
    return gained;
  }

  /** Request home delivery of pieces kept in the vault. */
  function requestDelivery(uids) {
    const picked = uids.filter((u) =>
      state.items.some((i) => i.uid === u && i.status === 'vault'));
    if (!picked.length) return null;
    picked.forEach((u) => {
      state.items.find((i) => i.uid === u).status = 'delivery_requested';
    });
    const req = {
      id: uid('dlv'),
      itemUids: picked,
      requestedAt: Date.now(),
      status: 'preparing',
    };
    state.deliveries.unshift(req);
    note('delivery', 0,
      `Delivery requested for ${picked.length} piece${picked.length === 1 ? '' : 's'}`);
    save();
    return req;
  }

  /** Total weight the visitor has personally kept in circulation. */
  function lbsRescued() {
    return state.boxes
      .filter((b) => b.status === 'opened')
      .reduce((n, b) => n + (TIER_BY_ID[b.tierId]?.avgWeightLbs || 0), 0);
  }

  return {
    onChange, get, isSignedIn, signIn, signOut, deleteEverything,
    addBoxes, spendCredit, openBox,
    sealedBoxes, openedBoxes, vaultItems, soldItems, deliveryItems,
    art, buybackValue, sellBack, requestDelivery, lbsRescued,
    BUYBACK,
  };
})();

if (typeof window !== 'undefined') {
  window.Account = Account;
  window.BUYBACK = BUYBACK;
}
