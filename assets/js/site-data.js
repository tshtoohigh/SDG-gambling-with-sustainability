/* ==========================================================================
   Second Spin — Site data (single source of truth)
   --------------------------------------------------------------------------
   Everything about rarities, odds, tiers and impact figures lives here.
   The wheel, the odds modal, the tier cards and the product page all read
   from this file, so the "fun" UI and the "honest" disclosure can never
   drift apart. Change a number here and it changes everywhere.
   ========================================================================== */

/* Brand name in one place — rename here and it updates across every page
   that renders it dynamically (page <title> and visible logo text are in
   the HTML; see README for the one-command rename). */
const BRAND = {
  name: 'Second Spin',
  tagline: 'Thrift blind boxes that keep clothes out of landfill.',
};

/* --------------------------------------------------------------------------
   Rarity ramp
   Colours match the CSS custom properties in styles.css (--r-*).
   -------------------------------------------------------------------------- */
const RARITIES = {
  rare: {
    id: 'rare',
    label: 'Vintage Rare',
    color: '#7b5ea7',
    textOn: '#ffffff',
    blurb: 'A genuine pre-2000s piece, verified by our sorters. Think 70s corduroy, 90s Levi\u2019s, hand-knit wool.',
    resaleBand: 'typically resells for $45\u2013$180',
    examples: [
      '1970s patchwork suede jacket',
      '90s Levi\u2019s 501 (single-stitch)',
      'Hand-knit Aran wool cardigan',
      '80s silk Liberty print blouse',
    ],
  },
  designer: {
    id: 'designer',
    label: 'Designer Label',
    color: '#f4b429',
    textOn: '#16241b',
    blurb: 'A recognised label in good condition \u2014 contemporary or heritage, authenticated before packing.',
    resaleBand: 'typically resells for $35\u2013$120',
    examples: [
      'Ralph Lauren oxford shirt',
      'Max Mara wool trousers',
      'Dr. Martens 1460s, resoled',
      'Burberry lambswool scarf',
    ],
  },
  statement: {
    id: 'statement',
    label: 'Statement Piece',
    color: '#e4572e',
    textOn: '#ffffff',
    blurb: 'Unlabelled but unforgettable \u2014 bold print, unusual cut, or a texture you won\u2019t find on a high street rail.',
    resaleBand: 'typically resells for $20\u2013$60',
    examples: [
      'Hand-embroidered denim jacket',
      'Oversized mohair cardigan',
      'Pleated metallic midi skirt',
      'Western shirt with pearl snaps',
    ],
  },
  seasonal: {
    id: 'seasonal',
    label: 'Seasonal Pick',
    color: '#3e9bc0',
    textOn: '#ffffff',
    blurb: 'Chosen for the month you order in \u2014 a linen shirt in June, a flannel overshirt in November.',
    resaleBand: 'typically resells for $15\u2013$40',
    examples: [
      'Washed linen camp-collar shirt',
      'Heavyweight flannel overshirt',
      'Quilted vest, barely worn',
      'Cotton sundress, deadstock',
    ],
  },
  everyday: {
    id: 'everyday',
    label: 'Everyday Staple',
    color: '#3c7a4e',
    textOn: '#ffffff',
    blurb: 'The backbone of every box: solid, wearable basics with real life left in them that were headed for a bale.',
    resaleBand: 'typically resells for $8\u2013$25',
    examples: [
      'Merino crew-neck jumper',
      'Straight-leg dark denim',
      'Cotton tee, no pilling',
      'Chino shorts, unworn hem',
    ],
  },
};

const RARITY_ORDER = ['rare', 'designer', 'statement', 'seasonal', 'everyday'];

/* --------------------------------------------------------------------------
   Tiers
   `odds` = probability distribution for ONE feature slot, in percent.
   Each tier's odds MUST sum to 100 (asserted at the bottom of this file).
   -------------------------------------------------------------------------- */
