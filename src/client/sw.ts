/* Khishgee's Salon — service worker
   Гар утасны сул сүлжээнд хурдан ажиллуулах зорилготой.
   Стратеги: статик файлыг сүлжээнээс эхэлж авах, амжилтгүй бол кэшээс. */

// lib.webworker нь self-ийг ерөнхий worker гэж үздэг тул SW төрөл рүү нарийсгана
const sw = self as unknown as ServiceWorkerGlobalScope;

const VERSION = 'ks-v2';
const SHELL = [
  '/',
  '/css/app.css',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
];

sw.addEventListener('install', (e: ExtendableEvent) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => null))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (e: ExtendableEvent) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (e: FetchEvent) => {
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
      }).catch(() => hit as unknown as Response))
    );
    return;
  }

  // Бусад — сүлжээ эхэлж, амжилтгүй бол кэш
  e.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(request, copy));
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('/') as Promise<Response>))
  );
});
