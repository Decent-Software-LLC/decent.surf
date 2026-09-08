const CACHE_NAME = "decent-surf-v4";
const APP_SHELL = [
  "/",
  "/components/surf-conditions.js?v=4",
  "/components/live-camera.js",
  "/components/dawn-patrol.js",
  "/manifest.webmanifest",
  "/assets/images/decent.png",
  "/assets/images/decent-wave-icon.png",
  "/assets/images/decent-board-footer.png",
  "/assets/images/clay-beach-surfer.png",
  "/assets/images/clay-surf-wax.png",
  "/assets/images/clay-rashguard-surfer.png",
  "/assets/images/clay-cold-surfer.png",
  "/assets/images/clay-board-shorts.png",
  "/assets/icons/surf-192.png",
  "/assets/icons/surf-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
