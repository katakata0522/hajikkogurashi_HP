(() => {
  'use strict';
  const header = document.getElementById('site-header');
  const button = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!header || !button || !menu) return;
  // Keep the fixed overlay outside clipping/transforming content wrappers.
  document.body.append(menu);
  let restoreFocus = null;
  let scrollY = 0;
  let background = [];
  const focusable = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const setOpen = (open, returnFocus = true) => {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    if (open === wasOpen) return;
    if (open) {
      restoreFocus = button;
      scrollY = window.scrollY;
      menu.inert = false;
      menu.classList.add('is-open');
      header.classList.add('menu-active');
      // The visual modal must also keep keyboard focus out of the page behind it.
      background = [...document.querySelectorAll('main,footer,.site-trail,.skip-link,.top-rail,.desktop-nav,.header-play')]
        .map(element => ({ element, inert: element.inert }));
      background.forEach(({ element }) => { element.inert = true; });
      document.body.classList.add('menu-open');
      document.body.style.top = `-${scrollY}px`;
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'メニューを閉じる');
      // Move focus after the pointer's native button focus has completed.
      setTimeout(() => {
        if (button.getAttribute('aria-expanded') === 'true') menu.querySelector(focusable)?.focus({ preventScroll: true });
      }, 0);
    } else {
      menu.classList.remove('is-open');
      menu.inert = true;
      header.classList.remove('menu-active');
      background.forEach(({ element, inert }) => { element.inert = inert; });
      background = [];
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'メニューを開く');
      if (returnFocus && restoreFocus instanceof HTMLElement) restoreFocus.focus({ preventScroll: true });
    }
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Closing makes this link inert; navigate explicitly before its default action is suppressed.
    event.preventDefault();
    const url = new URL(link.href);
    setOpen(false);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) { location.assign(url.href); return; }
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    // Keep normal hash history and give the visible destination keyboard focus.
    location.hash = url.hash;
    const hadTabindex = target.hasAttribute('tabindex');
    if (!hadTabindex) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  });
  document.addEventListener('keydown', event => {
    if (button.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const tabbable = [button, ...menu.querySelectorAll(focusable)];
    const first = tabbable[0], last = tabbable[tabbable.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const desktopWidth = window.matchMedia('(min-width:861px)');
  desktopWidth.addEventListener('change', event => {
    if (event.matches) { setOpen(false, false); if (document.activeElement === button || menu.contains(document.activeElement)) header.querySelector('.brand').focus({ preventScroll: true }); }
  });
  window.addEventListener('pagehide', () => setOpen(false, false));
  const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 22);
  updateHeader(); window.addEventListener('scroll', updateHeader, { passive: true });
})();
