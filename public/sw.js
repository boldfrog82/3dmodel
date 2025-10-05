const CACHE_NAME = '3dmodeler-cache-v1';

const scopeUrl = self.registration?.scope ? new URL(self.registration.scope) : new URL(self.location.href);
const basePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
const toBasePath = (path = '') => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${basePath}${normalized}`;
};

const OFFLINE_URLS = [
  basePath,
  toBasePath('index.html'),
  toBasePath('manifest.webmanifest')
];
const FALLBACK_DOCUMENT = toBasePath('index.html');
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(FALLBACK_DOCUMENT))
    )
  );
});
