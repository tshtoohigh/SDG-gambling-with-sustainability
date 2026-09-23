/* ==========================================================================
   Second Spin — account UI (My Vault)
   --------------------------------------------------------------------------
   Renders the signed-in experience: sealed boxes waiting to be opened, the
   live open (driven through the same reel component the marketing pages use),
   the vault of kept pieces, home delivery, sell-back and the credit ledger.

   Every figure shown here comes from account.js or site-data.js. The UI never
   computes odds of its own.
   ========================================================================== */

(function initAccountUI() {
  const root = document.querySelector('[data-account-page]');

  /* ---------------------------------------------------- header account chip */
  function renderHeader() {
    document.querySelectorAll('[data-account-chip]').forEach((el) => {
      const s = Account.get();
      if (!Account.isSignedIn()) {
        el.innerHTML = '<a class="btn btn--ghost btn--sm" href="account.html">Sign in</a>';
        return;
      }
      const sealed = Account.sealedBoxes().length;
      el.innerHTML = `
        <a class="btn btn--ghost btn--sm cart-btn" href="account.html" aria-label="Your vault">
          ${icon('box')}
          <span>Vault</span>
          ${sealed ? `<span class="cart-btn__count is-visible">${sealed}</span>` : ''}
        </a>`;
    });
  }

  if (!root) {
    Bus.on(renderHeader);          // header chip only, on every other page
    return;
  }

  /* ------------------------------------------------------------- formatting */
  const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
  const when = (ts) => new Date(ts).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' });

  function itemTile(item, { selectable = false } = {}) {
    const a = Account.art(item);
    const r = RARITIES[item.rarity];
    return `
      <figure class="item-tile" data-uid="${item.uid}">
        ${selectable ? `<label class="vault-pick">
          <input type="checkbox" data-pick="${item.uid}"> <span>Select</span>
        </label>` : ''}
        <div class="item-tile__frame" data-rarity="${item.rarity}">
          ${a ? `<img class="item-tile__img" src="${a.file}" width="96" height="96"
                 alt="Pixel-art illustration of a ${a.colourway.toLowerCase()} ${a.typeLabel.toLowerCase()}"
                 loading="lazy" decoding="async">` : ''}
        </div>
        <figcaption class="item-tile__name">${a ? a.name : r.label}</figcaption>
        <p class="item-tile__meta">
          ${item.slot === 'feature' ? 'Feature slot' : 'Everyday staple'}
          &middot; ${when(item.acquiredAt)}
        </p>
        <p class="item-tile__tag">
          <span class="chip" data-rarity="${item.rarity}">
            <span class="dot" data-rarity="${item.rarity}" style="background:${r.color}"></span>${r.label}
          </span>
        </p>
        ${item.status === 'vault'
          ? `<p class="item-tile__meta">Sell-back value <b>${money(Account.buybackValue(item))}</b></p>`
          : item.status === 'sold'
            ? `<p class="item-tile__meta">Sold back for <b>${money(item.soldFor)}</b></p>`
            : '<p class="item-tile__meta"><b>Delivery requested</b></p>'}
      </figure>`;
  }

  /* ------------------------------------------------------------------ render */
  function render() {
    const s = Account.get();

    /* ---- signed out ---- */
    if (!Account.isSignedIn()) {
      root.innerHTML = `
        <div class="card" style="max-width:520px;margin-inline:auto">
          <p class="eyebrow">Your vault</p>
          <h2 style="font-size:var(--t-xl)">Sign in to see your boxes</h2>
          <p class="muted">
            Boxes you buy arrive here sealed. You open them when you're ready, keep what
            you want, and either have it delivered or sell it back for store credit.
          </p>
          <form data-signin class="stack" style="margin-top:var(--sp-5)">
            <label class="eyebrow" for="acct-email" style="display:block">Email address</label>
            <input id="acct-email" type="email" required placeholder="you@example.com"
                   autocomplete="email"
                   style="width:100%;padding:0.7em 1em;border:2px solid var(--ink);border-radius:var(--r-pill)">
            <button class="btn btn--berry btn--block" type="submit">Sign in</button>
            <p class="form-msg" data-signin-msg role="status"></p>
          </form>
          <p class="sim-note" style="margin-top:var(--sp-5)">
            ${icon('warning')}
            <span>
              <b>Prototype account, and we won't pretend otherwise.</b> There is no server
              and no password &mdash; your vault is stored in this browser only. It won't
              follow you to another device, clearing site data erases it, and anyone using
              this browser is you. See <a href="faq.html#accounts">how accounts work</a>.
            </span>
          </p>
        </div>`;
      return;
    }

    const sealed = Account.sealedBoxes();
    const vault = Account.vaultItems();
    const sold = Account.soldItems();
    const out = Account.deliveryItems();

    root.innerHTML = `
      <!-- summary -->
      <div class="vault-summary" role="status" aria-live="polite">
        <div class="stat">
          <span class="stat__value">${sealed.length}</span>
          <span class="stat__label">sealed boxes</span>
        </div>
        <div class="stat">
          <span class="stat__value">${vault.length}</span>
          <span class="stat__label">pieces in vault</span>
        </div>
        <div class="stat">
          <span class="stat__value">${money(s.credit)}</span>
          <span class="stat__label">store credit</span>
        </div>
        <div class="stat">
          <span class="stat__value">${Account.lbsRescued().toFixed(1)}</span>
          <span class="stat__label">lbs you've rescued</span>
        </div>
      </div>
      <p class="muted" style="margin:var(--sp-3) 0 var(--sp-6)">
        Signed in as <b>${s.email}</b> &middot;
        <button class="link-btn" type="button" data-signout>Sign out</button> &middot;
        <button class="link-btn" type="button" data-wipe>Delete my data</button>
      </p>

      <!-- sealed boxes -->
      <section style="margin-bottom:var(--sp-8)">
        <h2 style="font-size:var(--t-xl)">Sealed boxes</h2>
        ${sealed.length ? `
          <p class="lead">Open one when you're ready. The draw happens at the moment you open it.</p>
          <div class="grid grid--3" style="margin-top:var(--sp-5)">
            ${sealed.map((b) => {
              const t = TIER_BY_ID[b.tierId];
              return `<article class="card card--lift">
                <div class="card__icon">${icon('box')}</div>
                <h3 style="font-size:var(--t-md)">${t.name}</h3>
                <p class="muted" style="margin:0">
                  ${t.itemCount} &middot; ${t.featureSlots} feature slot${t.featureSlots > 1 ? 's' : ''}<br>
                  Bought ${when(b.purchasedAt)}
                </p>
                <div class="odds-bar" style="margin:var(--sp-4) 0">
                  ${tierOddsList(t).map((r) => `<span class="odds-bar__seg" data-rarity="${r.id}" style="width:${r.pct}%" title="${r.label} ${r.pct}%"></span>`).join('')}
                </div>
                <button class="btn btn--berry btn--block" type="button" data-open-box="${b.id}">
                  Open this box
                </button>
                <button class="link-btn" style="margin-top:var(--sp-3)" type="button" data-odds-modal="${t.id}">
                  Check the odds first
                </button>
              </article>`;
            }).join('')}
          </div>` : `
          <div class="lookbook-empty">
            <p><b>No sealed boxes.</b></p>
            <p class="muted">Boxes you buy land here, unopened, until you choose to open them.</p>
            <a class="btn btn--sm" href="shop.html">Shop the boxes</a>
          </div>`}
      </section>

      <!-- the live open -->
      <section data-open-stage hidden style="margin-bottom:var(--sp-8)">
        <h2 style="font-size:var(--t-xl)">Opening<span data-open-tier></span></h2>
        <p class="sim-note" style="margin-bottom:var(--sp-4)">
          ${icon('warning')}
          <span><b>This one is real.</b> Unlike the practice reels on the rest of the site,
          this resolves your actual box and writes the result to your vault permanently.
          You cannot re-open it.</span>
        </p>
        <div class="reel" data-reel-scope data-reel-tier="classic" data-reel-live>
          <div class="reel__viewport" data-reel-viewport>
            <div class="reel__track" data-reel-track></div>
            <div class="reel__marker" data-reel-marker aria-hidden="true"></div>
            <div class="confetti" data-confetti aria-hidden="true"></div>
          </div>
          <div class="reel__result" data-reel-result role="status"></div>
          <div class="reel__composition" data-reel-composition></div>
        </div>
        <div data-open-summary></div>
      </section>

      <!-- vault -->
      <section style="margin-bottom:var(--sp-8)">
        <h2 style="font-size:var(--t-xl)">Your vault</h2>
        ${vault.length ? `
          <p class="lead">
            Everything you've opened and kept. Have it delivered, or sell it back to us for
            store credit &mdash; whichever you'd rather.
          </p>
          <div class="vault-actions">
            <button class="link-btn" type="button" data-select-all>Select all</button>
            <button class="link-btn" type="button" data-select-none>Clear selection</button>
            <span class="muted" data-selection-summary>Nothing selected</span>
            <button class="btn btn--sm" type="button" data-deliver disabled>Deliver to my house</button>
            <button class="btn btn--sm btn--sun" type="button" data-sell disabled>Sell back for credit</button>
          </div>
          <div class="item-grid" style="margin-top:var(--sp-5)">
            ${vault.map((i) => itemTile(i, { selectable: true })).join('')}
          </div>` : `
          <div class="lookbook-empty">
            <p><b>Nothing in the vault yet.</b></p>
            <p class="muted">Open a sealed box and what you get will appear here.</p>
          </div>`}
      </section>

      ${out.length ? `
      <section style="margin-bottom:var(--sp-8)">
        <h2 style="font-size:var(--t-xl)">Out for delivery</h2>
        <div class="item-grid">${out.map((i) => itemTile(i)).join('')}</div>
        <div class="stack" style="margin-top:var(--sp-4)">
          ${s.deliveries.map((d) => `<p class="muted" style="margin:0">
            <b>${d.itemUids.length} piece${d.itemUids.length === 1 ? '' : 's'}</b> requested
            ${when(d.requestedAt)} &mdash; ${d.status}. Ships Tuesdays and Fridays,
            plastic-free.</p>`).join('')}
        </div>
      </section>` : ''}

      ${sold.length ? `
      <section style="margin-bottom:var(--sp-8)">
        <h2 style="font-size:var(--t-xl)">Sold back</h2>
        <p class="lead">
          These went back into the pool for someone else's box. Nothing you sell back is
          binned.
        </p>
        <div class="item-grid">${sold.map((i) => itemTile(i)).join('')}</div>
      </section>` : ''}

      <!-- credit + ledger -->
      <section>
        <h2 style="font-size:var(--t-xl)">Store credit</h2>
        <div class="split">
          <div class="receipt">
            <p class="eyebrow">Activity</p>
            <dl>
              ${s.ledger.length ? s.ledger.map((l) => `
                <div class="row">
                  <dt>${l.note}<br><span class="muted" style="font-weight:400">${when(l.at)}</span></dt>
                  <dd>${l.amount ? (l.amount > 0 ? '+' : '') + money(l.amount) : '&mdash;'}</dd>
                </div>`).join('') : '<div class="row"><dt>Nothing yet</dt><dd>&mdash;</dd></div>'}
            </dl>
          </div>
          <aside class="card">
            <h3 style="font-size:var(--t-md)">How sell-back is priced</h3>
            <ul class="spec-list">
              ${RARITY_ORDER.map((r) => `<li><span><b>${RARITIES[r].label}</b></span><span>${money(BUYBACK[r])}</span></li>`).join('')}
            </ul>
            <p class="muted" style="margin-top:var(--sp-4);font-size:var(--t-xs)">
              <b>Selling back is always worse value than keeping it.</b> We pay well under
              typical resale because anything returned has to be re-graded, re-photographed
              and re-shipped. It exists so nothing gets binned &mdash; not as a way to make
              money, and we're not going to imply otherwise.
            </p>
            <p class="muted" style="margin-top:var(--sp-3);font-size:var(--t-xs)">
              Credit is <b>store credit only</b>: never cash, never withdrawable, never
              transferable. That's deliberate &mdash; a cash-out is what would make this
              gambling. <a href="faq.html#odds">Our full answer on that</a>
            </p>
          </aside>
        </div>
      </section>`;

    bindSelection();
  }

  /* -------------------------------------------------------- selection state */
  /* Selection survives re-renders. Without this, any refresh — including one
     triggered from another tab — would silently clear what the visitor ticked. */
  const picked = new Set();

  function selected() {
    return Array.from(picked).filter((u) =>
      Account.get().items.some((i) => i.uid === u && i.status === 'vault'));
  }

  function bindSelection() {
    const summary = root.querySelector('[data-selection-summary]');
    const deliver = root.querySelector('[data-deliver]');
    const sell = root.querySelector('[data-sell]');
    if (!summary) return;

    const update = () => {
      const picks = selected();
      const worth = picks.reduce((n, u) => {
        const item = Account.get().items.find((i) => i.uid === u);
        return n + (item ? Account.buybackValue(item) : 0);
      }, 0);
      summary.textContent = picks.length
        ? `${picks.length} selected · worth ${money(worth)} in credit`
        : 'Nothing selected';
      deliver.disabled = !picks.length;
      sell.disabled = !picks.length;
    };

    /* Restore ticks after a re-render, then keep the set in sync. */
    root.querySelectorAll('[data-pick]').forEach((c) => {
      c.checked = picked.has(c.dataset.pick);
      c.addEventListener('change', () => {
        if (c.checked) picked.add(c.dataset.pick); else picked.delete(c.dataset.pick);
        update();
      });
    });
    update();
  }

  /* --------------------------------------------------------- the live open */
  async function openBoxLive(boxId) {
    const box = Account.get().boxes.find((b) => b.id === boxId);
    if (!box) return;
    const tier = TIER_BY_ID[box.tierId];

    const stage = root.querySelector('[data-open-stage]');
    stage.hidden = false;
    root.querySelector('[data-open-tier]').textContent = ` your ${tier.name}`;
    stage.scrollIntoView({ block: 'center', behavior: 'smooth' });

    /* Resolve the real draw and persist it before animating anything — the
       animation is a presentation of a decision already recorded. */
    const outcome = Account.openBox(boxId);
    if (!outcome) return;

    const reelScope = stage.querySelector('[data-reel-scope]');
    const reel = new Reel(reelScope);
    reel.setTier(tier.id);

    /* Walk the feature slots one at a time so each gets its own reveal. */
    const summary = root.querySelector('[data-open-summary]');
    summary.innerHTML = '';
    for (let i = 0; i < outcome.features.length; i++) {
      const f = outcome.features[i];
      // eslint-disable-next-line no-await-in-loop
      await reel.revealOutcome(f.rarity, Account.art(f));
    }

    const staples = outcome.items.filter((i) => i.slot === 'staple');
    summary.innerHTML = `
      <div class="card" style="margin-top:var(--sp-5)">
        <p class="eyebrow">In the box</p>
        <h3 style="font-size:var(--t-md)">${tier.name} &mdash; ${outcome.items.length} pieces, now in your vault</h3>
        <div class="item-grid" style="margin-top:var(--sp-4)">
          ${outcome.items.map((i) => itemTile(i)).join('')}
        </div>
        <p class="muted" style="margin-top:var(--sp-4);font-size:var(--t-xs)">
          ${outcome.features.length} feature slot${outcome.features.length > 1 ? 's' : ''}
          rolled against the published odds, plus ${staples.length} everyday staples that
          aren't a lottery. Scroll down to deliver or sell any of it back.
        </p>
        <button class="btn btn--sm" type="button" data-refresh>Back to my vault</button>
      </div>`;
  }

  /* ----------------------------------------------------------- interactions */
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-signin]');
    if (!form) return;
    e.preventDefault();
    const msg = form.querySelector('[data-signin-msg]');
    const res = Account.signIn(form.querySelector('input').value);
    if (!res.ok) {
      msg.dataset.state = 'err';
      msg.textContent = res.error;
    }
  });

  root.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-box]');
    if (openBtn) { openBoxLive(openBtn.dataset.openBox); return; }

    if (e.target.closest('[data-signout]')) { Account.signOut(); return; }
    if (e.target.closest('[data-wipe]')) {
      if (window.confirm('Delete your vault, boxes and credit from this browser? This cannot be undone.')) {
        Account.deleteEverything();
      }
      return;
    }
    if (e.target.closest('[data-refresh]')) { render(); return; }

    if (e.target.closest('[data-select-all]')) {
      root.querySelectorAll('[data-pick]').forEach((c) => { c.checked = true; picked.add(c.dataset.pick); });
      bindSelection(); return;
    }
    if (e.target.closest('[data-select-none]')) {
      picked.clear();
      root.querySelectorAll('[data-pick]').forEach((c) => { c.checked = false; });
      bindSelection(); return;
    }

    if (e.target.closest('[data-deliver]')) {
      const picks = selected();
      if (picks.length) { Account.requestDelivery(picks); picked.clear(); }
      return;
    }
    if (e.target.closest('[data-sell]')) {
      const picks = selected();
      if (!picks.length) return;
      const worth = picks.reduce((n, u) => {
        const item = Account.get().items.find((i) => i.uid === u);
        return n + (item ? Account.buybackValue(item) : 0);
      }, 0);
      const ok = window.confirm(
        `Sell ${picks.length} piece${picks.length === 1 ? '' : 's'} back for ${money(worth)} in store credit?\n\n`
        + 'This is always worse value than keeping or wearing them. Credit is store credit '
        + 'only — never cash, never withdrawable.'
      );
      if (ok) { Account.sellBack(picks); picked.clear(); }
    }
  });

  /* Re-render on ANY change, except while a reveal is mid-flight — a refresh
     mid-animation would tear out the reel the visitor is watching. */
  let suppress = false;
  Bus.on(() => {
    renderHeader();
    if (!suppress) render();
  });
  const origOpen = openBoxLive;
  openBoxLive = async function wrapped(id) {   // eslint-disable-line no-func-assign
    suppress = true;
    try { await origOpen(id); } finally { suppress = false; }
  };
})();
