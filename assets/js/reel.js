/* ==========================================================================
   Second Spin — the reveal reel
   --------------------------------------------------------------------------
   The single reveal mechanic for the whole site: a horizontal strip of real
   catalogue garments scrolls past a centre marker, decelerates, and stops on
   your result.

   This pattern is borrowed from game case-openers, and those are built to
   manipulate. This one is built not to. Four rules:

   1. THE STRIP IS THE ODDS TABLE. Cell counts are apportioned from the
      published percentages by largest-remainder, so a 6% outcome occupies
      exactly 4 of 64 cells. Count them if you like — the UI prints the
      composition. The strip is never salted with extra rares to feel richer.

   2. NO NEAR-MISS. Case-openers habitually decelerate so the marker drifts to
      the very edge of your cell, with a jackpot cell sitting just beyond,
      manufacturing an "so close!" feeling with no basis in the draw. We land
      DEAD CENTRE on the winning cell, every time, and say so on screen.

   3. DRAW FIRST, ANIMATE SECOND. The outcome is resolved before the animation
      starts. Nothing about the scroll can change it, and the winner is placed
      by SWAPPING cells, so the published composition is preserved exactly
      rather than injected into.

   4. FREE AND STAKELESS. Opening this buys nothing and reserves nothing.
   ========================================================================== */

const REEL_CELLS = 64;        // strip length
const REEL_WIN_INDEX = 54;    // where the winning cell comes to rest
const REEL_DURATION = 5200;   // ms

