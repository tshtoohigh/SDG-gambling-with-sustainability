/* ==========================================================================
   Second Spin — The Wheel
   --------------------------------------------------------------------------
   Design rules this file is built around:

   1. HONEST GEOMETRY. Segment arcs are computed directly from the tier's
      published odds table. A 2% outcome gets 2% of the circle. There is no
      visual inflation of rare slices and no near-miss weighting.
   2. DRAW FIRST, ANIMATE SECOND. The outcome is drawn with a weighted RNG
      *before* the animation starts; the spin is only a visualisation of a
      decision already made. Nothing about the animation can change it.
   3. NO STAKES. Spinning is free, reserves nothing, and is not the purchase
      draw. Copy in the UI states this plainly.
   4. SELF-AUDITING. A running tally compares what the visitor actually
      rolled against the published odds, so the maths is checkable in situ.
   ========================================================================== */

class Wheel {
  constructor(scope) {
    this.scope   = scope;
    this.stage   = scope.querySelector('[data-wheel-stage]');
    this.canvas  = scope.querySelector('[data-wheel-canvas]');
    this.spinBtn = scope.querySelector('[data-wheel-spin]');
    this.resultEl = scope.querySelector('[data-wheel-result]');
    this.tallyEl  = scope.querySelector('[data-wheel-tally]');
    this.confettiEl = scope.querySelector('[data-confetti]');

    if (!this.canvas || !this.stage) return;

    this.ctx = this.canvas.getContext('2d');
    this.rotation = -Math.PI / 2;   // start with a segment boundary up top
    this.spinning = false;
    this.tally = {};
    this.spins = 0;
    this.lastSegIndex = -1;

    /* Trade Up state */
    this.tradeUps = 0;          // how many this slot has used (capped)
    this.extraSpend = 0;        // running fee total, shown to the visitor
    this.tradedAway = [];       // outcomes given up, for the ledger
    this.poolFrom = null;       // null = base tier odds; else the traded-from id

    this.setTier(scope.dataset.wheelTier || DEFAULT_TIER);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.spinBtn) {
      this.spinBtn.addEventListener('click', () => this.spinFreshSlot());
    }

