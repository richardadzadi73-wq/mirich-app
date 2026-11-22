const CACHE = 'michat-v19';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './config.js', './privacy.html', './terms.html', './community-guidelines.html', './css/app.css', './js/01-app.js', './js/02-settings-i18n.js', './js/03-safety-privacy.js', './js/04-calls.js', './js/05-e2ee-ai-push.js', './js/06-channels-groupcalls-gifs.js', './js/07-device-linking.js', './js/08-pro-polish.js', './js/09-pro-features.js', './css/pro.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Never touch non-GET, Supabase (API/realtime/auth) or other cross-origin calls
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Network first, fall back to cache; only cache good responses
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Push + notification taps
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Michat', {
    body: d.body || 'New message', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'michat', data: d.data || {}
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