/**
 * Largest-remainder apportionment of `total` cells across an odds table, so
 * the strip's composition matches the published percentages as closely as a
 * whole number of cells allows.
 */
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
    this.btn = scope.querySelector('[data-reel-open]');
    this.resultEl = scope.querySelector('[data-reel-result]');
    this.compEl = scope.querySelector('[data-reel-composition]');
    this.tallyEl = scope.querySelector('[data-reel-tally]');
    this.confettiEl = scope.querySelector('[data-confetti]');
    if (!this.track || !this.viewport) return;

    this.running = false;
    this.offset = 0;
    this.lastCell = -1;
    this.opens = 0;
    this.tally = {};

    /* Trade Up state */
    this.tradeUps = 0;
    this.extraSpend = 0;
    this.tradedAway = [];
    this.poolFrom = null;     // null = base tier odds; else the traded-from id

    this.setTier(scope.dataset.reelTier || DEFAULT_TIER);

    if (this.btn) this.btn.addEventListener('click', () => this.openFreshSlot());
    window.addEventListener('resize', () => this.layout());

    /* Trade Up controls live inside the result panel, which is re-rendered
       after every open, so they are handled by delegation. */
    if (this.resultEl) {
      this.resultEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-trade-up]')) this.tradeUp();
        else if (e.target.closest('[data-keep-it]')) this.keepIt();
      });
    }
  }

  /* ------------------------------------------------------------------ setup */

  setTier(tierId) {
    this.tier = TIER_BY_ID[tierId] || TIER_BY_ID[DEFAULT_TIER];
    this.scope.dataset.reelTier = this.tier.id;
    /* Switching tier abandons any Trade Up in progress. */
    this.tradeUps = 0;
    this.extraSpend = 0;
    this.tradedAway = [];
    this.poolFrom = null;
    this.setPool(tierOddsList(this.tier));
    this.resetResult();
    this.renderTally();
  }

  /** Point the reel at an odds list — base tier odds, or a Trade Up pool. */
  setPool(list) {
    this.pool = list;
    this.counts = apportionCells(
      list.reduce((a, r) => { a[r.id] = r.pct; return a; }, {}),
      list.map((r) => r.id),
      REEL_CELLS
    );
    this.opens = 0;
    this.tally = {};
    this.buildStrip();
    this.renderComposition();
    this.describeStrip();
  }

  currentOdds() {
    return this.pool.reduce((a, r) => { a[r.id] = r.pct; return a; }, {});
  }

  describeStrip() {
    if (!this.viewport) return;
    const sentence = this.pool.map((r) => `${r.label} ${r.pct}%`).join(', ');
    this.viewport.setAttribute('role', 'img');
    this.viewport.setAttribute(
      'aria-label',
      this.poolFrom
        ? `Trade Up strip after giving up a ${RARITIES[this.poolFrom].label}. ` +
          `${REEL_CELLS} cells apportioned from the published Trade Up odds: ${sentence}.`
        : `Reveal strip for the ${this.tier.name}. ${REEL_CELLS} cells apportioned ` +
          `from the published odds: ${sentence}.`
    );
  }

  /** Build the strip. `winnerId` places that outcome at the landing index. */
  buildStrip(winnerId) {
    const cells = [];
    Object.keys(this.counts).forEach((id) => {
      for (let i = 0; i < this.counts[id]; i++) cells.push(id);
    });

    /* Shuffle so identical rarities don't sit in blocks. Counts are untouched. */
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    /* Place the winner by SWAPPING, never inserting — swapping preserves the
       exact published composition of the strip. */
    if (winnerId) {
      const idx = cells.indexOf(winnerId);
      if (idx !== -1) {
        [cells[REEL_WIN_INDEX], cells[idx]] = [cells[idx], cells[REEL_WIN_INDEX]];
      }
    }

    const byId = this.pool.reduce((a, r) => { a[r.id] = r; return a; }, {});
    const catalog = typeof ITEM_CATALOG !== 'undefined' ? ITEM_CATALOG : [];

    this.strip = cells.map((id) => {
      const rarity = byId[id];
      const options = catalog.filter((c) => c.rarity === id);
      const art = options.length
        ? options[Math.floor(Math.random() * options.length)]
        : null;
      return { rarity, art };
    });

    this.track.innerHTML = this.strip.map((cell, i) => `
      <div class="reel__cell" data-rarity="${cell.rarity.id}" data-index="${i}"
           style="--cell-tint:${cell.rarity.color}">
        ${cell.art
          ? `<img class="reel__img" src="${cell.art.file}" alt="" width="64" height="64" decoding="async">`
          : '<span class="reel__blank" aria-hidden="true"></span>'}
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
    const rows = this.pool.map((r) => `
      <span><span class="dot" style="background:${r.color}"></span>${this.counts[r.id]}&times;
      ${r.label} <span class="muted">(${r.pct}%)</span></span>`).join('');
    this.compEl.innerHTML = `
      <p class="muted" style="margin:0 0 var(--sp-2);font-size:var(--t-xs)">
        <b>What's on this strip.</b> ${REEL_CELLS} cells, apportioned from the published
        odds &mdash; count them if you like. We never pad it with extra rare pieces.
      </p>
      <div class="odds-legend">${rows}</div>`;
  }

  /* --------------------------------------------------------------- opening */

  /**
   * The main button always simulates a brand-new feature slot, so if the reel
   * is showing a Trade Up pool it resets to base odds first. Without this, a
   * visitor who traded up would keep opening the upgraded pool for free and
   * read far better odds than they would actually get.
   */
  openFreshSlot() {
    if (this.running) return;
    if (this.poolFrom) this.resetToBaseOdds();
    this.open();
  }

  resetToBaseOdds() {
    this.tradeUps = 0;
    this.extraSpend = 0;
    this.tradedAway = [];
    this.poolFrom = null;
    this.setPool(tierOddsList(this.tier));
    this.renderTally();
  }

  /**
   * Animate to an outcome that has ALREADY been decided and recorded elsewhere
   * — used for real box openings, where account.js resolves and persists the
   * draw before any pixels move. The reel is strictly a presentation layer
   * here; it cannot influence what you got.
   *
   * @param {string} rarityId the recorded outcome
   * @param {object|null} art the specific catalogue garment awarded
   * @returns {Promise} resolves once the strip has landed
   */
  revealOutcome(rarityId, art) {
    return new Promise((resolve) => {
      this.forced = { rarityId, art: art || null };
      this.onLanded = resolve;
      this.open();
    });
  }

  open() {
    if (this.running) return;

    /* 1. Resolve the outcome — unless one was handed to us by a real opening,
          in which case it was drawn and persisted before we were called. */
    const winnerId = this.forced
      ? this.forced.rarityId
      : drawRarity(this.currentOdds(), this.pool.map((r) => r.id));
    if (!winnerId) return;

    /* 2. Rebuild the strip with that outcome at the landing index. */
    this.buildStrip(winnerId);
    const winner = this.strip[REEL_WIN_INDEX];

    /* 3. Offset that centres the winning cell under the marker. Dead centre —
          no drift toward the cell edge, because that is precisely how these
          animations fake a near miss. */
    const target = -(REEL_WIN_INDEX * this.step + this.cellW / 2
                     - this.viewport.clientWidth / 2);

    this.running = true;
    this.scope.classList.add('is-spinning');
    if (this.btn) {
      this.btn.disabled = true;
      this.btn.dataset.label = this.btn.dataset.label || this.btn.textContent;
      this.btn.textContent = 'Opening\u2026';
    }
    if (this.resultEl) {
      this.resultEl.classList.remove('is-hit');
      this.resultEl.innerHTML = '<p class="eyebrow">Opening</p><p class="muted" style="margin:0">Let\u2019s see\u2026</p>';
    }

    const finish = () => {
      this.offset = target;
      this.track.style.transform = `translate3d(${target}px,0,0)`;
      this.running = false;
      this.scope.classList.remove('is-spinning');
      const cell = this.track.children[REEL_WIN_INDEX];
      if (cell) cell.classList.add('is-won');
      if (this.btn) {
        this.btn.disabled = false;
        this.btn.textContent = this.btn.dataset.label || 'Open again';
      }
      /* A real opening supplies the exact garment awarded; a practice open
         just shows a representative one from the catalogue. */
      const art = this.forced ? this.forced.art : winner.art;
      const live = Boolean(this.forced);
      this.forced = null;
      this.recordResult(winner.rarity, art, live);
      if (this.onLanded) { const done = this.onLanded; this.onLanded = null; done(); }
    };

    if (prefersReducedMotion()) { finish(); return; }

    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / REEL_DURATION);
      const eased = 1 - Math.pow(1 - p, 5);          // easeOutQuint
      this.offset = target * eased;
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
    const idx = Math.round(
      (-this.offset + this.viewport.clientWidth / 2 - this.cellW / 2) / this.step
    );
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

  /* -------------------------------------------------------------- trade up */

  /** Move the reel onto the Trade Up pool and open it. */
  tradeUp() {
    if (this.running) return;
    const from = this.lastResult;
    if (!from || !canTradeUpFrom(from.id)) return;
    if (this.tradeUps >= TRADE_UP.maxPerSlot) return;

    const pool = tradeUpPool(this.tier, from.id);
    if (!pool.length) return;

    this.tradeUps += 1;
    this.extraSpend += tradeUpPrice(this.tier);
    this.tradedAway.push(from);
    this.poolFrom = from.id;

    this.setPool(pool);
    this.open();
  }

  /** Decline the offer — just clears the prompt. */
  keepIt() {
    if (!this.resultEl) return;
    const kept = this.resultEl.querySelector('[data-offer]');
    if (kept) kept.remove();
  }

  /**
   * The Trade Up offer, rendered only when the last result is eligible and the
   * cap has not been reached. Shows the exact new odds and the floor guarantee
   * before any money is notionally spent.
   */
  tradeUpOfferHTML(seg) {
    if (!canTradeUpFrom(seg.id)) return '';
    if (this.tradeUps >= TRADE_UP.maxPerSlot) {
      return `<p class="sim-note" data-offer style="margin-top:var(--sp-4)">
        ${icon('info')}
        <span><b>Trade Up already used on this slot.</b> It's capped at
        ${TRADE_UP.maxPerSlot} per feature slot on purpose &mdash; so this can't
        turn into a chase. <a href="faq.html#tradeup">Why we cap it</a></span>
      </p>`;
    }

    const pool = tradeUpPool(this.tier, seg.id);
    if (!pool.length) return '';
    const floor = tradeUpFloor(this.tier, seg.id);
    const fee = formatMoney(tradeUpPrice(this.tier));

    return `
      <div data-offer style="margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:2px dashed var(--paper-line)">
        <p class="eyebrow" style="margin-bottom:var(--sp-2)">Not what you hoped for?</p>
        <p style="margin:0 0 var(--sp-3);font-size:var(--t-sm)">
          <b>Trade it up for ${fee}</b> (10% of the box). You give up the
          ${seg.label} and draw again from a pool with it &mdash; and everything
          below it &mdash; removed.
        </p>
        <div class="odds-bar" role="img" aria-label="Trade Up odds: ${pool.map((r) => `${r.label} ${r.pct}%`).join(', ')}">
          ${pool.map((r) => `<span class="odds-bar__seg" data-rarity="${r.id}" style="width:${r.pct}%" title="${r.label} ${r.pct}%"></span>`).join('')}
        </div>
        <div class="odds-legend" style="margin-top:var(--sp-3)">
          ${pool.map((r) => `<span><span class="dot" data-rarity="${r.id}" style="background:${r.color}"></span>${r.label} ${r.pct}%</span>`).join('')}
        </div>
        <p class="pill pill--sage" style="margin:var(--sp-3) 0">
          ${icon('shield')} Guaranteed upgrade &mdash; worst case is ${floor.label}
        </p>
        <p class="muted" style="margin:0 0 var(--sp-3);font-size:var(--t-xs)">
          You cannot land lower than what you traded, so there is nothing to lose
          and nothing to chase. Vintage Rare is never a Trade Up outcome &mdash;
          it's too scarce to sell a shortcut to. The ${seg.label} you give up goes
          back into our pool for another box, not in a bin.
        </p>
        <div class="cluster">
          <button class="btn btn--sun" type="button" data-trade-up>Trade up for ${fee}</button>
          <button class="link-btn" type="button" data-keep-it>Keep the ${seg.label}</button>
        </div>
      </div>`;
  }

  /** Running ledger of Trade Up spend, so the total is never hidden. */
  ledgerHTML() {
    if (!this.tradeUps) return '';
    const given = this.tradedAway.map((r) => r.label).join(', ');
    return `
      <p class="muted" style="margin:var(--sp-3) 0 0;font-size:var(--t-xs)">
        <b>Trade Up ledger:</b> ${this.tradeUps} used &middot;
        ${formatMoney(this.extraSpend)} extra &middot; gave up ${given}
        (re-circulated, not discarded) &middot; box total
        ${formatMoney(this.tier.price + this.extraSpend)}.
        <br>Press <b>Open</b> for a fresh slot at base odds.
      </p>`;
  }

  /* ---------------------------------------------------------------- results */

  resetResult() {
    if (!this.resultEl) return;
    this.resultEl.classList.remove('is-hit');
    this.resultEl.innerHTML = `
      <p class="eyebrow">Practice open</p>
      <p class="muted" style="margin:0">
        Open it to see what the ${this.tier.name} feature slot can land on.
        Free, unlimited, and it doesn't reserve anything.
      </p>`;
  }

  recordResult(seg, art, live) {
    this.opens += 1;
    this.tally[seg.id] = (this.tally[seg.id] || 0) + 1;
    this.lastResult = seg;
    this.renderTally();

    /* A real opening is already banked, so it must not offer a free practice
       Trade Up or claim to be a simulator. */
    if (live) {
      if (this.resultEl) {
        this.resultEl.classList.add('is-hit');
        this.resultEl.innerHTML = `
          <p class="eyebrow">Your feature slot</p>
          <div style="display:flex;gap:var(--sp-4);align-items:center;flex-wrap:wrap">
            ${art ? `<span class="item-thumb__frame" style="background:color-mix(in srgb, ${seg.color} 16%, var(--paper))">
                <img class="item-thumb__img" src="${art.file}" width="52" height="52"
                     alt="Pixel-art illustration of a ${art.colourway.toLowerCase()} ${art.typeLabel.toLowerCase()}">
              </span>` : ''}
            <span>
              <span class="chip" data-rarity="${seg.id}">
                <span class="dot" data-rarity="${seg.id}" style="background:${seg.color}"></span>
                ${seg.label} &middot; ${seg.pct}% chance
              </span>
              ${art ? `<p style="margin:var(--sp-2) 0 0;font-weight:800;font-size:var(--t-sm)">${art.name}</p>` : ''}
            </span>
          </div>
          <p class="reveal-result__example" style="margin-top:var(--sp-3)">${seg.blurb}</p>
          <p class="reveal-result__example">${seg.resaleBand}. This is yours &mdash; it's in your vault.</p>`;
        this.resultEl.setAttribute('aria-live', 'polite');
      }
      if (seg.id === 'rare' || seg.id === 'designer') this.fireConfetti(seg.color);
      return;
    }

    if (this.resultEl) {
      const traded = this.tradeUps > 0;
      this.resultEl.classList.add('is-hit');
      this.resultEl.innerHTML = `
        <p class="eyebrow">${traded ? 'After trading up, you landed on' : 'You landed on'}</p>
        <div style="display:flex;gap:var(--sp-4);align-items:center;flex-wrap:wrap">
          ${art ? `<span class="item-thumb__frame" style="background:color-mix(in srgb, ${seg.color} 16%, var(--paper))">
              <img class="item-thumb__img" src="${art.file}" width="52" height="52"
                   alt="Pixel-art illustration of a ${art.colourway.toLowerCase()} ${art.typeLabel.toLowerCase()}">
            </span>` : ''}
          <span>
            <span class="chip" data-rarity="${seg.id}">
              <span class="dot" data-rarity="${seg.id}" style="background:${seg.color}"></span>
              ${seg.label} &middot; ${seg.pct}% chance
            </span>
            ${art ? `<p style="margin:var(--sp-2) 0 0;font-weight:800;font-size:var(--t-sm)">${art.name}</p>` : ''}
          </span>
        </div>
        <p class="reveal-result__example" style="margin-top:var(--sp-3)">${seg.blurb}</p>
        <p class="reveal-result__example">
          ${seg.resaleBand}.${art ? ` One of
          <a href="lookbook.html?tag=${seg.id}">${itemsByRarity(seg.id).length} ${seg.label} pieces</a>
          in the catalogue.` : ''}
        </p>
        <p class="sim-note" style="margin-top:var(--sp-3)">
          ${icon('info')}
          <span><b>Landed dead centre.</b> We never drift the marker toward the edge of
          your cell to fake a near miss &mdash; the strip stops exactly on the outcome
          that was drawn before the animation began.</span>
        </p>
        ${this.ledgerHTML()}
        ${this.tradeUpOfferHTML(seg)}`;
      this.resultEl.setAttribute('aria-live', 'polite');
    }

    if (seg.id === 'rare' || seg.id === 'designer') this.fireConfetti(seg.color);
  }

  renderTally() {
    if (!this.tallyEl) return;
    if (!this.opens) {
      this.tallyEl.innerHTML = `<p class="muted" style="margin:0">
        Open it a few times and we\u2019ll show your results next to the published odds,
        so you can check the reel behaves.</p>`;
      return;
    }
    const rows = this.pool.map((r) => {
      const got = this.tally[r.id] || 0;
      const observed = ((got / this.opens) * 100).toFixed(0);
      return `<tr>
        <td><span class="chip" data-rarity="${r.id}"><span class="dot" data-rarity="${r.id}" style="background:${r.color}"></span>${r.label}</span></td>
        <td>${got}</td>
        <td>${observed}% <span class="muted">/ ${r.pct}%</span></td>
      </tr>`;
    }).join('');

    this.tallyEl.innerHTML = `
      <table class="odds-table">
        <caption>Your ${this.opens} open${this.opens > 1 ? 's' : ''}: observed rate vs published rate. Small samples wander \u2014 that\u2019s how probability works.</caption>
        <thead><tr><th scope="col">Outcome</th><th scope="col">Hits</th><th scope="col">Yours / ours</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  fireConfetti(color) {
    if (!this.confettiEl || prefersReducedMotion()) return;
    const palette = [color, '#f4b429', '#e4572e', '#3c7a4e', '#3e9bc0', '#f7f2e6'];
    this.confettiEl.classList.remove('is-firing');
    this.confettiEl.innerHTML = Array.from({ length: 34 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 150;
      const rot = `${Math.random() * 720 - 360}deg`;
      const bg = palette[Math.floor(Math.random() * palette.length)];
      return `<span style="--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;--rot:${rot};background:${bg}"></span>`;
    }).join('');
    void this.confettiEl.offsetWidth;
    this.confettiEl.classList.add('is-firing');
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const reels = Array.from(document.querySelectorAll('[data-reel-scope]'))
    .map((scope) => new Reel(scope));

  /* Exposed for debugging and automated testing: inspect strip composition,
     force a tier, or verify cell counts against the published odds. */
  window.SecondSpin = { reels, TIERS, RARITIES, drawRarity, OddsModal };
});
