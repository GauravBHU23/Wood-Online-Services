/*!
 * Wood Online Service — service worker
 *
 * Strategy by content type:
 *   - Static assets (img/fonts/next static chunks): cache first, refreshed in the background.
 *   - Navigations: network first, falling back to a cached copy, then the offline page.
 *   - Anything authenticated, cart, checkout, admin or API: never cached.
 *
 * Ported from wwwroot/sw.js. Next.js's own build assets live under /_next/static/ (hashed,
 * safe to cache-first indefinitely) rather than the old /css//js/ paths, so PRECACHE lists the
 * offline page and public/ image assets only; JS/CSS chunks are picked up by the runtime cache
 * the first time each is fetched.
 */

const VERSION = 'wos-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
    OFFLINE_URL,
    '/img/logo.svg',
    '/img/favicon.svg',
    '/manifest.webmanifest'
];

// Personal or transactional areas must never be served from a cache.
const NEVER_CACHE = [
    '/api/',
    '/cart',
    '/checkout',
    '/orders',
    '/account',
    '/admin',
    '/invoice'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(PRECACHE).catch(() => {
                // A missing optional asset must not abort the whole install.
            }))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => !key.startsWith(VERSION))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Only handle our own origin.
    if (url.origin !== self.location.origin) return;

    if (NEVER_CACHE.some(prefix => url.pathname.startsWith(prefix))) {
        return; // Straight to the network, every time.
    }

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request));
        return;
    }

    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
    }
});

async function handleNavigation(request) {
    try {
        const response = await fetch(request);

        // Keep the last good copy of catalogue pages for offline reading.
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;

        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);

    if (cached) {
        // Refresh in the background so the next load gets the newer file.
        fetch(request)
            .then(response => {
                if (response.ok) {
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, response));
                }
            })
            .catch(() => { });

        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('', { status: 504 });
    }
}

function isStaticAsset(pathname) {
    // /_next/static/... (hashed build output) plus plain image/font/icon assets under public/.
    if (pathname.startsWith('/_next/static/')) return true;
    return /\.(css|js|png|jpe?g|gif|svg|webp|woff2?|ttf|eot|ico|webmanifest)$/i.test(pathname);
}

self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
