// Zmień wersję przy każdej aktualizacji aplikacji (tarot-pl-v10 → tarot-pl-v12 itd.)
const CACHE_NAME = 'tarot-pl-v14';
const ASSETS = ['./', './index.html'];

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

    // Gemini, OpenRouter, fonty — nie cachuj, zawsze sieć
    if (event.request.url.includes('generativelanguage.googleapis.com') ||
        event.request.url.includes('openrouter.ai') ||
        event.request.url.includes('fonts.googleapis.com')) {
        return;
    }

    // Obrazki kart (wikimedia) — network first z SVG fallbackiem offline
    if (event.request.url.includes('wikimedia') || event.request.url.includes('wikipedia')) {
        event.respondWith(
            fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => caches.match(event.request).then(r => r || new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><rect fill="#1a1a2e" width="100" height="150"/><text x="50" y="80" text-anchor="middle" fill="#d4af37" font-size="20">☽</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
            )))
        );
        return;
    }

    // Reszta — cache first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match('./index.html'));
        })
    );
});
