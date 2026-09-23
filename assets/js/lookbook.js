/* ==========================================================================
   Second Spin — lookbook
   --------------------------------------------------------------------------
   Renders the 200-item catalogue and filters it by rarity tag and garment
   category, so a visitor can see exactly what each tag means in practice
   before they spend anything.

   Note the deliberate separation of two different numbers:
     - CATALOGUE BREADTH (how many distinct items carry a tag) — shown here.
     - DRAW ODDS (your chance of getting that tag) — lives in site-data.js.
   They are not the same thing and the page says so, because conflating them
   is an easy way to accidentally imply better odds than we publish.
   ========================================================================== */

(function initLookbook() {
  const grid = document.querySelector('[data-lookbook-grid]');
  if (!grid || typeof ITEM_CATALOG === 'undefined') return;

  const state = { rarity: 'all', category: 'all' };

  const categories = Array.from(new Set(ITEM_CATALOG.map((i) => i.category))).sort();
  const breadth = catalogBreadth();

  /* ---------------------------------------------------------- filter chrome */
  function buildFilters() {
    const rarityBar = document.querySelector('[data-filter-rarity]');
    const catBar = document.querySelector('[data-filter-category]');

    if (rarityBar) {
      const all = `<button class="filter-btn" type="button" data-rarity="all" aria-pressed="true">
          All tags <span class="filter-btn__count">${ITEM_CATALOG.length}</span></button>`;
      rarityBar.innerHTML = all + RARITY_ORDER.map((id) => `
        <button class="filter-btn" type="button" data-rarity="${id}" aria-pressed="false">
          <span class="dot" style="background:${RARITIES[id].color}"></span>
          ${RARITIES[id].label}
          <span class="filter-btn__count">${breadth[id] || 0}</span>
        </button>`).join('');
    }

    if (catBar) {
      catBar.innerHTML =
        `<button class="filter-btn" type="button" data-category="all" aria-pressed="true">Everything</button>` +
        categories.map((c) => `
          <button class="filter-btn" type="button" data-category="${c}" aria-pressed="false">
            ${c.charAt(0).toUpperCase() + c.slice(1)}
          </button>`).join('');
    }
  }

  /* ----------------------------------------------------------------- render */
  function visible() {
    return ITEM_CATALOG.filter(
      (i) =>
        (state.rarity === 'all' || i.rarity === state.rarity) &&
        (state.category === 'all' || i.category === state.category)
    );
  }

  function render() {
    const items = visible();
    const countEl = document.querySelector('[data-lookbook-count]');
    if (countEl) {
      countEl.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
    }

    if (!items.length) {
      grid.innerHTML = `<p class="lookbook-empty">
        No items match that combination. We don't stock every garment type in
        every tag &mdash; for instance there are no Vintage Rare trainers, because
        wearable pre-2000s trainers essentially don't reach the bale stream.</p>`;
      return;
    }

    grid.innerHTML = items.map((i) => `
      <figure class="item-tile">
        <div class="item-tile__frame" data-rarity="${i.rarity}">
          <img class="item-tile__img" src="${i.file}" width="96" height="96"
               alt="Pixel-art illustration of a ${i.colourway.toLowerCase()} ${i.typeLabel.toLowerCase()}"
               loading="lazy" decoding="async">
        </div>
        <figcaption class="item-tile__name">${i.name}</figcaption>
        <p class="item-tile__meta">${i.colourway} &middot; ${i.pattern}</p>
        <p class="item-tile__tag">
          <span class="chip" data-rarity="${i.rarity}">
            <span class="dot" data-rarity="${i.rarity}" style="background:${RARITIES[i.rarity].color}"></span>
            ${i.rarityLabel}
          </span>
        </p>
      </figure>`).join('');
  }

  /* ------------------------------------------------------------- interaction */
  document.addEventListener('click', (e) => {
    const rBtn = e.target.closest('[data-rarity]');
    const cBtn = e.target.closest('[data-category]');

    if (rBtn && rBtn.classList.contains('filter-btn')) {
      state.rarity = rBtn.dataset.rarity;
      document.querySelectorAll('[data-filter-rarity] .filter-btn').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === rBtn))
      );
      render();
    }
    if (cBtn && cBtn.classList.contains('filter-btn')) {
      state.category = cBtn.dataset.category;
      document.querySelectorAll('[data-filter-category] .filter-btn').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === cBtn))
      );
      render();
    }
  });

  /* Deep link: lookbook.html?tag=rare */
  const requested = new URLSearchParams(location.search).get('tag');

  buildFilters();
  if (requested && RARITIES[requested]) {
    const btn = document.querySelector(`[data-filter-rarity] [data-rarity="${requested}"]`);
    if (btn) btn.click();
    else render();
  } else {
    render();
  }
})();
