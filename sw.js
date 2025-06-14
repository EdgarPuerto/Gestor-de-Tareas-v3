const CACHE_NAME = 'gestor-tareas-v3-cache-v1.0'; // Versión actualizada
const URLS_TO_CACHE = [
    './index.html', // Nombre de archivo HTML corregido
    './lucide.min.js',
    './icon-192x192.png', // Asegúrate de que estos iconos existan
    './icon-512x512.png', // Asegúrate de que estos iconos existan
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
                // Usar { mode: 'cors' } para recursos de terceros si es necesario, aunque para los listados aquí puede que no sea estrictamente necesario si se sirven con CORS headers adecuados.
                // Para CDNs como tailwind y google fonts, el navegador maneja CORS. Para tus propios assets, no es problema.
                const cachePromises = URLS_TO_CACHE.map(urlToCache => {
                    const request = new Request(urlToCache, {mode: 'cors'}); // mode: 'cors' es buena práctica para CDNs
                    return fetch(request).then(response => {
                        if (!response.ok) {
                            // Si la respuesta no es OK (e.g. 404), no intentes cachearla y lanza un error
                            // o simplemente sáltala para no romper la instalación del SW.
                            console.error(`Failed to fetch ${urlToCache}: ${response.status}`);
                            return Promise.resolve(); // Resuelve para no bloquear el Promise.all
                        }
                        return cache.put(request, response);
                    }).catch(err => {
                        console.error(`Skipping ${urlToCache} due to fetch error: ${err}`);
                        return Promise.resolve(); // Resuelve para no bloquear el Promise.all
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => console.log('All initial assets cached successfully.'))
            .catch(err => {
                console.error('Failed to cache one or more initial assets:', err);
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
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Intenta obtener la respuesta del caché primero
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            // Si no está en caché, ve a la red
            try {
                const networkResponse = await fetch(event.request);
                // Si la respuesta de red es válida, la cacheamos y la devolvemos
                if (networkResponse && networkResponse.ok) {
                    // Solo cachear peticiones GET y si no son opacas (para evitar errores con CDNs que no devuelven CORS headers para todo)
                    // o si son de tu propio origen.
                    if (event.request.method === 'GET' && (event.request.url.startsWith(self.location.origin) || networkResponse.type === 'cors')) {
                       await cache.put(event.request, networkResponse.clone());
                    }
                }
                return networkResponse;
            } catch (error) {
                // La red falló.
                console.warn('Network request failed, trying to serve fallback or nothing:', error);
                // Si la petición es de navegación y falla, intenta servir index.html como fallback.
                if (event.request.mode === 'navigate') {
                    const indexFallback = await cache.match('./index.html'); // O la start_url
                    if (indexFallback) return indexFallback;
                }
                // Si no es navegación o index.html no está en caché, la petición simplemente fallará
                // (lo que lleva al error 404 si el navegador no puede obtener el recurso).
                // Podrías devolver una respuesta de error genérica si quisieras:
                // return new Response("Network error occurred", { status: 408, headers: { "Content-Type": "text/plain" } });
                throw error; // Re-lanza el error si no hay fallback
            }
        })
    );
});
