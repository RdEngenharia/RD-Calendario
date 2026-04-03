const CACHE_NAME = 'calendar-pwa-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/src/style.css',
    '/src/app.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Suporte a notificações básicas
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Novo Evento', body: 'Você tem um novo compromisso!' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'https://picsum.photos/seed/calendar/192/192'
        })
    );
});
