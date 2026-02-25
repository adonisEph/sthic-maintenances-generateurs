const CACHE = 'gmga-pwa-v11';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  const data = event?.data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => true)
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve(true)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (
    url.pathname === '/signature_responsable.png' ||
    url.pathname === '/signature_responsable.PNG' ||
    url.pathname === '/assets/signature_responsable.png' ||
    url.pathname === '/assets/signature_responsable.PNG'
  ) {
    event.respondWith(fetch(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const title = 'Nouvelle notification';
      const options = {
        body: 'Une nouvelle activité vous a été assignée ou mise à jour.',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        data: { url: '/' }
      };

      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const c of clients) {
          try {
            c.postMessage({ type: 'PUSH_NOTIFICATION' });
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event?.notification?.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const client of allClients) {
        if (client.url && client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })()
  );
});
