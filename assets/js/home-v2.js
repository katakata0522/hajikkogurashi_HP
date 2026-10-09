(() => {
  'use strict';
  const header = document.getElementById('site-header');
  const button = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  let restoreFocus = null;
  let scrollY = 0;
  const focusable = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const setOpen = (open, shouldFocus = true) => {
    if (!menu || !button) return;
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    if (open === wasOpen) return;
    if (open) {
      restoreFocus = document.activeElement;
      scrollY = window.scrollY;
      menu.inert = false;
      menu.classList.add('is-open');
      document.body.classList.add('menu-open');
      document.body.style.top = `-${scrollY}px`;
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'メニューを閉じる');
      // Wait for the visibility state to be applied before moving keyboard focus.
      if (shouldFocus) requestAnimationFrame(() => {
        if (button.getAttribute('aria-expanded') === 'true') menu.querySelector(focusable)?.focus();
      });
    } else {
      menu.classList.remove('is-open');
      menu.inert = true;
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'メニューを開く');
      if (shouldFocus && restoreFocus instanceof HTMLElement) restoreFocus.focus();
    }
  };
  button?.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => setOpen(false, false)));
  document.addEventListener('keydown', event => {
    if (button?.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const tabbable = [button, ...menu.querySelectorAll(focusable)].filter(el => !el.hasAttribute('disabled'));
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const desktopWidth = window.matchMedia('(min-width: 861px)');
  desktopWidth.addEventListener?.('change', evt => { if (evt.matches) setOpen(false, false); });
  if (header) {
    const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 22);
    updateHeader(); window.addEventListener('scroll', updateHeader, { passive: true });
  }
  // Motion is progressive enhancement only: layout and content never depend on it.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('reduce-motion');
})();