const TIERS = [
  {
    id: 'starter',
    name: 'Starter Box',
    price: 10,
    priceLabel: '$10',
    itemCount: '5 items',
    featureSlots: 1,
    everydaySlots: 4,
    tagline: 'Dip a toe in. Smallest spend, smallest odds, same rescue.',
    ribbon: null,
    avgWeightLbs: 4.2,
    sustainScore: 82,
    sustainGrade: 'B+',
    shipsIn: '3\u20135 business days',
    featured: false,
    features: [
      '5 garments, 1 feature slot',
      'Sorted, washed and steamed before packing',
      'Size range honoured (you pick 2 sizes)',
      'Carbon-light ground shipping only',
    ],
    guarantee: null,
    odds: { rare: 2, designer: 5, statement: 13, seasonal: 25, everyday: 55 },
  },
  {
    id: 'classic',
    name: 'Classic Box',
    price: 22,
    priceLabel: '$22',
    itemCount: '6 items',
    featureSlots: 2,
    everydaySlots: 4,
    tagline: 'The balanced one. Two feature slots, real chance of a standout.',
    ribbon: 'Most popular',
    avgWeightLbs: 5.6,
    sustainScore: 88,
    sustainGrade: 'A\u2212',
    shipsIn: '2\u20134 business days',
    featured: true,
    features: [
      '6 garments, 2 feature slots',
      'Sorted, washed and steamed before packing',
      'Size range honoured (you pick 2 sizes)',
      'Style note card naming every piece\u2019s origin',
      'One free swap if something doesn\u2019t fit',
    ],
    guarantee: 'At least one piece per box is graded Excellent condition.',
    odds: { rare: 6, designer: 12, statement: 22, seasonal: 25, everyday: 35 },
  },
  {
    id: 'premium',
    name: 'Premium Box',
    price: 45,
    priceLabel: '$45',
    itemCount: '6 items',
    featureSlots: 2,
    everydaySlots: 4,
    tagline: 'Best hunting ground. Feature slots never land on a basic.',
    ribbon: 'Best odds',
    avgWeightLbs: 6.4,
    sustainScore: 94,
    sustainGrade: 'A',
    shipsIn: '1\u20133 business days',
    featured: false,
    features: [
      '6 garments, 2 feature slots',
      'Feature slots never resolve to Everyday Staple',
      'Every piece graded Very Good or better',
      'Hand-picked by a senior sorter, not a line packer',
      'Two free swaps + prepaid return label',
    ],
    guarantee: 'Guaranteed: both feature slots are Vintage, Designer, Statement or Seasonal \u2014 never a basic.',
    odds: { rare: 20, designer: 30, statement: 35, seasonal: 15, everyday: 0 },
  },
];

const TIER_BY_ID = TIERS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
const DEFAULT_TIER = 'classic';

/* --------------------------------------------------------------------------
   Impact figures
   --------------------------------------------------------------------------
   DEMO DATA. In production these are served from the fulfilment database
   (one row per packed box, weighed on a connected scale at the packing
   bench). The `liveDrip` value only exists so the counter visibly ticks in
   this prototype; the Impact page says so out loud in its methodology note.
   -------------------------------------------------------------------------- */
const IMPACT = {
  lbsDiverted: 12450,
  boxesShipped: 2184,
  itemsRescued: 12012,
  partnerStores: 24,
  avgLbsPerBox: 5.7,
  resoldRate: 0,          // we do not resell returns, we re-circulate them
  updatedLabel: 'Updated nightly from the packing-bench scale',
  liveDrip: { lbs: 5.7, everyMs: 14000 }, // prototype-only visible tick
};

/* --------------------------------------------------------------------------
   Recent finds — feeds the homepage marquee
   -------------------------------------------------------------------------- */
const RECENT_FINDS = [
  { rarity: 'rare',      text: '1978 Wrangler denim jacket \u2014 Leeds, UK' },
  { rarity: 'designer',  text: 'A.P.C. wool coat \u2014 Portland, OR' },
  { rarity: 'statement', text: 'Hand-beaded 60s shift dress \u2014 Austin, TX' },
  { rarity: 'everyday',  text: '3 merino jumpers, zero pilling \u2014 Glasgow' },
  { rarity: 'rare',      text: '90s Patagonia Snap-T fleece \u2014 Denver, CO' },
  { rarity: 'seasonal',  text: 'Irish linen shirt, unworn \u2014 Cork, IE' },
  { rarity: 'designer',  text: 'Dr. Martens 1460, resoled \u2014 Manchester, UK' },
  { rarity: 'statement', text: 'Embroidered Mexican wedding shirt \u2014 Tucson' },
];

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

