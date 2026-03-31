const CACHE_NAME = 'branham-sermons-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sermons.json'
];

// Install - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys.filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // For paragraph files, use cache-first strategy
    if (url.pathname.startsWith('/paragraphs/')) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) {
                        return cached;
                    }
                    return fetch(request)
                        .then(response => {
                            // Cache the paragraph file
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(request, clone));
                            return response;
                        });
                })
        );
        return;
    }

    // For other requests, use stale-while-revalidate
    event.respondWith(
        caches.match(request)
            .then(cached => {
                const fetchPromise = fetch(request)
                    .then(response => {
                        // Update cache
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, clone));
                        return response;
                    })
                    .catch(() => cached);

                return cached || fetchPromise;
            })
    );
});

// Handle preload messages
self.addEventListener('message', event => {
    if (event.data.type === 'PRELOAD_SERMONS') {
        const sermonIds = event.data.sermonIds;
        preloadSermons(sermonIds);
    }
});

async function preloadSermons(sermonIds) {
    const cache = await caches.open(CACHE_NAME);
    
    for (const sid of sermonIds) {
        const url = `/paragraphs/${sid}.json`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
                console.log(`Preloaded sermon ${sid}`);
            }
        } catch (error) {
            console.log(`Failed to preload sermon ${sid}:`, error);
        }
    }
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'PRELOAD_COMPLETE',
            count: sermonIds.length
        });
    });
}
