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
