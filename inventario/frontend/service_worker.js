// service-worker.js - Service Worker para PWA do Sistema de Inventário

const CACHE_NAME = 'inventario-protheus-v2.19.55b';
const API_CACHE_NAME = 'inventario-api-cache-v2.19.55b';

// Arquivos essenciais para cache offline
const STATIC_CACHE_URLS = [
    '/',
    '/login.html',
    '/dashboard.html',
    '/counting_improved.html',
    '/manifest.json',
    
    // CSS Frameworks
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    
    // JavaScript Frameworks
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
    
    // Offline fallback
    '/offline.html'
];

// URLs da API que devem ser cacheadas
const API_CACHE_URLS = [
    '/api/v1/auth/me',
    '/stats',
    '/api/v1/products',
    '/health'
];

// URLs que nunca devem ser cacheadas
const NEVER_CACHE_URLS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/inventory/items/*/count'
];

// =================================
// INSTALAÇÃO DO SERVICE WORKER
// =================================
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cache aberto:', CACHE_NAME);
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('[SW] Arquivos estáticos cacheados com sucesso');
                return self.skipWaiting(); // Ativar imediatamente
            })
            .catch((error) => {
                console.error('[SW] Erro ao cachear arquivos estáticos:', error);
            })
    );
});

// =================================
// ATIVAÇÃO DO SERVICE WORKER
// =================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Remover caches antigos
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('[SW] Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker ativado com sucesso');
                return self.clients.claim(); // Controlar todas as abas imediatamente
            })
    );
});

// =================================
// INTERCEPTAÇÃO DE REQUISIÇÕES
// =================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorar requisições não-HTTP
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Estratégia baseada no tipo de requisição
    if (isApiRequest(url)) {
        event.respondWith(handleApiRequest(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else {
        event.respondWith(handleNavigationRequest(request));
    }
});

// =================================
// FUNÇÕES DE IDENTIFICAÇÃO
// =================================
function isApiRequest(url) {
    return url.pathname.startsWith('/api/') || url.pathname === '/health' || url.pathname === '/stats';
}

function isStaticAsset(url) {
    return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
}

function shouldNeverCache(url) {
    return NEVER_CACHE_URLS.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '[^/]+'));
        return regex.test(url.pathname);
    });
}

function shouldCacheApi(url) {
    return API_CACHE_URLS.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '[^/]+'));
        return regex.test(url.pathname);
    });
}

// =================================
// ESTRATÉGIAS DE CACHE
// =================================

// Network First para APIs críticas
async function handleApiRequest(request) {
    const url = new URL(request.url);
    
    // URLs que nunca devem ser cacheadas
    if (shouldNeverCache(url)) {
        console.log('[SW] API nunca cache:', url.pathname);
        return fetchWithFallback(request);
    }
    
    // URLs que devem ser cacheadas
    if (shouldCacheApi(url)) {
        console.log('[SW] API com cache:', url.pathname);
        return networkFirstWithCache(request, API_CACHE_NAME);
    }
    
    // Outras APIs - sem cache
    console.log('[SW] API sem cache:', url.pathname);
    return fetchWithFallback(request);
}

// Cache First para assets estáticos
async function handleStaticAsset(request) {
    console.log('[SW] Asset estático:', request.url);
    return cacheFirstWithNetwork(request, CACHE_NAME);
}

// Network First para navegação com fallback
async function handleNavigationRequest(request) {
    console.log('[SW] Navegação:', request.url);
    
    if (request.mode === 'navigate') {
        return networkFirstWithFallback(request);
    }
    
    return cacheFirstWithNetwork(request, CACHE_NAME);
}

// =================================
// IMPLEMENTAÇÕES DAS ESTRATÉGIAS
// =================================

// Network First com Cache de fallback
async function networkFirstWithCache(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache da resposta bem-sucedida
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
            console.log('[SW] Resposta da rede cacheada:', request.url);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Rede falhou, tentando cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('[SW] Resposta do cache:', request.url);
            return cachedResponse;
        }
        
        // Se não há cache, retornar erro offline
        return createOfflineResponse(request);
    }
}

// Cache First com Network de fallback
async function cacheFirstWithNetwork(request, cacheName) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        console.log('[SW] Resposta do cache:', request.url);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
            console.log('[SW] Nova resposta cacheada:', request.url);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Falha ao buscar:', request.url);
        return createOfflineResponse(request);
    }
}

// Network First para navegação com página offline
async function networkFirstWithFallback(request) {
    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log('[SW] Navegação offline, mostrando página offline');
        
        const offlineResponse = await caches.match('/offline.html');
        if (offlineResponse) {
            return offlineResponse;
        }
        
        // Fallback HTML inline se não houver página offline
        return new Response(createOfflineHtml(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Fetch simples com fallback
async function fetchWithFallback(request) {
    try {
        return await fetch(request);
    } catch (error) {
        console.log('[SW] Fetch falhou:', request.url);
        return createOfflineResponse(request);
    }
}

// =================================
// UTILITÁRIOS
// =================================

// Criar resposta offline apropriada
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    if (isApiRequest(url)) {
        return new Response(
            JSON.stringify({
                error: 'Sem conexão com a internet',
                offline: true,
                timestamp: new Date().toISOString()
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
    
    return new Response('Conteúdo não disponível offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
    });
}

// HTML da página offline
function createOfflineHtml() {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - Inventário Protheus</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            text-align: center;
        }
        .offline-container {
            max-width: 400px;
            padding: 40px;
        }
        .offline-icon {
            font-size: 80px;
            margin-bottom: 30px;
            opacity: 0.8;
        }
        h1 {
            font-size: 28px;
            margin-bottom: 20px;
            font-weight: 700;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            opacity: 0.9;
            margin-bottom: 30px;
        }
        .retry-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .retry-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>Você está offline</h1>
        <p>
            Não foi possível conectar com o servidor.<br>
            Verifique sua conexão com a internet e tente novamente.
        </p>
        <button class="retry-btn" onclick="window.location.reload()">
            Tentar Novamente
        </button>
    </div>
</body>
</html>
    `;
}

// =================================
// EVENTOS DE BACKGROUND
// =================================

// Sincronização em background
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-counts') {
        event.waitUntil(syncPendingCounts());
    }
});

// Notificações push
self.addEventListener('push', (event) => {
    console.log('[SW] Push recebido:', event.data?.text());
    
    const options = {
        body: event.data?.text() || 'Nova notificação do Inventário',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/dashboard.html'
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir App',
                icon: '/icon-192.png'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Inventário Protheus', options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificação clicada:', event.action);
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/dashboard.html')
        );
    }
});

// =================================
// FUNÇÕES DE SINCRONIZAÇÃO
// =================================

// Sincronizar contagens pendentes
async function syncPendingCounts() {
    console.log('[SW] Sincronizando contagens pendentes...');
    
    try {
        // Buscar contagens pendentes no IndexedDB ou localStorage
        const pendingCounts = await getPendingCounts();
        
        for (const count of pendingCounts) {
            try {
                const response = await fetch('/api/v1/inventory/items/count', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${count.token}`
                    },
                    body: JSON.stringify(count.data)
                });
                
                if (response.ok) {
                    await removePendingCount(count.id);
                    console.log('[SW] Contagem sincronizada:', count.id);
                }
            } catch (error) {
                console.error('[SW] Erro ao sincronizar contagem:', count.id, error);
            }
        }
    } catch (error) {
        console.error('[SW] Erro na sincronização:', error);
    }
}

// Placeholder para funções de armazenamento
async function getPendingCounts() {
    // Implementar busca no IndexedDB
    return [];
}

async function removePendingCount(id) {
    // Implementar remoção do IndexedDB
    console.log('[SW] Removendo contagem pendente:', id);
}

// =================================
// LOGS E DEBUGGING
// =================================
console.log('[SW] Service Worker carregado - Versão:', CACHE_NAME);

// Reportar status para a aplicação principal
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME,
            cached_urls: STATIC_CACHE_URLS.length
        });
    }
});
