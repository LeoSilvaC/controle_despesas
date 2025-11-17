// Nome do cache para a versão atual do Service Worker
const CACHE_NAME = 'controle-gastos-cache-v1';

// Lista de arquivos essenciais para o funcionamento offline
const urlsToCache = [
    './', // O path raiz (index.html)
    'index.html',
];

// 1. Instalação do Service Worker
self.addEventListener('install', (event) => {
    // Força o Service Worker a esperar apenas pelo cacheamento
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache Aberto. Pré-cacheando arquivos essenciais...');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[Service Worker] Falha no pré-cacheamento durante a instalação:', err);
            })
    );
});

// 2. Ativação do Service Worker
// Remove caches antigos para economizar espaço
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Deletando cache antigo: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        })
    );
    // Assegura que o Service Worker está pronto para interceptar requisições imediatamente
    self.clients.claim();
});

// 3. Interceptação de Requisições (Estratégia Cache-First, Network-Fallback)
self.addEventListener('fetch', (event) => {
    // Ignora requisições que não sejam GET e requisições de extensões/Chrome
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retorna o recurso do cache, se existir
                if (response) {
                    // console.log(`[Service Worker] Servindo do cache: ${event.request.url}`);
                    return response;
                }

                // Se não estiver no cache, tenta a rede
                // console.log(`[Service Worker] Buscando da rede: ${event.request.url}`);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Verifica se a resposta é válida
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clona a resposta para que ela possa ser usada pelo cache e pelo navegador
                        const responseToCache = networkResponse.clone();
                        
                        // Cacheia a nova requisição (principalmente para assets do root)
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Não cacheia CDNs (evita poluir o cache com coisas que o navegador já lida)
                                if (!event.request.url.includes('cdn')) {
                                    cache.put(event.request, responseToCache);
                                    // console.log(`[Service Worker] Cacheado novo recurso: ${event.request.url}`);
                                }
                            });
                            
                        return networkResponse;
                    })
                    .catch(() => {
                        // Se falhar, retorna o index.html em cache.
                        if (event.request.mode === 'navigate') {
                            return caches.match('index.html');
                        }
                    });
            })
    );
});