    /* Trade Up controls live inside the result panel, which is re-rendered
       after every spin, so they are handled by delegation. */
    if (this.resultEl) {
      this.resultEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-trade-up]')) this.tradeUp();
        else if (e.target.closest('[data-keep-it]')) this.keepIt();
      });
    }
  }

  /* ---------------------------------------------------------------- setup */

  /**
   * Lay out wheel segments from a list of {id, label, color, pct}.
   * Arc angles are derived from `pct`, so the geometry always matches the
   * published number — this is what keeps the wheel honest, and it holds for
   * Trade Up pools exactly as it does for base tier odds.
   */
  setSegments(list) {
    let angle = 0;
    this.segments = list.map((r) => {
      const arc = (r.pct / 100) * Math.PI * 2;
      const seg = { ...r, start: angle, arc, end: angle + arc };
      angle += arc;
      return seg;
    });
  }

  /** The odds actually used for the next draw: whatever is on the wheel now. */
  currentOdds() {
    return this.segments.reduce((acc, s) => { acc[s.id] = s.pct; return acc; }, {});
  }

  oddsSentence() {
    return this.segments.map((s) => `${s.label} ${s.pct}%`).join('  \u00b7  ');
  }

  setTier(tierId) {
    this.tier = TIER_BY_ID[tierId] || TIER_BY_ID[DEFAULT_TIER];
    this.scope.dataset.wheelTier = this.tier.id;

    /* Switching tier abandons any Trade Up in progress. */
    this.tradeUps = 0;
    this.extraSpend = 0;
    this.tradedAway = [];
    this.poolFrom = null;

    this.setSegments(tierOddsList(this.tier));
    this.describeCanvas();

    this.tally = {};
    this.spins = 0;
    this.renderTally();
    this.resetResult();
    this.draw();
  }

  describeCanvas() {
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute(
      'aria-label',
      this.poolFrom
        ? `Trade Up wheel for the ${this.tier.name}, after giving up a ` +
          `${RARITIES[this.poolFrom].label}. Segment sizes match the published ` +
          `Trade Up odds: ${this.oddsSentence()}.`
        : `Odds wheel for the ${this.tier.name}. Segment sizes match the ` +
          `published odds: ${tierOddsSentence(this.tier)}.`
    );
  }

  /* -------------------------------------------------------------- trade up */

  /** Move the wheel onto the Trade Up pool and spin it. */
  tradeUp() {
    if (this.spinning) return;
    const from = this.lastResult;
    if (!from || !canTradeUpFrom(from.id)) return;
    if (this.tradeUps >= TRADE_UP.maxPerSlot) return;

    const pool = tradeUpPool(this.tier, from.id);
    if (!pool.length) return;

    this.tradeUps += 1;
    this.extraSpend += tradeUpPrice(this.tier);
    this.tradedAway.push(from);
    this.poolFrom = from.id;

    this.setSegments(pool);
    this.describeCanvas();
    this.tally = {};
    this.spins = 0;
    this.draw();
    this.spin();
  }

  /** Decline the offer — just clears the prompt. */
  keepIt() {
    if (!this.resultEl) return;
    const kept = this.resultEl.querySelector('[data-offer]');
    if (kept) kept.remove();
  }

  /**
   * The main Spin button always simulates a brand-new feature slot, so if the
   * wheel is currently showing a Trade Up pool it resets to base odds first.
   * Without this, a visitor who traded up would keep spinning the upgraded
   * pool for free and read far better odds than they would actually get.
   */
  spinFreshSlot() {
    if (this.spinning) return;
    if (this.poolFrom) this.resetToBaseOdds();
    this.spin();
  }

  resetToBaseOdds() {
    this.tradeUps = 0;
    this.extraSpend = 0;
    this.tradedAway = [];
    this.poolFrom = null;
    this.setSegments(tierOddsList(this.tier));
    this.describeCanvas();
    this.tally = {};
    this.spins = 0;
    this.renderTally();
    this.draw();
  }

  /**
   * The Trade Up offer, rendered only when the last result is eligible and
   * the cap has not been reached. Shows the exact new odds and the floor
   * guarantee before any money is notionally spent.
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

  /**
   * A representative catalogue garment for the outcome just landed on, so the
   * rarity label means something concrete rather than being an abstract word.
   * Degrades silently if item-catalog.js isn't loaded on this page.
   */
  sampleItemHTML(seg) {
    if (typeof ITEM_CATALOG === 'undefined' || typeof itemsByRarity !== 'function') return '';
    const pool = itemsByRarity(seg.id);
    if (!pool.length) return '';
    const item = pickOne(pool);
    return `
      <div class="item-thumb">
        <span class="item-thumb__frame" style="background:color-mix(in srgb, ${seg.color} 16%, var(--paper))">
          <img class="item-thumb__img" src="${item.file}" width="48" height="48"
               alt="Pixel-art illustration of a ${item.colourway.toLowerCase()} ${item.typeLabel.toLowerCase()}">
        </span>
        <span class="item-thumb__body">
          <b>${item.name}</b>
          ${item.colourway} &middot; ${item.pattern} &mdash; one of
          <a href="lookbook.html?tag=${seg.id}">${pool.length} ${seg.label} pieces</a>
          in the catalogue.
        </span>
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
        <br>Press <b>Spin</b> for a fresh slot at base odds.
      </p>`;
  }

  resize() {
    const size = Math.round(this.stage.clientWidth);
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = size;
    this.draw();
  }

  /* --------------------------------------------------------------- drawing */

  draw() {
    const ctx = this.ctx;
    const size = this.size;
    if (!ctx || !size) return;

    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 6;
    const rFace = rOuter - 9;

    ctx.clearRect(0, 0, size, size);

    /* Outer rim */
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fillStyle = '#16241b';
    ctx.fill();

    /* Segments */
    this.segments.forEach((seg) => {
      const a0 = seg.start + this.rotation;
      const a1 = seg.end + this.rotation;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rFace, a0, a1);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      /* Divider line — only worth drawing when the slice is wide enough
         that the stroke won't visually swallow it. */
      if (seg.arc > 0.04) {
        ctx.strokeStyle = 'rgba(22,36,27,0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      this.drawLabel(seg, cx, cy, rFace);
    });

    /* Rim bulbs for arcade energy */
    const bulbs = 24;
    for (let i = 0; i < bulbs; i++) {
      const a = (i / bulbs) * Math.PI * 2 + this.rotation;
      const bx = cx + Math.cos(a) * (rOuter - 4.5);
      const by = cy + Math.sin(a) * (rOuter - 4.5);
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#f4b429' : '#f7f2e6';
      ctx.fill();
    }
  }

  drawLabel(seg, cx, cy, rFace) {
    const ctx = this.ctx;
    const twoPi = Math.PI * 2;
    const mid = seg.start + seg.arc / 2 + this.rotation;
    const wide = seg.arc > 0.3;          // enough room for the full name
    const medium = seg.arc > 0.14;       // room for a percentage only

    /* Segments on the left half of the wheel would render mirrored, so we
       rotate them a further 180° and anchor from the other side. Keeps every
       label the right way up however far the wheel has turned. */
    const norm = ((mid % twoPi) + twoPi) % twoPi;
    const flip = norm > Math.PI / 2 && norm < (Math.PI * 3) / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    if (flip) ctx.rotate(Math.PI);
    ctx.textAlign = flip ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = seg.textOn;

    const scale = this.size / 420;
    const family = getComputedStyle(document.body).fontFamily;
    const x = flip ? -(rFace - 16 * scale) : rFace - 16 * scale;
    const sy = flip ? -1 : 1;            // keep multi-line order visually stable

    if (wide) {
      ctx.font = `800 ${Math.max(10, 13 * scale)}px ${family}`;
      const words = seg.label.split(' ');
      if (words.length > 1 && seg.arc < 0.62) {
        // Two short lines so long names fit in mid-size slices
        ctx.fillText(words[0], x, -8 * scale * sy);
        ctx.fillText(words.slice(1).join(' '), x, 6 * scale * sy);
        ctx.font = `700 ${Math.max(9, 11 * scale)}px ${family}`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(`${seg.pct}%`, x, 20 * scale * sy);
      } else {
        ctx.fillText(seg.label, x, -6 * scale * sy);
        ctx.font = `700 ${Math.max(9, 11 * scale)}px ${family}`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(`${seg.pct}%`, x, 9 * scale * sy);
      }
    } else if (medium) {
      ctx.font = `800 ${Math.max(9, 11 * scale)}px ${family}`;
      ctx.fillText(`${seg.pct}%`, x, 0);
    } else {
      /* Thin slice: a tick mark on the face, so the true (small) size stays
         visible and honest rather than being padded out to fit a label. */
      ctx.strokeStyle = seg.textOn;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(flip ? -(rFace - 4) : rFace - 4, 0);
      ctx.lineTo(x, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------- spinning */

  spin() {
    if (this.spinning) return;

    /* 1. Decide the outcome up front, from whatever table is on the wheel —
          the base tier odds, or a Trade Up pool. Either way the draw uses the
          same percentages the segments were drawn from. */
    const rarityId = drawRarity(this.currentOdds());
    const segIndex = this.segments.findIndex((s) => s.id === rarityId);
    const seg = this.segments[segIndex];

    /* 2. Pick a random resting point inside that segment (inset a touch so
          the pointer never sits ambiguously on a boundary). */
    const inset = Math.min(seg.arc * 0.2, 0.05);
    const targetLocal = seg.start + inset + Math.random() * (seg.arc - inset * 2);

    /* 3. Work out the rotation that puts targetLocal under the top pointer. */
    const pointerAngle = -Math.PI / 2;
    const desired = pointerAngle - targetLocal;
    const twoPi = Math.PI * 2;
    const current = this.rotation;
    let delta = (desired - current) % twoPi;
    if (delta < 0) delta += twoPi;
    const turns = 4 + Math.floor(Math.random() * 2);
    const finalRotation = current + turns * twoPi + delta;

    this.spinning = true;
    this.stage.classList.add('is-spinning');
    if (this.spinBtn) {
      this.spinBtn.disabled = true;
      this.spinBtn.dataset.label = this.spinBtn.textContent;
      this.spinBtn.textContent = 'Spinning…';
    }
    this.setResultPending();

    const finish = () => {
      this.rotation = finalRotation % twoPi;
      this.draw();
      this.spinning = false;
      this.stage.classList.remove('is-spinning');
      if (this.spinBtn) {
        this.spinBtn.disabled = false;
        this.spinBtn.textContent = this.spinBtn.dataset.label || 'Spin again';
      }
      this.recordResult(seg);
    };

    if (prefersReducedMotion()) { finish(); return; }

    const duration = 4200;
    const startTime = performance.now();
    const startRotation = current;
    const distance = finalRotation - current;

    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 4);          // easeOutQuart
      this.rotation = startRotation + distance * eased;
      this.draw();
      this.tickPointer();
      if (p < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }

  /** Nudge the pointer each time a segment boundary passes under it. */
  tickPointer() {
    const pointer = this.scope.querySelector('[data-wheel-pointer]');
    if (!pointer) return;
    const twoPi = Math.PI * 2;
    let local = (-Math.PI / 2 - this.rotation) % twoPi;
    if (local < 0) local += twoPi;
    const idx = this.segments.findIndex((s) => local >= s.start && local < s.end);
    if (idx !== this.lastSegIndex) {
      this.lastSegIndex = idx;
      pointer.animate(
        [
          { transform: 'translateX(-50%) rotate(0deg)' },
          { transform: 'translateX(-50%) rotate(-13deg)' },
          { transform: 'translateX(-50%) rotate(0deg)' },
        ],
        { duration: 130, easing: 'ease-out' }
      );
    }
  }

  /* ---------------------------------------------------------------- results */

  resetResult() {
    if (!this.resultEl) return;
    this.resultEl.classList.remove('is-hit');
    this.resultEl.innerHTML = `
      <p class="eyebrow">Practice spin</p>
      <p class="muted" style="margin:0">
        Give it a spin to see what the ${this.tier.name} feature slot can land on.
        Free, unlimited, and it doesn't reserve anything.
      </p>`;
  }

  setResultPending() {
    if (!this.resultEl) return;
    this.resultEl.classList.remove('is-hit');
    this.resultEl.innerHTML = `<p class="eyebrow">Spinning</p><p class="muted" style="margin:0">Let\u2019s see\u2026</p>`;
  }

  recordResult(seg) {
    this.spins += 1;
    this.tally[seg.id] = (this.tally[seg.id] || 0) + 1;
    this.lastResult = seg;
    this.renderTally();

    if (this.resultEl) {
      const example = pickOne(seg.examples);
      const traded = this.tradeUps > 0;
      this.resultEl.classList.add('is-hit');
      this.resultEl.innerHTML = `
        <p class="eyebrow">${traded ? 'After trading up, you landed on' : 'You landed on'}</p>
        <span class="chip" data-rarity="${seg.id}" style="align-self:flex-start">
          <span class="dot" data-rarity="${seg.id}" style="background:${seg.color}"></span>
          ${seg.label} &middot; ${seg.pct}% chance
        </span>
        <p class="wheel-result__rarity">${seg.label}</p>
        <p class="wheel-result__example">${seg.blurb}</p>
        <p class="wheel-result__example" style="margin-top:var(--sp-3)">
          <b>A real one from last month:</b> ${example} &mdash; ${seg.resaleBand}.
        </p>
        ${this.sampleItemHTML(seg)}
        ${this.ledgerHTML()}
        ${this.tradeUpOfferHTML(seg)}`;
      this.resultEl.setAttribute('aria-live', 'polite');
    }

    if (seg.id === 'rare' || seg.id === 'designer') this.fireConfetti(seg.color);
  }

  renderTally() {
    if (!this.tallyEl) return;
    if (!this.spins) {
      this.tallyEl.innerHTML = `<p class="muted" style="margin:0">
        Spin a few times and we\u2019ll show your results next to the published odds,
        so you can check the wheel behaves.</p>`;
      return;
    }
    const rows = this.segments.map((seg) => {
      const got = this.tally[seg.id] || 0;
      const observed = ((got / this.spins) * 100).toFixed(0);
      return `<tr>
        <td><span class="chip" data-rarity="${seg.id}"><span class="dot" data-rarity="${seg.id}" style="background:${seg.color}"></span>${seg.label}</span></td>
        <td>${got}</td>
        <td>${observed}% <span class="muted">/ ${seg.pct}%</span></td>
      </tr>`;
    }).join('');

    this.tallyEl.innerHTML = `
      <table class="odds-table">
        <caption>Your ${this.spins} spin${this.spins > 1 ? 's' : ''}: observed rate vs published rate. Small samples wander \u2014 that\u2019s how probability works.</caption>
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
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const rot = `${Math.random() * 720 - 360}deg`;
      const bg = palette[Math.floor(Math.random() * palette.length)];
      return `<span style="--dx:${dx}px;--dy:${dy}px;--rot:${rot};background:${bg}"></span>`;
    }).join('');
    void this.confettiEl.offsetWidth;
    this.confettiEl.classList.add('is-firing');
  }
}

/* --------------------------------------------------------------------------
   Boot every wheel on the page + wire tier switchers
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const wheels = Array.from(document.querySelectorAll('[data-wheel-scope]'))
    .map((scope) => new Wheel(scope));

  /* Exposed for debugging and automated testing: inspect segment geometry,
     force a tier, or verify the drawn arcs match the published odds. */
  window.SecondSpin = { wheels, TIERS, RARITIES, drawRarity, OddsModal };

  /* Tier switcher (product page): repoint the wheel and every bound field. */
  document.querySelectorAll('[data-tier-switch]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tier-value]');
      if (!btn) return;
      const tierId = btn.dataset.tierValue;

      group.querySelectorAll('[data-tier-value]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });

      wheels.forEach((w) => w.setTier && w.setTier(tierId));
      syncTierBindings(tierId);

      if (history.replaceState) {
        history.replaceState(null, '', `?tier=${tierId}`);
      }
    });
  });

  /* Deep link: box.html?tier=premium */
  const params = new URLSearchParams(location.search);
  const requested = params.get('tier');
  if (requested && TIER_BY_ID[requested]) {
    const btn = document.querySelector(`[data-tier-value="${requested}"]`);
    if (btn) btn.click();
  } else if (document.querySelector('[data-tier-bind]')) {
    syncTierBindings(DEFAULT_TIER);
  }
});

/* --------------------------------------------------------------------------
   Bind tier fields on the product page. Every visible number comes from
   site-data.js, so the page cannot advertise odds the wheel doesn't use.
   -------------------------------------------------------------------------- */
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

  /* Odds bar + legend, regenerated from the same table the wheel uses. */
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

  document.querySelectorAll('[data-tier-guarantee]').forEach((el) => {
    el.textContent = tier.guarantee || 'No condition guarantee on this tier — it is our most affordable rescue box.';
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
}
