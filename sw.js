const CACHE_NAME = 'corner-neighbor-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/ai-cost-calculator/index.html',
  '/ai-cost-calculator/style.css',
  '/ai-cost-calculator/app.js',
  '/subsc-calculator/index.html',
  '/subsc-calculator/style.css',
  '/subsc-calculator/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
