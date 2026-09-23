/* ==========================================================================
   Second Spin — the reveal reel
   --------------------------------------------------------------------------
   A horizontal case-opening animation: a long strip of items scrolls past a
   centre marker, decelerates, and stops on your result.

   This pattern is borrowed from game case-openers, and those are built to
   manipulate. This one is built not to. Four rules:

   1. THE STRIP IS THE ODDS TABLE. Cell counts are computed from the published
      percentages by largest-remainder, so a 6% outcome occupies exactly 4 of
      64 cells. Count them if you like — the UI tells you the composition.
      Nothing is salted with extra rares to make the strip feel richer.

   2. NO NEAR-MISS. This is the big one. Case-openers habitually decelerate so
      the marker drifts to the very edge of your cell, with a jackpot cell
      sitting just beyond — manufacturing an "so close!" feeling that has no
      basis in the draw. We land DEAD CENTRE on the winning cell, every single
      time, and we say so on screen.

   3. DRAW FIRST, ANIMATE SECOND. The outcome is resolved before the animation
      starts. Nothing about the scroll can change it. Neighbours of the winning
      cell are whatever the distribution happened to put there — they are not
      arranged for tension.

   4. FREE AND STAKELESS. Spinning buys nothing and reserves nothing.

   Drives either product line via a source descriptor, so the clothing and
   card verticals share one implementation.
   ========================================================================== */

const REEL_CELLS = 64;        // strip length
const REEL_WIN_INDEX = 54;    // where the winning cell sits
const REEL_DURATION = 5200;   // ms

/** Resolve a product line into the data the reel needs. */
function reelSource(kind) {
  if (kind === 'cards' && typeof CARD_TIERS !== 'undefined') {
    return {
      kind,
      tiers: CARD_TIER_BY_ID,
      defaultTier: DEFAULT_CARD_TIER,
      rarities: CARD_RARITIES,
      order: CARD_RARITY_ORDER,
      catalog: typeof CARD_CATALOG !== 'undefined' ? CARD_CATALOG : [],
      noun: 'card',
      lookbook: null,
    };
  }
  return {
    kind: 'clothing',
    tiers: TIER_BY_ID,
    defaultTier: DEFAULT_TIER,
    rarities: RARITIES,
    order: RARITY_ORDER,
    catalog: typeof ITEM_CATALOG !== 'undefined' ? ITEM_CATALOG : [],
    noun: 'piece',
    lookbook: 'lookbook.html',
  };
}

/** Largest-remainder apportionment of `total` cells across the odds table. */
function apportionCells(odds, order, total) {
  const ids = order.filter((id) => (odds[id] || 0) > 0);
  const exact = ids.map((id) => (odds[id] / 100) * total);
  const counts = exact.map((v) => Math.floor(v));
  let left = total - counts.reduce((a, v) => a + v, 0);
  const byRemainder = exact
    .map((v, i) => [i, v - Math.floor(v)])
    .sort((a, b) => b[1] - a[1]);
  for (let k = 0; left > 0; k++, left--) {
    counts[byRemainder[k % byRemainder.length][0]] += 1;
  }
  const out = {};
  ids.forEach((id, i) => { out[id] = counts[i]; });
  return out;
}

class Reel {
  constructor(scope) {
    this.scope = scope;
    this.viewport = scope.querySelector('[data-reel-viewport]');
    this.track = scope.querySelector('[data-reel-track]');
    this.marker = scope.querySelector('[data-reel-marker]');
    this.btn = scope.querySelector('[data-reel-spin]');
    this.resultEl = scope.querySelector('[data-reel-result]');
    this.compEl = scope.querySelector('[data-reel-composition]');
    if (!this.track || !this.viewport) return;

    this.src = reelSource(scope.dataset.reelKind);
    this.spinning = false;
    this.offset = 0;
    this.lastCell = -1;

    this.setTier(scope.dataset.reelTier || this.src.defaultTier);

    if (this.btn) this.btn.addEventListener('click', () => this.spin());
    window.addEventListener('resize', () => this.layout());
  }

  /* ------------------------------------------------------------------ setup */

