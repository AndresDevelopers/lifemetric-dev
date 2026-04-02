const CACHE_VERSION = "lifemetric-pwa-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.ico"];

function isCacheableStaticAsset(requestUrl, destination) {
  return (
    requestUrl.pathname.startsWith("/_next/static/") ||
    ["script", "style", "font", "image"].includes(destination)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheKeys) =>
        Promise.all(cacheKeys.map((cacheKey) => (cacheKey !== CACHE_VERSION ? caches.delete(cacheKey) : undefined))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigationRequest = event.request.mode === "navigate" || event.request.destination === "document";
  const isStaticAsset = isSameOrigin && isCacheableStaticAsset(requestUrl, event.request.destination);

  if (isNavigationRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const clonedResponse = networkResponse.clone();
            void caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clonedResponse));
          }

          return networkResponse;
        })
        .catch(async () => {
          const cachedNavigation = await caches.match(event.request);
          if (cachedNavigation) {
            return cachedNavigation;
          }

          return caches.match("/");
        }),
    );
    return;
  }

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const clonedResponse = networkResponse.clone();
        void caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clonedResponse));
        return networkResponse;
      });
    }),
  );
});
