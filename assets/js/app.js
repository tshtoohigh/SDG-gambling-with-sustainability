/* ==========================================================================
   Second Spin — Shared behaviour
   Progressive enhancement only: every page is readable and navigable with
   JavaScript disabled. This file adds nav, cart, reveals, the impact
   counter and the odds-disclosure modal on top of working HTML.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Icons
   -------------------------------------------------------------------------- */
const ICONS = {
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20c0-8 5-14 16-15 1 11-5 16-13 16H4z"/><path d="M4 20c3-5 7-8 12-9"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.2l2.3 11.2A2 2 0 0 0 9.5 17h8.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.6L19.5 9l-4.6 3.1L16 18l-4-3-4 3 1.1-5.9L4.5 9l5.7-1.4z"/></svg>`,
  hanger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 7v2.4L3.5 15.4A1.6 1.6 0 0 0 4.4 18h15.2a1.6 1.6 0 0 0 .9-2.6L12 9.4"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7h11v9H2zM13 10h4.6l2.9 3v3H13"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 2.5V12c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V5.5z"/><path d="m9 12 2 2 4-4"/></svg>`,
  recycle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 8.5 10 4.6a2.3 2.3 0 0 1 4 0l1.4 2.3"/><path d="m16.8 10.4 2.4 4.1a2.3 2.3 0 0 1-2 3.5h-2.7"/><path d="M9.5 18H6.8a2.3 2.3 0 0 1-2-3.5l1.3-2.2"/><path d="m5 10 2.5 2.3L10 10M14 5.6l.6 3.4 3.3-.9M12 20.4l2.6-2.4-2.4-2.5"/></svg>`,
  store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16v11H4zM3 9l2-5h14l2 5"/><path d="M10 20v-6h4v6"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16M7 20h10M6 8h12M6 8 3 14h6zM18 8l-3 6h6z"/></svg>`,
  question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3M12 17h.01"/></svg>`,
  tshirt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 4 5.5l1.6 4L8 9v11h8V9l2.4.5 1.6-4L15 3a3 3 0 0 1-6 0z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21 19H3zM12 9.5V14M12 16.8h.01"/></svg>`,
};

function icon(name, cls) {
  const svg = ICONS[name] || '';
  return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
}

/* --------------------------------------------------------------------------
   Small utilities
   -------------------------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------------
   Mobile nav
   -------------------------------------------------------------------------- */
function initNav() {
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = open ? icon('close') : icon('menu');
  };

  toggle.innerHTML = icon('menu');
  toggle.addEventListener('click', () =>
    setOpen(!nav.classList.contains('is-open'))
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  // Reset when resizing back up to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  });
}

/* --------------------------------------------------------------------------
   Scroll reveal (staggered)
   -------------------------------------------------------------------------- */