  setTier(tierId) {
    this.tier = this.src.tiers[tierId] || this.src.tiers[this.src.defaultTier];
    this.scope.dataset.reelTier = this.tier.id;
    this.counts = apportionCells(this.tier.odds, this.src.order, REEL_CELLS);
    this.buildStrip();
    this.renderComposition();
    this.resetResult();
  }

  /** A deterministic-ish interleave, so identical rarities don't clump. */
  buildStrip(winnerId) {
    const pool = [];
    Object.keys(this.counts).forEach((id) => {
      for (let i = 0; i < this.counts[id]; i++) pool.push(id);
    });

    // Spread out rarities: sort by a hash so the strip looks mixed but every
    // count is preserved exactly.
    pool.sort((a, b) => {
      const ha = (a.charCodeAt(0) * 37 + pool.indexOf(a)) % 101;
      const hb = (b.charCodeAt(0) * 37 + pool.indexOf(b)) % 101;
      return ha - hb;
    });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    /* Put the winner at the landing index by SWAPPING, never by inserting —
       swapping preserves the exact published composition of the strip. */
    if (winnerId) {
      const at = pool.indexOf(winnerId, 0);
      const idx = at === -1 ? pool.findIndex((p) => p === winnerId) : at;
      if (idx !== -1) {
        [pool[REEL_WIN_INDEX], pool[idx]] = [pool[idx], pool[REEL_WIN_INDEX]];
      }
    }

    this.strip = pool.map((id) => {
      const rarity = this.src.rarities[id];
      const options = this.src.catalog.filter((c) => c.rarity === id);
      const art = options.length ? options[Math.floor(Math.random() * options.length)] : null;
      return { rarity, art };
    });

    this.track.innerHTML = this.strip.map((cell, i) => `
      <div class="reel__cell" data-rarity="${cell.rarity.id}" data-index="${i}"
           style="--cell-tint:${cell.rarity.color}">
        ${cell.art
          ? `<img class="reel__img" src="${cell.art.file}" alt="" width="64" height="64" loading="eager" decoding="async">`
          : `<span class="reel__blank" aria-hidden="true"></span>`}
        <span class="reel__cell-label">${cell.rarity.label}</span>
      </div>`).join('');

    this.track.style.transform = 'translate3d(0,0,0)';
    this.offset = 0;
    this.layout();
  }

  layout() {
    const cells = this.track.children;
    if (cells.length < 2) return;
    this.step = cells[1].offsetLeft - cells[0].offsetLeft;
    this.cellW = cells[0].offsetWidth;
  }

  renderComposition() {
    if (!this.compEl) return;
    const rows = this.src.order
      .filter((id) => this.counts[id])
      .map((id) => {
        const r = this.src.rarities[id];
        return `<span><span class="dot" style="background:${r.color}"></span>${this.counts[id]}&times; ${r.label} <span class="muted">(${this.tier.odds[id]}%)</span></span>`;
      }).join('');
    this.compEl.innerHTML = `
      <p class="muted" style="margin:0 0 var(--sp-2);font-size:var(--t-xs)">
        <b>What's on this strip.</b> ${REEL_CELLS} cells, apportioned from the published
        odds &mdash; count them if you like.
      </p>
      <div class="odds-legend">${rows}</div>`;
  }

  /* --------------------------------------------------------------- spinning */

