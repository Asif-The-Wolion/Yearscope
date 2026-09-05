/*
 * YearScope service worker.
 * Only caches the app shell (HTML/CSS/JS/manifest/icons) for offline use.
 * Weather/climate API requests are intentionally left untouched here —
 * the app itself manages that caching (with visible "cached" labels and
 * timestamps) via localStorage, so this worker never serves stale
 * weather data silently.
 */
const CACHE_NAME = "yearscope-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests (the app shell). Let every third-party
  // API request (Open-Meteo, BigDataCloud, etc.) go straight to the network
  // untouched, so the app's own cache/staleness logic stays the source of truth.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