function initReveal() {
  const items = $$('.reveal');
  if (!items.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const group = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal')) : [el];
        const idx = group.indexOf(el);
        el.style.setProperty('--delay', `${Math.max(0, idx) * 70}ms`);
        el.classList.add('is-in');
        io.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Impact counters
   -------------------------------------------------------------------------- */
function animateCount(el, to, duration = 1500) {
  const decimals = Number(el.dataset.decimals || 0);
  const render = (v) =>
    (el.textContent = decimals
      ? v.toFixed(decimals)
      : formatNumber(v));

  if (prefersReducedMotion()) { render(to); return; }

  const start = performance.now();
  const from = 0;
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
    render(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const counters = $$('[data-count-to]');
  if (!counters.length) return;

  const run = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    animateCount(el, Number(el.dataset.countTo));
  };

  if (!('IntersectionObserver' in window)) { counters.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  counters.forEach((el) => io.observe(el));

  /* Prototype-only "live" tick so the counter visibly moves. In production
     this would be a websocket/poll against the fulfilment DB. The Impact
     page discloses that this figure is simulated in the demo. */
  const live = $('[data-live-lbs]');
  if (live && !prefersReducedMotion()) {
    let total = IMPACT.lbsDiverted;
    setInterval(() => {
      total += IMPACT.liveDrip.lbs;
      live.textContent = formatNumber(total);
      live.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' }
      );
    }, IMPACT.liveDrip.everyMs);
  }
}

/* --------------------------------------------------------------------------
   Odds disclosure modal — reusable, built from TIERS data
   -------------------------------------------------------------------------- */
const OddsModal = (() => {
  let root = null;
  let lastFocus = null;

  function build() {
    root = document.createElement('div');
    root.className = 'modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'odds-modal-title');
    root.innerHTML = `
      <div class="modal__panel" data-panel>
        <div class="modal__head">
          <div>
            <p class="eyebrow">${icon('info')} Full odds disclosure</p>
            <h2 id="odds-modal-title" style="font-size:var(--t-xl)">Odds breakdown</h2>
          </div>
          <button class="modal__close" type="button" data-close aria-label="Close odds breakdown">${icon('close')}</button>
        </div>
        <div data-content></div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('is-open')) close();
      if (e.key === 'Tab' && root.classList.contains('is-open')) trapFocus(e);
    });
  }

  function trapFocus(e) {
    const focusables = $$('button, a[href], input, [tabindex]:not([tabindex="-1"])', root)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function tableFor(tier) {
    const rows = tierOddsList(tier).map((r) => `
      <tr>
        <td>
          <span class="chip" data-rarity="${r.id}"><span class="dot" data-rarity="${r.id}"></span>${r.label}</span>
        </td>
        <td class="odds-row__bar">
          <span class="meter"><span class="meter__fill" style="width:${r.pct}%;background:${r.color}"></span></span>
        </td>
        <td>${r.pct}%</td>
      </tr>`).join('');

    const zeroed = RARITY_ORDER.filter((id) => (tier.odds[id] || 0) === 0);

    return `
      <p class="muted" style="margin-bottom:var(--sp-4)">
        These are the published odds for <b>one feature slot</b> in a
        <b>${tier.name}</b>. The ${tier.name} has
        <b>${tier.featureSlots} feature slot${tier.featureSlots > 1 ? 's' : ''}</b>
        plus ${tier.everydaySlots} everyday pieces.
      </p>
      <table class="odds-table">
        <caption>Per-slot probability. Wheel segment sizes are drawn to exactly match these numbers.</caption>
        <thead>
          <tr><th scope="col">Outcome</th><th scope="col"><span class="visually-hidden">Share</span></th><th scope="col">Chance</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td>100%</td></tr></tfoot>
      </table>
      ${zeroed.length ? `<p class="muted" style="margin-top:var(--sp-3)">
        Never appears in a ${tier.name} feature slot:
        ${zeroed.map((id) => RARITIES[id].label).join(', ')}.</p>` : ''}
      <div class="sim-note" style="margin-top:var(--sp-5)">
        ${icon('info')}
        <span>
          <b>How we keep this honest.</b> The reel is a visualiser, not the draw.
          Cell counts are generated directly from the table above, so a 6% outcome
          occupies exactly 4 of the strip's 64 cells &mdash; no padding with extra rares,
          no near-miss drift, no "open again" upsell. Opening it costs nothing and
          reserves nothing.
          Your actual box is assembled by a human sorter against these same ratios, and
          we publish the realised monthly hit-rate on our
          <a href="impact.html#receipts">Impact page</a>.
        </span>
      </div>
      <p class="muted" style="margin-top:var(--sp-4)">
        Odds last changed 1 Sept 2026. We version this table and never lower
        published odds on an order you have already placed.
      </p>`;
  }

  function open(tierId) {
    if (!root) build();
    const tier = TIER_BY_ID[tierId] || TIER_BY_ID[DEFAULT_TIER];
    $('[data-content]', root).innerHTML = tableFor(tier);
    $('#odds-modal-title', root).textContent = `${tier.name} — odds breakdown`;
    lastFocus = document.activeElement;
    root.classList.add('is-open');
    document.body.classList.add('is-locked');
    $('[data-close]', root).focus();
  }

  function close() {
    if (!root) return;
    root.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus();
  }

  return { open, close };
})();

function initOddsTriggers() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-odds-modal]');
    if (!trigger) return;
    e.preventDefault();
    OddsModal.open(trigger.dataset.oddsModal);
  });
}

/* --------------------------------------------------------------------------
   Tier card rendering (odds bar, legend, sustainability badge)
   Static HTML holds readable fallbacks; these overwrite from TIERS so the
   numbers can never drift from the source of truth.
   -------------------------------------------------------------------------- */
function renderTierWidgets() {
  $$('[data-tier-widgets]').forEach((scope) => {
    const tier = TIER_BY_ID[scope.dataset.tierWidgets];
    if (!tier) return;
    const list = tierOddsList(tier);

    const bar = $('[data-odds-bar]', scope);
    if (bar) {
      bar.innerHTML = list
        .map((r) => `<span class="odds-bar__seg" data-rarity="${r.id}" style="width:${r.pct}%" title="${r.label} ${r.pct}%"></span>`)
        .join('');
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', `Odds for one feature slot: ${tierOddsSentence(tier)}`);
    }

    const legend = $('[data-odds-legend]', scope);
    if (legend) {
      legend.innerHTML = list
        .map((r) => `<span><span class="dot" data-rarity="${r.id}" style="background:${r.color}"></span>${r.label} ${r.pct}%</span>`)
        .join('');
    }

    const text = $('[data-odds-text]', scope);
    if (text) {
      text.textContent = tierOddsSentence(tier);
      /* The legend already names every outcome and its percentage, so the
         sentence would just repeat it. Keep it in the markup as the no-JS
         fallback, but hide it once the legend has rendered. */
      if (legend) text.hidden = true;
    }

    const standout = $('[data-standout]', scope);
    if (standout) standout.textContent = `${standoutChancePerBox(tier)}%`;

    const ring = $('[data-sustain-ring]', scope);
    if (ring) ring.style.setProperty('--pct', tier.sustainScore);
  });
}

/* --------------------------------------------------------------------------
   Cart (localStorage, demo only — no payment integration)
   -------------------------------------------------------------------------- */
const Cart = (() => {
  const KEY = 'secondspin.cart.v1';
  let items = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
    render();
  }

  function add(tierId, qty = 1) {
    const line = items.find((i) => i.id === tierId);
    if (line) line.qty += qty;
    else items.push({ id: tierId, qty });
    save();
    bump();
    openDrawer();
  }
  function setQty(tierId, qty) {
    const line = items.find((i) => i.id === tierId);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) items = items.filter((i) => i.id !== tierId);
    save();
  }
  const count = () => items.reduce((n, i) => n + i.qty, 0);
  const total = () => items.reduce((n, i) => n + i.qty * (TIER_BY_ID[i.id]?.price || 0), 0);
  const lbs   = () => items.reduce((n, i) => n + i.qty * (TIER_BY_ID[i.id]?.avgWeightLbs || 0), 0);

  function bump() {
    const badge = $('[data-cart-count]');
    if (!badge) return;
    badge.classList.remove('is-bump');
    void badge.offsetWidth;
    badge.classList.add('is-bump');
  }

  function render() {
    const badge = $('[data-cart-count]');
    if (badge) {
      badge.textContent = count();
      badge.classList.toggle('is-visible', count() > 0);
    }

    const body = $('[data-cart-body]');
    if (!body) return;

    if (!items.length) {
      body.innerHTML = `
        <div class="cart-empty">
          ${icon('box')}
          <p><b>No boxes yet.</b></p>
          <p class="muted">Every box you add keeps roughly 5&ndash;6 lbs of clothing in circulation.</p>
          <a class="btn btn--sm" href="shop.html">Browse the tiers</a>
        </div>`;
    } else {
      body.innerHTML = items.map((i) => {
        const t = TIER_BY_ID[i.id];
        return `
          <div class="cart-line">
            <span class="cart-line__thumb" style="background:color-mix(in srgb, ${RARITIES.everyday.color} 18%, var(--paper))">${icon('box')}</span>
            <div class="cart-line__body">
              <div class="cart-line__title">${t.name}</div>
              <div class="muted">${t.itemCount} &middot; ${t.featureSlots} feature slot${t.featureSlots > 1 ? 's' : ''} &middot; ~${t.avgWeightLbs} lbs</div>
              <div class="qty">
                <button type="button" data-qty-down="${t.id}" aria-label="Decrease ${t.name} quantity">&minus;</button>
                <output aria-live="polite">${i.qty}</output>
                <button type="button" data-qty-up="${t.id}" aria-label="Increase ${t.name} quantity">+</button>
              </div>
            </div>
            <div><b>$${t.price * i.qty}</b></div>
          </div>`;
      }).join('');
    }

    const totalEl = $('[data-cart-total]');
    if (totalEl) totalEl.textContent = `$${total()}`;
    const lbsEl = $('[data-cart-lbs]');
    if (lbsEl) lbsEl.textContent = `${lbs().toFixed(1)} lbs`;
    const foot = $('[data-cart-foot]');
    if (foot) foot.hidden = !items.length;
  }

  function openDrawer() {
    const d = $('[data-cart-drawer]');
    if (!d) return;
    d.classList.add('is-open');
    document.body.classList.add('is-locked');
    const close = $('[data-cart-close]', d);
    if (close) close.focus();
  }
  function closeDrawer() {
    const d = $('[data-cart-drawer]');
    if (!d) return;
    d.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }

  return { add, setQty, render, openDrawer, closeDrawer, count, total };
})();

function initCart() {
  Cart.render();

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      Cart.add(addBtn.dataset.addToCart, Number(addBtn.dataset.qty || 1));
      return;
    }
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); Cart.openDrawer(); return; }
    if (e.target.closest('[data-cart-close]') || e.target.closest('[data-cart-scrim]')) {
      Cart.closeDrawer(); return;
    }
    const up = e.target.closest('[data-qty-up]');
    const down = e.target.closest('[data-qty-down]');
    if (up || down) {
      const id = (up || down).dataset.qtyUp || (up || down).dataset.qtyDown;
      const cur = JSON.parse(localStorage.getItem('secondspin.cart.v1') || '[]')
        .find((i) => i.id === id);
      Cart.setQty(id, (cur ? cur.qty : 0) + (up ? 1 : -1));
      return;
    }
    if (e.target.closest('[data-checkout]')) {
      e.preventDefault();
      const msg = $('[data-checkout-msg]');
      if (msg) {
        msg.dataset.state = 'ok';
        msg.textContent = 'Demo storefront — checkout is not connected to a payment provider.';
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') Cart.closeDrawer();
  });
}

/* --------------------------------------------------------------------------
   Marquee of recent finds
   -------------------------------------------------------------------------- */
function initMarquee() {
  const track = $('[data-marquee]');
  if (!track) return;
  const one = RECENT_FINDS.map((f) => `
    <span class="marquee__item">
      <span class="dot" style="background:${RARITIES[f.rarity].color};width:9px;height:9px;border-radius:50%;display:inline-block"></span>
      <b>${RARITIES[f.rarity].label}</b> ${f.text}
    </span>`).join('');
  // Duplicated once so the -50% translate loop is seamless.
  track.innerHTML = one + one;
  track.setAttribute('aria-label', 'Recently rescued finds');
}

/* --------------------------------------------------------------------------
   Newsletter (client-side validation only)
   -------------------------------------------------------------------------- */
function initForms() {
  $$('[data-newsletter]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input[type="email"]', form);
      const msg = $('[data-form-msg]', form);
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      if (!msg) return;
      msg.dataset.state = valid ? 'ok' : 'err';
      msg.textContent = valid
        ? 'Thanks — you are on the list. (Demo: no email is actually sent.)'
        : 'That email address does not look right.';
      if (valid) input.value = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Footer year
   -------------------------------------------------------------------------- */
function initMisc() {
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  $$('[data-brand]').forEach((el) => { el.textContent = BRAND.name; });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initMisc();
  initNav();
  initReveal();
  initCounters();
  initOddsTriggers();
  renderTierWidgets();
  initCart();
  initMarquee();
  initForms();
});