/**
 * Weighted draw across any odds table. Returns a rarity id.
 *
 * `order` is optional and only fixes iteration order; when omitted the keys
 * are taken from the table itself. That keeps this usable by product lines
 * with their own rarity ladders (see card-data.js) rather than hardcoding the
 * clothing ladder — which it previously did, and which broke the Card Vault.
 */
function drawRarity(odds, order) {
  const keys = order && order.length ? order : Object.keys(odds);
  const entries = keys
    .map((id) => [id, odds[id] || 0])
    .filter(([, pct]) => pct > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, pct]) => sum + pct, 0);
  let roll = Math.random() * total;
  for (const [id, pct] of entries) {
    roll -= pct;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/** Rarities present in a tier, in display order, with their percentages. */
function tierOddsList(tier) {
  return RARITY_ORDER
    .filter((id) => (tier.odds[id] || 0) > 0)
    .map((id) => ({ ...RARITIES[id], pct: tier.odds[id] }));
}

/** "Vintage Rare 6% · Designer Label 12% · …" */
function tierOddsSentence(tier) {
  return tierOddsList(tier).map((r) => `${r.label} ${r.pct}%`).join('  \u00b7  ');
}

/** Chance of landing any "standout" (non-everyday) result on one slot. */
function standoutChance(tier) {
  return RARITY_ORDER
    .filter((id) => id !== 'everyday')
    .reduce((sum, id) => sum + (tier.odds[id] || 0), 0);
}

/** Probability that at least one of the tier's feature slots is a standout. */
function standoutChancePerBox(tier) {
  const miss = 1 - standoutChance(tier) / 100;
  return Math.round((1 - Math.pow(miss, tier.featureSlots)) * 1000) / 10;
}

function formatNumber(n) {
  return Math.round(n).toLocaleString('en-US');
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* --------------------------------------------------------------------------
   Integrity check — loudly complain if an odds table stops summing to 100.
   This is the guard rail that keeps the published odds honest.
   -------------------------------------------------------------------------- */
(function assertOdds() {
  TIERS.forEach((tier) => {
    const sum = RARITY_ORDER.reduce((acc, id) => acc + (tier.odds[id] || 0), 0);
    if (sum !== 100) {
      console.error(
        `[Second Spin] Odds table for "${tier.id}" sums to ${sum}%, not 100%. ` +
        'Fix assets/js/site-data.js before shipping.'
      );
    }
  });
})();


/* ==========================================================================
   Trade Up
   --------------------------------------------------------------------------
   A paid second chance on a feature slot that is deliberately NOT a re-roll.

   The distinction matters, and it is the whole reason this mechanic is
   defensible on a site that publishes its odds:

   - A re-roll can land you somewhere worse. That makes it a gamble, it makes
     disappointment refundable-feeling, and it rewards chasing.
   - A Trade Up removes the outcome you rejected *and everything below it*,
     so the result is a GUARANTEED STRICT UPGRADE. You cannot lose. There is
     nothing to chase, because there is no bad outcome to chase away from.

   Three constraints keep it from becoming loot-box mechanics:

   1. Capped at `maxPerSlot`. Spend has a hard ceiling per box. No escalation,
      no streaks, no "one more go" pricing.
   2. Only available FROM the two outcomes that actually disappoint
      (Everyday Staple, Seasonal Pick). You cannot trade up from a good result
      to farm a better one.
   3. Vintage Rare is never a Trade Up outcome. It is the scarcest thing we
      stock, it is what the Premium tier's price is built on, and selling a
      $2.20 shortcut to it would both break that price ladder and drain the
      inventory Premium boxes are promised.

   Business note: the traded garment is not destroyed. It is re-graded back
   into the pool (see the returns policy), so the fee is earned against a
   near-zero marginal cost and nothing is wasted.
   ========================================================================== */

/* Rarity ladder, ascending by market value. Trade Up walks up this. */
const RARITY_RANK = { everyday: 1, seasonal: 2, statement: 3, designer: 4, rare: 5 };

const TRADE_UP = {
  enabled: true,
  pricePct: 0.10,                            // 10% of the box price
  maxPerSlot: 1,                             // hard cap — not escalating
  eligibleFrom: ['everyday', 'seasonal'],    // only the disappointing outcomes
  protected: ['rare'],                       // never a Trade Up result
};

/** Trade Up fee for a tier, rounded to the nearest 5c. */
function tradeUpPrice(tier) {
  return Math.round(tier.price * TRADE_UP.pricePct * 20) / 20;
}

function formatMoney(n) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** Can a slot showing this outcome be traded up at all? */
function canTradeUpFrom(rarityId) {
  return TRADE_UP.enabled && TRADE_UP.eligibleFrom.includes(rarityId);
}

/**
 * Largest-remainder rounding to 1dp that still sums to exactly 100.
 * Needed because the wheel draws its arcs from the published percentages, so
 * those percentages must total 100 or the geometry stops matching the label.
 */
function pctsSummingTo100(weights) {
  const total = weights.reduce((a, w) => a + w, 0);
  const raw = weights.map((w) => (w / total) * 100);
  const out = raw.map((v) => Math.floor(v * 10) / 10);
  const deficit = Math.round((100 - out.reduce((a, v) => a + v, 0)) * 10);
  const byRemainder = raw
    .map((v, i) => [i, v - out[i]])
    .sort((a, b) => b[1] - a[1]);
  for (let k = 0; k < deficit; k++) {
    const i = byRemainder[k % byRemainder.length][0];
    out[i] = Math.round((out[i] + 0.1) * 10) / 10;
  }
  return out;
}

/**
 * The pool a Trade Up draws from: every outcome ranked strictly above
 * `fromId`, minus protected rarities, renormalised to sum to 100%.
 * Returns [] when no upgrade is available.
 */
function tradeUpPool(tier, fromId) {
  const floor = RARITY_RANK[fromId];
  const ids = RARITY_ORDER.filter(
    (id) =>
      RARITY_RANK[id] > floor &&
      !TRADE_UP.protected.includes(id) &&
      (tier.odds[id] || 0) > 0
  );
  if (!ids.length) return [];
  const pcts = pctsSummingTo100(ids.map((id) => tier.odds[id]));
  return ids.map((id, i) => ({ ...RARITIES[id], pct: pcts[i] }));
}

/** The worst thing a Trade Up from `fromId` can produce — the floor guarantee. */
function tradeUpFloor(tier, fromId) {
  const pool = tradeUpPool(tier, fromId);
  if (!pool.length) return null;
  return pool.reduce((lowest, r) =>
    RARITY_RANK[r.id] < RARITY_RANK[lowest.id] ? r : lowest
  );
}

/* --------------------------------------------------------------------------
   Integrity check for Trade Up pools — same guard rail as the base odds.
   -------------------------------------------------------------------------- */
(function assertTradeUpOdds() {
  TIERS.forEach((tier) => {
    TRADE_UP.eligibleFrom.forEach((fromId) => {
      if (!(tier.odds[fromId] > 0)) return;      // outcome can't occur in this tier
      const pool = tradeUpPool(tier, fromId);
      if (!pool.length) return;
      const sum = Math.round(pool.reduce((a, r) => a + r.pct, 0) * 10) / 10;
      if (sum !== 100) {
        console.error(
          `[Second Spin] Trade Up pool for ${tier.id} from "${fromId}" sums to ` +
          `${sum}%, not 100%. Fix pctsSummingTo100() in assets/js/site-data.js.`
        );
      }
      const floor = tradeUpFloor(tier, fromId);
      if (RARITY_RANK[floor.id] <= RARITY_RANK[fromId]) {
        console.error(
          `[Second Spin] Trade Up from "${fromId}" in ${tier.id} can land on ` +
          `"${floor.id}", which is not an upgrade. The strict-upgrade guarantee is broken.`
        );
      }
    });
  });
})();
