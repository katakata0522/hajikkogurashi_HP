/**
 * Corner Neighbor — View Transitions API & Retro CRT Screen Switch
 * Smooth cross-document transitions between internal pages.
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  // Respect user preference for reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Feature detection: Check for native MPA Cross-Document View Transitions (Chrome 126+, Safari 18.2+)
  // When supported, CSS `@view-transition { navigation: auto; }` handles page-to-page transitions
  // natively without interrupting standard navigation.
  var supportsNativeCrossDoc = ('onpageswap' in window) || ('onpagereveal' in window);

  if (supportsNativeCrossDoc) {
    window.addEventListener('pageswap', function (e) {
      if (e.viewTransition && e.viewTransition.finished) {
        e.viewTransition.finished.catch(function () {});
      }
    });
    window.addEventListener('pagereveal', function (e) {
      if (e.viewTransition && e.viewTransition.finished) {
        e.viewTransition.finished.catch(function () {});
      }
    });
    return;
  }

  // Fallback for same-document View Transitions API
  if (!('startViewTransition' in document)) return;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    var link = e.target.closest('a');
    if (!link) return;

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

    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) {
      return;
    }

    // Smooth transition fallback
    try {
      var vt = document.startViewTransition(function () {
        window.location.href = destination.href;
      });
      if (vt && vt.finished) {
        vt.finished.catch(function () {});
      }
    } catch (_) {
      window.location.href = destination.href;
    }
  });
})();
