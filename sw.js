// SkyMap Service Worker
// Версия кеша — меняй при каждом обновлении приложения
const CACHE_NAME = 'skymap-v1';

// Файлы для кеширования при установке
const PRECACHE_FILES = [
  '/skymap/',
  '/skymap/index.html',
  '/skymap/manifest.json',
  '/skymap/icon-192.png',
  '/skymap/icon-512.png',
];

// ============================================================
// INSTALL — кешируем все файлы при первой установке
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching files');
        return cache.addAll(PRECACHE_FILES);
      })
      .then(() => self.skipWaiting()) // активируем SW сразу
  );
});

// ============================================================
// ACTIVATE — удаляем старые кеши
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // берём контроль над страницами
  );
});

// ============================================================
// FETCH — стратегия: сначала кеш, потом сеть
// Для Google Fonts — только сеть (они меняются)
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts и внешние ресурсы — только сеть
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Если офлайн и внешний ресурс недоступен — молча падаем
        return new Response('', { status: 408 });
      })
    );
    return;
  }

  // Свои файлы — Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Есть в кеше — отдаём сразу, фоном обновляем
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
              return networkResponse;
            })
            .catch(() => {}); // офлайн — не страшно, есть кеш
          return cachedResponse;
        }

        // Нет в кеше — идём в сеть и кешируем
        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(() => {
            // Совсем офлайн и нет кеша
            return new Response('Офлайн — файл недоступен', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});
