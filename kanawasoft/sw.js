// sw.js - Service Worker para PWA - Versão 3.0

const CACHE_NAME = 'kanawasoft-v3';
const STATIC_CACHE = 'kanawasoft-static-v3';
const DYNAMIC_CACHE = 'kanawasoft-dynamic-v3';
const DATA_CACHE = 'kanawasoft-data-v3';

const STATIC_URLS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/database.js',
    '/js/auth.js',
    '/js/estoque.js',
    '/js/financeiro.js',
    '/js/dashboard.js',
    '/js/notificacoes.js',
    '/js/backup.js',
    '/js/app.js',
    '/manifest.json',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
];

const DATA_URLS = [
    '/api/',
    '/.netlify/functions/'
];

// ============================================================
// INSTALAÇÃO
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                console.log('📦 Cacheando arquivos estáticos...');
                return cache.addAll(STATIC_URLS);
            }),
            caches.open(DATA_CACHE).then(cache => {
                console.log('📦 Cache de dados criado');
            })
        ])
        .then(() => self.skipWaiting())
        .catch(error => console.error('❌ Erro na instalação:', error))
    );
});

// ============================================================
// ATIVAÇÃO
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            const cachesToDelete = cacheNames.filter(name => 
                name !== STATIC_CACHE && 
                name !== DYNAMIC_CACHE && 
                name !== DATA_CACHE
            );
            return Promise.all(
                cachesToDelete.map(cacheName => {
                    console.log('🗑️ Removendo cache antigo:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        })
        .then(() => {
            console.log('✅ Service Worker ativado');
            return self.clients.claim();
        })
    );
});

// ============================================================
// INTERCEPTAÇÃO DE REQUISIÇÕES
// ============================================================
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Estratégia: Cache First para arquivos estáticos
    if (STATIC_URLS.some(staticUrl => url.pathname === staticUrl || url.pathname.startsWith(staticUrl))) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Atualizar em background
                        event.waitUntil(
                            fetch(request)
                                .then(networkResponse => {
                                    return caches.open(STATIC_CACHE)
                                        .then(cache => {
                                            cache.put(request, networkResponse.clone());
                                            return networkResponse;
                                        });
                                })
                                .catch(() => {})
                        );
                        return cachedResponse;
                    }
                    return fetch(request);
                })
        );
        return;
    }

    // Estratégia: Network First para APIs
    if (DATA_URLS.some(dataUrl => url.pathname.startsWith(dataUrl))) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    const responseClone = networkResponse.clone();
                    caches.open(DATA_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone);
                        });
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // Estratégia: Stale While Revalidate para outros recursos
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                const fetchPromise = fetch(request)
                    .then(networkResponse => {
                        const responseClone = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(request, responseClone);
                            });
                        return networkResponse;
                    })
                    .catch(() => {
                        // Se for HTML e estiver offline, mostrar página offline
                        if (request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });

                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetchPromise;
            })
    );
});

// ============================================================
// NOTIFICAÇÕES PUSH
// ============================================================
self.addEventListener('push', event => {
    let data = {};
    try {
        data = event.data?.json() || {};
    } catch {
        data = {
            title: 'KanawaSoft ERP',
            body: 'Nova notificação!',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png'
        };
    }

    const options = {
        body: data.body || 'Nova notificação do sistema',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: { 
            url: data.url || '/',
            type: data.type || 'info'
        },
        actions: [
            {
                action: 'open',
                title: '🔍 Ver'
            },
            {
                action: 'close',
                title: '❌ Fechar'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'KanawaSoft ERP', options)
    );
});

self.addEventListener('notificationclick', event => {
    const notification = event.notification;
    const action = event.action;

    notification.close();

    if (action === 'close') {
        return;
    }

    const url = notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(windowClients => {
                for (const client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ============================================================
// SINCERONIZAÇÃO EM BACKGROUND
// ============================================================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Sincronizar dados pendentes
            syncPendingData()
        );
    }
});

async function syncPendingData() {
    try {
        const cache = await caches.open(DATA_CACHE);
        const requests = await cache.keys();
        const pending = requests.filter(req => req.url.includes('/api/pending'));

        for (const request of pending) {
            const response = await fetch(request);
            if (response.ok) {
                await cache.delete(request);
            }
        }
        console.log('✅ Dados sincronizados em background');
    } catch (error) {
        console.error('❌ Erro na sincronização em background:', error);
    }
}

// ============================================================
// PERIODIC BACKGROUND SYNC
// ============================================================
self.addEventListener('periodicsync', event => {
    if (event.tag === 'periodic-sync') {
        event.waitUntil(
            // Atualizar dados em background
            updateDataInBackground()
        );
    }
});

async function updateDataInBackground() {
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            const data = await response.json();
            const cache = await caches.open(DATA_CACHE);
            await cache.put('/api/data', new Response(JSON.stringify(data)));
            console.log('✅ Dados atualizados em background');
        }
    } catch (error) {
        console.error('❌ Erro na atualização em background:', error);
    }
}

// ============================================================
// MENSAGENS
// ============================================================
self.addEventListener('message', event => {
    const data = event.data;

    switch (data.action) {
        case 'skipWaiting':
            self.skipWaiting();
            break;
        case 'clearCache':
            caches.delete(DYNAMIC_CACHE);
            caches.delete(DATA_CACHE);
            break;
        case 'getCacheSize':
            getCacheSize().then(size => {
                event.ports[0].postMessage({ size });
            });
            break;
        default:
            console.log('📨 Mensagem recebida:', data);
    }
});

async function getCacheSize() {
    const cacheNames = await caches.keys();
    let total = 0;
    for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        total += keys.length;
    }
    return total;
}

console.log('✅ Service Worker KanawaSoft ERP v3.0 carregado');