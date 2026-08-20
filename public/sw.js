/* Khishgee's Salon — service worker
   Гар утасны сул сүлжээнд хурдан ажиллуулах зорилготой.
   Стратеги: хуудсыг сүлжээнээс эхэлж авах, амжилтгүй бол кэшээс;
   зураг/дүрсийг кэш эхэлж. */

const VERSION = 'ks-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // API болон админ — кэшлэхгүй, зөвхөн сүлжээнээс
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Барааны зураг / дүрс — кэш эхэлж (өөрчлөгддөггүй)
  if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Бусад — сүлжээ эхэлж, амжилтгүй бол кэш
  e.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(request, copy));
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
  );
});
