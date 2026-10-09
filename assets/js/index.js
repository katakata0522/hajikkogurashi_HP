(function() {
	'use strict';

	var body = document.body;
	var tiles = document.querySelectorAll('.tiles--home article');

	if (!body || !tiles.length) {
		return;
	}

	body.classList.add('is-home-enhanced');

	if (!('IntersectionObserver' in window)) {
		tiles.forEach(function(tile) {
			tile.classList.add('is-visible');
		});
		return;
	}

	// 画面に入ったタイルだけを順に見せて、既存デザインを崩さず密度感を整える。
	var observer = new IntersectionObserver(function(entries, currentObserver) {
		entries.forEach(function(entry) {
			if (!entry.isIntersecting) {
				return;
			}

			entry.target.classList.add('is-visible');
			currentObserver.unobserve(entry.target);
		});
	}, {
		rootMargin: '0px 0px -12% 0px',
		threshold: 0.2
	});

	tiles.forEach(function(tile) {
		observer.observe(tile);
	});
})();

// トップのモニター: 1枚目だけ先に表示し、残りの画面はページの読み込みが落ち着いてから取得する。
// 「動きを減らす」設定のときは切り替えないので、残りは読み込まない。
(function() {
	'use strict';

	var screen = document.querySelector('.hero-monitor__screen');
	if (!screen) {
		return;
	}
	var lazyImages = Array.prototype.slice.call(screen.querySelectorAll('img[data-src]'));
	var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!lazyImages.length || reduceMotion) {
		return;
	}

	function whenLoaded(img) {
		return new Promise(function(resolve) {
			if (img.complete && img.naturalWidth) {
				resolve();
				return;
			}
			img.addEventListener('load', function() { resolve(); }, { once: true });
			img.addEventListener('error', function() { resolve(); }, { once: true });
		});
	}

	function start() {
		var pending = lazyImages.map(function(img) {
			img.src = img.getAttribute('data-src');
			img.removeAttribute('data-src');
			return whenLoaded(img);
		});
		Promise.all(pending).then(function() {
			var ok = lazyImages.every(function(img) { return img.naturalWidth > 0; });
			if (ok) {
				screen.classList.add('is-cycling');
			}
		});
	}

	function schedule() {
		window.setTimeout(start, 3500);
	}

	if (document.readyState === 'complete') {
		schedule();
	} else {
		window.addEventListener('load', schedule, { once: true });
	}
})();