  spin() {
    if (this.spinning) return;

    /* 1. Resolve the outcome first, from the published table. The rarity order
          is passed explicitly so this works for either product ladder. */
    const winnerId = drawRarity(this.tier.odds, this.src.order);
    if (!winnerId) return;

    /* 2. Rebuild the strip with that outcome at the landing index. */
    this.buildStrip(winnerId);
    const winner = this.strip[REEL_WIN_INDEX];

    /* 3. Compute the offset that centres the winning cell under the marker.
          Dead centre — no random drift toward the cell edge, because that is
          exactly how case-openers fake a near miss. */
    const target = -(REEL_WIN_INDEX * this.step + this.cellW / 2
                     - this.viewport.clientWidth / 2);

    this.spinning = true;
    this.scope.classList.add('is-spinning');
    if (this.btn) {
      this.btn.disabled = true;
      this.btn.dataset.label = this.btn.dataset.label || this.btn.textContent;
      this.btn.textContent = 'Opening\u2026';
    }
    if (this.resultEl) {
      this.resultEl.classList.remove('is-hit');
      this.resultEl.innerHTML = `<p class="eyebrow">Opening</p>`;
    }

    const finish = () => {
      this.offset = target;
      this.track.style.transform = `translate3d(${target}px,0,0)`;
      this.spinning = false;
      this.scope.classList.remove('is-spinning');
      const won = this.track.children[REEL_WIN_INDEX];
      if (won) won.classList.add('is-won');
      if (this.btn) {
        this.btn.disabled = false;
        this.btn.textContent = this.btn.dataset.label || 'Open again';
      }
      this.showResult(winner);
    };

    if (prefersReducedMotion()) { finish(); return; }

    const start = performance.now();
    const from = 0;
    const step = (now) => {
      const p = Math.min(1, (now - start) / REEL_DURATION);
      const eased = 1 - Math.pow(1 - p, 5);          // easeOutQuint
      this.offset = from + (target - from) * eased;
      this.track.style.transform = `translate3d(${this.offset}px,0,0)`;
      this.tickMarker();
      if (p < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }

  /** Pulse the marker as each cell boundary crosses it. */
  tickMarker() {
    if (!this.marker || !this.step) return;
    const idx = Math.round((-this.offset + this.viewport.clientWidth / 2 - this.cellW / 2) / this.step);
    if (idx !== this.lastCell) {
      this.lastCell = idx;
      this.marker.animate(
        [{ transform: 'translateX(-50%) scaleY(1)' },
         { transform: 'translateX(-50%) scaleY(1.12)' },
         { transform: 'translateX(-50%) scaleY(1)' }],
        { duration: 110, easing: 'ease-out' }
      );
    }
  }

  /* ---------------------------------------------------------------- results */

  resetResult() {
    if (!this.resultEl) return;
    this.resultEl.classList.remove('is-hit');
    this.resultEl.innerHTML = `
      <p class="eyebrow">Practice open</p>
      <p class="muted" style="margin:0">
        Open the ${this.tier.name} to see what a feature slot can land on.
        Free, unlimited, reserves nothing.
      </p>`;
  }

  showResult(cell) {
    if (!this.resultEl) return;
    const r = cell.rarity;
    const pct = this.tier.odds[r.id];
    const art = cell.art;
    const lb = this.src.lookbook
      ? ` <a href="${this.src.lookbook}?tag=${r.id}">See all ${r.label} ${this.src.noun}s</a>`
      : '';

    this.resultEl.classList.add('is-hit');
    this.resultEl.innerHTML = `
      <p class="eyebrow">You landed on</p>
      <div style="display:flex;gap:var(--sp-4);align-items:center">
        ${art ? `<span class="item-thumb__frame" style="background:color-mix(in srgb, ${r.color} 16%, var(--paper))">
            <img class="item-thumb__img" src="${art.file}" alt="" width="52" height="52">
          </span>` : ''}
        <span>
          <span class="chip" data-rarity="${r.id}" style="background:color-mix(in srgb, ${r.color} 22%, var(--paper))">
            <span class="dot" style="background:${r.color}"></span>${r.label} &middot; ${pct}% chance
          </span>
          ${art ? `<p style="margin:var(--sp-2) 0 0;font-weight:800;font-size:var(--t-sm)">${art.name}</p>` : ''}
        </span>
      </div>
      <p class="wheel-result__example" style="margin-top:var(--sp-3)">${r.blurb}</p>
      <p class="wheel-result__example">${r.resaleBand}.${lb}</p>
      <p class="sim-note" style="margin-top:var(--sp-3)">
        ${icon('info')}
        <span><b>Landed dead centre.</b> We never drift the marker toward the edge of
        your cell to fake a near miss &mdash; the strip stops exactly on the result that
        was drawn before the animation began.</span>
      </p>`;
    this.resultEl.setAttribute('aria-live', 'polite');
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const reels = Array.from(document.querySelectorAll('[data-reel-scope]'))
    .map((s) => new Reel(s));
  if (!reels.length) return;

  window.SecondSpinReels = reels;

  /* Tier switcher for the card line */
  document.querySelectorAll('[data-card-tier-switch]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-card-tier-value]');
      if (!btn) return;
      const id = btn.dataset.cardTierValue;
      group.querySelectorAll('[data-card-tier-value]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
      reels.forEach((r) => r.setTier && r.setTier(id));
      syncCardBindings(id);
      if (history.replaceState) history.replaceState(null, '', `?tier=${id}`);
    });
  });

