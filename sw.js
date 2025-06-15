const CACHE_NAME = 'gestor-tareas-v3.1'; //

const URLS_TO_CACHE = [
    './index.html', 
    './lucide.min.js',
    './icon-192x192.png',
    './icon-512x512.png',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching initial assets');
                const cachePromises = URLS_TO_CACHE.map(urlToCache => {
                    const request = new Request(urlToCache, {mode: 'cors'});
                    return fetch(request).then(response => {
                        if (!response.ok) {
                            console.error(`Failed to fetch ${urlToCache}: ${response.status}`);
                            return Promise.resolve(); 
                        }
                        return cache.put(request, response);
                    }).catch(err => {
                        console.error(`Skipping ${urlToCache} due to fetch error: ${err}`);
                        return Promise.resolve(); 
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => console.log('All initial assets cached successfully or skipped due to error.'))
            .catch(err => {
                console.error('Failed to cache one or more initial assets during install:', err);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated and old caches cleaned.');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }
            try {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.ok) {
                    if (event.request.method === 'GET' && (event.request.url.startsWith(self.location.origin) || networkResponse.type === 'cors')) {
                       await cache.put(event.request, networkResponse.clone());
                    }
                }
                return networkResponse;
            } catch (error) {
                console.warn('Network request failed for:', event.request.url, error);
                if (event.request.mode === 'navigate') {
                    const indexFallback = await cache.match('./index.html');
                    if (indexFallback) return indexFallback;
                }
                return new Response('', {status: 404, statusText: 'Not Found'});
            }
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const task = event.data.task;
        console.log('Service Worker: Received SCHEDULE_NOTIFICATION for:', task.title);
        event.waitUntil(
            self.registration.showNotification(`Recordatorio: ${task.title}`, {
                body: task.description || '¡Es hora de tu tarea!',
                icon: task.icon || './icon-192x192.png',
                tag: `task-alarm-${task.id}`,
                data: { taskId: task.id, url: './index.html' } // Añadir URL para abrir
            })
        );
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : './index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.endsWith(urlToOpen.substring(1)) && 'focus' in client) { // Comparar con la parte final de la URL
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});