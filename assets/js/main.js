/*
	Forty by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)

	Rewritten in Vanilla JS — jQuery / skel / scrolly / scrollex removed.
*/

(function () {
	'use strict';

	/* ============================
	   Utilities
	   ============================ */

	/** matchMedia helper (replaces skel.breakpoints) */
	var breakpoints = {
		xlarge:  '(max-width: 1680px)',
		large:   '(max-width: 1280px)',
		medium:  '(max-width: 980px)',
		small:   '(max-width: 736px)',
		xsmall:  '(max-width: 480px)',
		xxsmall: '(max-width: 360px)'
	};

	function isActive(name) {
		return window.matchMedia(breakpoints[name]).matches;
	}

	/* ============================
	   Loading State
	   ============================ */
	var body = document.body;
	body.classList.add('is-loading');

	window.addEventListener('DOMContentLoaded', function () {
		setTimeout(function () {
			body.classList.remove('is-loading');
		}, 200);
	});

	// Clear transitioning state on unload
	window.addEventListener('pagehide', function () {
		setTimeout(function () {
			var els = document.querySelectorAll('.is-transitioning');
			for (var i = 0; i < els.length; i++) {
				els[i].classList.remove('is-transitioning');
			}
		}, 250);
	});

	/* ============================
	   Tiles
	   ============================ */
	function initTiles() {
		var tiles = document.querySelectorAll('.tiles > article');
		var wrapper = document.getElementById('wrapper');

		for (var i = 0; i < tiles.length; i++) {
			(function (tile) {
				var image = tile.querySelector('.image');
				var img = image ? image.querySelector('img') : null;
				var link = tile.querySelector('.link');

				// Background image from <img>
				if (img) {
					tile.style.backgroundImage = 'url(' + img.getAttribute('src') + ')';
					var pos = img.getAttribute('data-position');
					if (pos && image) image.style.backgroundPosition = pos;
					if (image) image.style.display = 'none';
				}

				// Clone link as overlay
				if (link) {
					var overlay = link.cloneNode(true);
					overlay.textContent = '';
					overlay.classList.add('primary');
					overlay.setAttribute('aria-label', link.textContent);
					tile.appendChild(overlay);

					var handleClick = function (e) {
						var href = link.getAttribute('href');
						e.stopPropagation();
						e.preventDefault();

						tile.classList.add('is-transitioning');
						if (wrapper) wrapper.classList.add('is-transitioning');

						setTimeout(function () {
							if (link.getAttribute('target') === '_blank') {
								window.open(href);
							} else {
								location.href = href;
							}
						}, 500);
					};

					link.addEventListener('click', handleClick);
					overlay.addEventListener('click', handleClick);
				}
			})(tiles[i]);
		}
	}

	/* ============================
	   Header — scroll-aware alt/reveal
	   (replaces jquery.scrollex)
	   ============================ */
	function initHeader() {
		var header = document.getElementById('header');
		var banner = document.getElementById('banner');

		if (!header || !banner || !header.classList.contains('alt')) return;

		var headerH = header.offsetHeight + 10;
		var terminated = false;

		function onScroll() {
			if (terminated) return;

			var rect = banner.getBoundingClientRect();
			var bannerBottom = rect.bottom;

			if (bannerBottom < headerH) {
				// Banner has scrolled past header
				header.classList.remove('alt');
				header.classList.add('reveal');
				terminated = true;
			}
		}

		// Also handle going back up (e.g. back-forward cache)
		function onScrollFull() {
			var rect = banner.getBoundingClientRect();
			var bannerBottom = rect.bottom;

			if (bannerBottom >= headerH) {
				header.classList.add('alt');
				header.classList.remove('reveal');
				terminated = false;
			} else {
				header.classList.remove('alt');
				header.classList.add('reveal');
				terminated = true;
			}
		}

		window.addEventListener('scroll', onScrollFull, { passive: true });
		window.addEventListener('resize', function () {
			headerH = header.offsetHeight + 10;
			onScrollFull();
		});

		// Initial check
		setTimeout(onScrollFull, 100);
	}

	/* ============================
	   Banner — background from <img>
	   ============================ */
	function initBanner() {
		var banners = document.querySelectorAll('#banner');
		for (var i = 0; i < banners.length; i++) {
			var banner = banners[i];
			var image = banner.querySelector('.image');
			if (!image) continue;
			var img = image.querySelector('img');
			if (!img) continue;
			banner.style.backgroundImage = 'url(' + img.getAttribute('src') + ')';
			image.style.display = 'none';
		}
	}

	/* ============================
	   Menu — open / close / toggle
	   (replaces jQuery menu system)
	   ============================ */
	function initMenu() {
		var menu = document.getElementById('menu');
		if (!menu) return;

		var locked = false;

		// Wrap inner content
		var inner = menu.querySelector('.inner');
		if (!inner) {
			inner = document.createElement('div');
			inner.className = 'inner';
			while (menu.firstChild) {
				inner.appendChild(menu.firstChild);
			}
			menu.appendChild(inner);
		}

		// Add close button
		var closeBtn = document.createElement('a');
		closeBtn.className = 'close';
		closeBtn.href = '#menu';
		closeBtn.textContent = 'Close';
		menu.appendChild(closeBtn);

		// Move menu to body end
		document.body.appendChild(menu);

		function lock() {
			if (locked) return false;
			locked = true;
			setTimeout(function () { locked = false; }, 350);
			return true;
		}

		function show()   { if (lock()) body.classList.add('is-menu-visible'); }
		function hide()   { if (lock()) body.classList.remove('is-menu-visible'); }
		function toggle() { if (lock()) body.classList.toggle('is-menu-visible'); }

		// Menu trigger links
		document.body.addEventListener('click', function (e) {
			var target = e.target.closest('a[href="#menu"]');
			if (target) {
				e.preventDefault();
				e.stopPropagation();
				toggle();
				return;
			}

			// Click outside menu = hide
			if (body.classList.contains('is-menu-visible') && !e.target.closest('#menu .inner')) {
				hide();
			}
		});

		// Stop propagation inside menu inner
		inner.addEventListener('click', function (e) {
			e.stopPropagation();
		});

		// Menu inner link clicks
		inner.addEventListener('click', function (e) {
			var a = e.target.closest('a');
			if (!a) return;
			var href = a.getAttribute('href');
			if (!href || href === '#menu') return;

			e.preventDefault();
			e.stopPropagation();
			hide();
			setTimeout(function () {
				window.location.href = href;
			}, 250);
		});

		// Backdrop click
		menu.addEventListener('click', function (e) {
			if (e.target === menu) {
				e.preventDefault();
				body.classList.remove('is-menu-visible');
			}
		});

		// Escape key
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' || e.keyCode === 27) hide();
		});
	}

	/* ============================
	   Scroll-to-Top Button
	   ============================ */
	function initScrollToTop() {
		var btn = document.getElementById('scrollToTopBtn');
		if (!btn) return;

		window.addEventListener('scroll', function () {
			if (window.scrollY > 200) {
				btn.style.display = 'block';
				btn.style.opacity = '0.8';
			} else {
				btn.style.display = 'none';
			}
		}, { passive: true });

		btn.addEventListener('click', function (e) {
			e.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}

	/* ============================
	   Smooth Scroll for .scrolly links
	   (replaces jquery.scrolly)
	   ============================ */
	function initScrolly() {
		var header = document.getElementById('header');
		var links = document.querySelectorAll('.scrolly');

		for (var i = 0; i < links.length; i++) {
			links[i].addEventListener('click', function (e) {
				var href = this.getAttribute('href');
				if (!href || href.charAt(0) !== '#') return;
				var target = document.querySelector(href);
				if (!target) return;

				e.preventDefault();
				var offset = header ? header.offsetHeight - 2 : 0;
				var top = target.getBoundingClientRect().top + window.scrollY - offset;
				window.scrollTo({ top: top, behavior: 'smooth' });
			});
		}
	}

	/* ============================
	   Contact Form — Submit Button Glow
	   文字が入力された瞬間に送信ボタンを光らせる
	   ============================ */
	function initContactFormGlow() {
		var form = document.querySelector('.contact-form');
		if (!form) return;

		var submitBtn = form.querySelector('input[type="submit"]');
		if (!submitBtn) return;

		var fields = form.querySelectorAll('input[type="text"], input[type="email"], textarea');

		function checkFields() {
			var hasContent = false;
			for (var i = 0; i < fields.length; i++) {
				if (fields[i].value.trim() !== '') {
					hasContent = true;
					break;
				}
			}
			if (hasContent) {
				submitBtn.classList.add('is-active');
			} else {
				submitBtn.classList.remove('is-active');
			}
		}

		for (var i = 0; i < fields.length; i++) {
			fields[i].addEventListener('input', checkFields);
		}

		// フォームリセット時にも対応
		form.addEventListener('reset', function () {
			setTimeout(function () {
				submitBtn.classList.remove('is-active');
			}, 10);
		});
	}

	/* ============================
	   Init
	   ============================ */
	document.addEventListener('DOMContentLoaded', function () {
		initTiles();
		initHeader();
		initBanner();
		initMenu();
		initScrollToTop();
		initScrolly();
		initContactFormGlow();
	});

})();