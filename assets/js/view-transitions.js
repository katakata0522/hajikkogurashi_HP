/**
 * Corner Neighbor — View Transitions API & Retro CRT Screen Switch
 * Smooth cross-document transitions between internal pages.
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  // Gracefully degrade if View Transitions API is unsupported
  if (!('startViewTransition' in document)) return;

  // Respect user preference for reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  document.addEventListener('click', function (e) {
    // Only intercept primary clicks without modifier keys
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    var link = e.target.closest('a');
    if (!link) return;

    // Skip new tabs or download links
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    var rawHref = link.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      return;
    }

    var destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch (_) {
      return;
    }

    // Must be same origin
    if (destination.origin !== window.location.origin) return;

    // Skip in-page anchor jumps
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) {
      return;
    }

    // Perform smooth View Transition
    e.preventDefault();
    document.startViewTransition(function () {
      window.location.href = destination.href;
    });
  });
})();
