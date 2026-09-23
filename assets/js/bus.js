/* ==========================================================================
   Second Spin — change bus
   --------------------------------------------------------------------------
   One action, one coordinated refresh of every live surface.

   Before this existed each surface refreshed only itself, so state could go
   stale across the page: selling a piece back credited the account but left
   the cart drawer's "store credit available" line showing the old figure, and
   buying a box updated the cart badge but not the header vault chip.

   Now anything that mutates state calls `Bus.emit()` exactly once, and every
   renderer subscribes with `Bus.on()`. Renderers must be idempotent and must
   not themselves mutate state, or this becomes a loop.

   Also handles cross-tab sync: if the visitor has the site open twice, a write
   in one tab fires the browser's `storage` event, we re-read persisted state
   and refresh the other tab too.
   ========================================================================== */

const Bus = (() => {
  const EVENT = 'secondspin:change';

  /** Announce that state changed. `source` is for debugging only. */
  function emit(source) {
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { source: source || 'unknown' } }));
  }

  /** Subscribe a renderer. Called on every change, plus once immediately. */
  function on(fn, { immediate = true } = {}) {
    document.addEventListener(EVENT, (e) => fn(e.detail || {}));
    if (immediate) {
      // Defer so subscribers registered during script parse still see a first
      // paint after the DOM is ready.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => fn({ source: 'init' }));
      } else {
        fn({ source: 'init' });
      }
    }
  }

  /* Another tab wrote to localStorage — re-read and refresh this one. */
  window.addEventListener('storage', (e) => {
    if (e.key && !e.key.startsWith('secondspin.')) return;
    try { if (typeof Account !== 'undefined' && Account.reload) Account.reload(); } catch { /* not loaded */ }
    try { if (typeof Cart !== 'undefined' && Cart.reload) Cart.reload(); } catch { /* not loaded */ }
    emit('storage');
  });

  return { on, emit, EVENT };
})();

if (typeof window !== 'undefined') window.Bus = Bus;
