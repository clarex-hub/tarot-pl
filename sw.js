// Zmień wersję przy każdej aktualizacji aplikacji (tarot-pl-v29 → tarot-pl-v30 itd.)
const CACHE_NAME = 'tarot-pl-v32';
const ASSETS = ['./', './index.html'];

// Które requesty cachujemy w runtime przy pierwszym fetchu (lazy cache).
// Obrazki kart leżą teraz lokalnie w /cards/, więc raz pobrane działają offline.
const RUNTIME_CACHE_PATTERNS = [
    '/cards/',
    '.jpg',
    '.jpeg',
    '.png',
    '.svg',
    '.webp'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    // Gemini, OpenRouter, fonty — nie cachuj, zawsze sieć
    if (url.includes('generativelanguage.googleapis.com') ||
        url.includes('openrouter.ai') ||
        url.includes('fonts.googleapis.com')) {
        return;
    }

    const shouldRuntimeCache = RUNTIME_CACHE_PATTERNS.some(p => url.includes(p));

    // Cache first — również dla lokalnych obrazków kart (offline-friendly)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cachujemy tylko poprawne odpowiedzi same-origin (nie 4xx/5xx, nie opaque cross-origin)
                if (shouldRuntimeCache && response && response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline: dla obrazków — zastępczy SVG, dla reszty — cache lub index.html
                if (shouldRuntimeCache) {
                    return new Response(
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><rect fill="#1a1a2e" width="100" height="150"/><text x="50" y="80" text-anchor="middle" fill="#d4af37" font-size="20">☽</text></svg>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }
                return cached || caches.match('./index.html');
            });
        })
    );
});

// Komunikat z app -> SW: wymusza aktywację nowej wersji
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