  /* Reveal-mode toggle: wheel or reel (clothing product page) */
  document.querySelectorAll('[data-reveal-toggle]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-reveal-mode]');
      if (!btn) return;
      const mode = btn.dataset.revealMode;
      group.querySelectorAll('[data-reveal-mode]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
      document.querySelectorAll('[data-reveal-panel]').forEach((p) => {
        p.hidden = p.dataset.revealPanel !== mode;
      });
      /* The reel measures cell geometry, which is unavailable while hidden. */
      if (mode === 'reel') reels.forEach((r) => r.layout && r.layout());
      try { localStorage.setItem('secondspin.reveal', mode); } catch { /* private mode */ }
    });
  });

  /* Restore the visitor's preferred reveal mode */
  let saved = null;
  try { saved = localStorage.getItem('secondspin.reveal'); } catch { /* ignore */ }
  if (saved) {
    const btn = document.querySelector(`[data-reveal-mode="${saved}"]`);
    if (btn) btn.click();
  }

  const requested = new URLSearchParams(location.search).get('tier');
  if (requested && typeof CARD_TIER_BY_ID !== 'undefined' && CARD_TIER_BY_ID[requested]) {
    const btn = document.querySelector(`[data-card-tier-value="${requested}"]`);
    if (btn) btn.click();
  } else if (document.querySelector('[data-card-bind]')) {
    syncCardBindings(DEFAULT_CARD_TIER);
  }
});

/** Bind the card product page's visible fields from card-data.js. */
function syncCardBindings(tierId) {
  if (typeof CARD_TIER_BY_ID === 'undefined') return;
  const t = CARD_TIER_BY_ID[tierId];
  if (!t) return;
  const set = (k, v) => document.querySelectorAll(`[data-card-bind="${k}"]`)
    .forEach((el) => { el.textContent = v; });

  set('name', t.name);
  set('price', t.priceLabel);
  set('items', t.itemCount);
  set('tagline', t.tagline);
  set('featureSlots', String(t.featureSlots));
  set('ships', t.shipsIn);
  set('odds', cardOddsSentence(t));
  set('standout', `${cardStandoutPerBox(t)}%`);
  set('score', String(t.sustainScore));
  set('grade', t.sustainGrade);

  document.querySelectorAll('[data-card-guarantee]').forEach((el) => {
    el.textContent = t.guarantee || 'No condition guarantee on this tier — it is our entry bulk lot.';
  });
  document.querySelectorAll('[data-card-features]').forEach((el) => {
    el.innerHTML = t.features.map((f) => `<li>${icon('check')}<span>${f}</span></li>`).join('');
  });
  document.querySelectorAll('[data-card-ring]').forEach((el) => {
    el.style.setProperty('--pct', t.sustainScore);
  });

  const list = cardOddsList(t);
  document.querySelectorAll('[data-card-oddsbar]').forEach((el) => {
    el.innerHTML = list.map((r) =>
      `<span class="odds-bar__seg" style="width:${r.pct}%;background:${r.color}" title="${r.label} ${r.pct}%"></span>`).join('');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Odds for one feature slot: ${cardOddsSentence(t)}`);
  });
  document.querySelectorAll('[data-card-oddslegend]').forEach((el) => {
    el.innerHTML = list.map((r) =>
      `<span><span class="dot" style="background:${r.color}"></span>${r.label} ${r.pct}%</span>`).join('');
  });
}
