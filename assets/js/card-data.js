/* ==========================================================================
   Second Spin — Card Vault data (single source of truth)
   --------------------------------------------------------------------------
   The collectibles product line: blind boxes of authentic secondhand trading
   cards, bought as bulk lots and graded by hand, same model as the clothing.

   Structured to mirror site-data.js exactly — its own rarity ladder, its own
   odds tables, the same 100%-sum assertion — so the reveal UI can drive
   either product line without special-casing.

   LEGAL NOTE: we resell authentic secondhand cards, which is lawful under
   first-sale doctrine, and we describe real inventory factually. The rarity
   names below are generic trading-card grading terms, and every sprite in
   assets/cards/ is our own original design. No franchise's characters, logos
   or trade dress appear in our assets, and none should be added.
   ========================================================================== */

const CARD_RARITIES = {
  vintage: {
    id: 'vintage',
    label: 'Vintage Holo',
    color: '#c9a23a',
    textOn: '#16241b',
    blurb: 'A holographic card from a first-run era set, sleeved and graded by hand before packing.',
    resaleBand: 'typically resells $40\u2013250',
  },
  holo: {
    id: 'holo',
    label: 'Holo Rare',
    color: '#7b5ea7',
    textOn: '#ffffff',
    blurb: 'A genuine holographic rare in Very Good condition or better. The backbone of a good pull.',
    resaleBand: 'typically resells $12\u201360',
  },
  fullart: {
    id: 'fullart',
    label: 'Full Art',
    color: '#2a6fd6',
    textOn: '#ffffff',
    blurb: 'Edge-to-edge artwork, modern chase layout. Excellent or Near Mint only.',
    resaleBand: 'typically resells $8\u201335',
  },
  uncommon: {
    id: 'uncommon',
    label: 'Uncommon',
    color: '#3c7a4e',
    textOn: '#ffffff',
    blurb: 'Playable, collectable, and the layer that makes a bulk lot worth sorting at all.',
    resaleBand: 'typically resells $1\u20135',
  },
  common: {
    id: 'common',
    label: 'Common',
    color: '#8a9094',
    textOn: '#16241b',
    blurb: 'Bulk cards in honest condition. Most of the weight we rescue, and most of what gets played with.',
    resaleBand: 'typically resells under $1 individually',
  },
};

const CARD_RARITY_ORDER = ['vintage', 'holo', 'fullart', 'uncommon', 'common'];

/* Odds are per FEATURE SLOT, in percent, and must sum to 100. */
const CARD_TIERS = [
  {
    id: 'bulk',
    name: 'Bulk Bundle',
    price: 12,
    priceLabel: '$12',
    itemCount: '30 cards',
    featureSlots: 1,
    everydaySlots: 29,
    tagline: 'A sorted bulk lot with one card rolled against the odds.',
    avgWeightLbs: 0.4,
    sustainScore: 80,
    sustainGrade: 'B+',
    shipsIn: '3\u20135 business days',
    guarantee: null,
    features: [
      '30 cards, 1 feature slot',
      'Sorted and sleeved by hand',
      'No duplicates within a single box',
      'Rigid mailer, plastic-free',
    ],
    odds: { vintage: 1, holo: 6, fullart: 13, uncommon: 30, common: 50 },
  },
  {
    id: 'collector',
    name: 'Collector Box',
    price: 28,
    priceLabel: '$28',
    itemCount: '40 cards',
    featureSlots: 2,
    everydaySlots: 38,
    tagline: 'Two feature slots and a real shot at a holo.',
    avgWeightLbs: 0.6,
    sustainScore: 86,
    sustainGrade: 'A\u2212',
    shipsIn: '2\u20134 business days',
    guarantee: 'At least one card per box grades Excellent or better.',
    features: [
      '40 cards, 2 feature slots',
      'Every feature card sleeved and top-loaded',
      'Condition graded per card on the note sheet',
      'No duplicates within a single box',
      'One free swap on a damaged card',
    ],
    odds: { vintage: 4, holo: 14, fullart: 24, uncommon: 33, common: 25 },
  },
  {
    id: 'vault',
    name: 'Vault Box',
    price: 55,
    priceLabel: '$55',
    itemCount: '40 cards',
    featureSlots: 2,
    everydaySlots: 38,
    tagline: 'Feature slots never land on a Common. Best hunting ground.',
    avgWeightLbs: 0.6,
    sustainScore: 92,
    sustainGrade: 'A',
    shipsIn: '1\u20133 business days',
    guarantee: 'Guaranteed: both feature slots are Uncommon or better \u2014 never a Common.',
    features: [
      '40 cards, 2 feature slots',
      'Feature slots never resolve to Common',
      'Hand-picked by a senior grader',
      'Every feature card sleeved and top-loaded',
      'Two free swaps + prepaid return label',
    ],
    odds: { vintage: 14, holo: 30, fullart: 36, uncommon: 20, common: 0 },
  },
];

const CARD_TIER_BY_ID = CARD_TIERS.reduce((a, t) => { a[t.id] = t; return a; }, {});
const DEFAULT_CARD_TIER = 'collector';

/* --------------------------------------------------------------------------
   Helpers — mirrors of the clothing helpers in site-data.js
   -------------------------------------------------------------------------- */
function cardOddsList(tier) {
  return CARD_RARITY_ORDER
    .filter((id) => (tier.odds[id] || 0) > 0)
    .map((id) => ({ ...CARD_RARITIES[id], pct: tier.odds[id] }));
}

function cardOddsSentence(tier) {
  return cardOddsList(tier).map((r) => `${r.label} ${r.pct}%`).join('  \u00b7  ');
}

/** Chance at least one feature slot beats a Common. */
function cardStandoutPerBox(tier) {
  const missOne = (tier.odds.common || 0) / 100;
  return Math.round((1 - Math.pow(missOne, tier.featureSlots)) * 1000) / 10;
}

/* --------------------------------------------------------------------------
   Integrity check — same guard rail as the clothing odds.
   -------------------------------------------------------------------------- */
(function assertCardOdds() {
  CARD_TIERS.forEach((tier) => {
    const sum = CARD_RARITY_ORDER.reduce((a, id) => a + (tier.odds[id] || 0), 0);
    if (sum !== 100) {
      console.error(
        `[Second Spin] Card odds for "${tier.id}" sum to ${sum}%, not 100%. ` +
        'Fix assets/js/card-data.js before shipping.'
      );
    }
  });
})();

if (typeof window !== 'undefined') {
  window.CARD_TIERS = CARD_TIERS;
  window.CARD_RARITIES = CARD_RARITIES;
  window.CARD_TIER_BY_ID = CARD_TIER_BY_ID;
  window.cardOddsSentence = cardOddsSentence;
  window.cardStandoutPerBox = cardStandoutPerBox;
}
