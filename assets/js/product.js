/* ==========================================================================
   Second Spin — product page wiring
   --------------------------------------------------------------------------
   Tier switching and data binding for the product and shop pages. Kept apart
   from reel.js so the reveal component stays a component and this stays page
   glue.

   Every visible number here is read from TIERS in site-data.js, so a page can
   never advertise odds the reel doesn't use.
   ========================================================================== */

/** Repoint every tier-bound field, and the reel, at a tier. */
function syncTierBindings(tierId) {
  const tier = TIER_BY_ID[tierId];
  if (!tier) return;

  const set = (key, value) => {
    document.querySelectorAll(`[data-tier-bind="${key}"]`).forEach((el) => {
      el.textContent = value;
    });
  };

  set('name', tier.name);
  set('price', tier.priceLabel);
  set('items', tier.itemCount);
  set('tagline', tier.tagline);
  set('featureSlots', String(tier.featureSlots));
  set('everydaySlots', String(tier.everydaySlots));
  set('weight', `~${tier.avgWeightLbs} lbs`);
  set('score', String(tier.sustainScore));
  set('grade', tier.sustainGrade);
  set('ships', tier.shipsIn);
  set('standout', `${standoutChancePerBox(tier)}%`);
  set('odds', tierOddsSentence(tier));

  document.querySelectorAll('[data-tier-ring]').forEach((el) => {
    el.style.setProperty('--pct', tier.sustainScore);
  });

  document.querySelectorAll('[data-tier-guarantee]').forEach((el) => {
    el.textContent = tier.guarantee
      || 'No condition guarantee on this tier — it is our most affordable rescue box.';
  });

  document.querySelectorAll('[data-tier-features]').forEach((el) => {
    el.innerHTML = tier.features
      .map((f) => `<li>${icon('check')}<span>${f}</span></li>`)
      .join('');
  });

  document.querySelectorAll('[data-add-to-cart]').forEach((el) => {
    if (el.closest('[data-product]')) {
      el.dataset.addToCart = tier.id;
      el.textContent = `Add ${tier.name} — ${tier.priceLabel}`;
    }
  });

  document.querySelectorAll('[data-odds-modal][data-product-odds]').forEach((el) => {
    el.dataset.oddsModal = tier.id;
  });

  /* Odds bar + legend, regenerated from the same table the reel uses. */
  const list = tierOddsList(tier);
  document.querySelectorAll('[data-tier-oddsbar]').forEach((el) => {
    el.innerHTML = list
      .map((r) => `<span class="odds-bar__seg" data-rarity="${r.id}" style="width:${r.pct}%" title="${r.label} ${r.pct}%"></span>`)
      .join('');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Odds for one feature slot: ${tierOddsSentence(tier)}`);
  });
  const legends = document.querySelectorAll('[data-tier-oddslegend]');
  legends.forEach((el) => {
    el.innerHTML = list
      .map((r) => `<span><span class="dot" data-rarity="${r.id}" style="background:${r.color}"></span>${r.label} ${r.pct}%</span>`)
      .join('');
  });
  /* Where a legend is present the sentence is redundant — it stays in the
     markup purely as the no-JS fallback. */
  if (legends.length) {
    document.querySelectorAll('[data-tier-bind="odds"]').forEach((el) => { el.hidden = true; });
  }

  /* Slot diagram: feature slots vs everyday slots */
  document.querySelectorAll('[data-slot-grid]').forEach((el) => {
    const feature = Array.from({ length: tier.featureSlots }, (_, i) => `
      <div class="slot slot--feature">
        ${icon('sparkle')}
        <b>Feature slot ${i + 1}</b>
        <span>Rolled on the odds table</span>
      </div>`).join('');
    const everyday = Array.from({ length: tier.everydaySlots }, (_, i) => `
      <div class="slot">
        ${icon('tshirt')}
        <b>Staple ${i + 1}</b>
        <span>Good-condition basic</span>
      </div>`).join('');
    el.innerHTML = feature + everyday;
  });

  /* And the reveal itself */
  if (window.SecondSpin && window.SecondSpin.reels) {
    window.SecondSpin.reels.forEach((r) => r.setTier && r.setTier(tierId));
  }
}

/* --------------------------------------------------------------------------
   Boot — runs after reel.js has created the reels
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tier-switch]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tier-value]');
      if (!btn) return;
      const tierId = btn.dataset.tierValue;

      group.querySelectorAll('[data-tier-value]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });

      syncTierBindings(tierId);

      if (history.replaceState) history.replaceState(null, '', `?tier=${tierId}`);
    });
  });

  /* Deep link: box.html?tier=premium */
  const requested = new URLSearchParams(location.search).get('tier');
  if (requested && TIER_BY_ID[requested]) {
    const btn = document.querySelector(`[data-tier-value="${requested}"]`);
    if (btn) btn.click();
    else syncTierBindings(requested);
  } else if (document.querySelector('[data-tier-bind], [data-tier-oddsbar]')) {
    syncTierBindings(DEFAULT_TIER);
  }
});
