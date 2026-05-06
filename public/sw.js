// 简单的 Service Worker - 用于 PWA 离线缓存
const CACHE_NAME = 'gongkao-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// 安装：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求：网络优先 + 缓存兜底
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;
  
  // 不缓存外部 API 请求（AI 接口等）
  if (event.request.url.includes('bigmodel') || 
      event.request.url.includes('siliconflow') ||
      event.request.url.includes('api.')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功则缓存并返回
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (response.status === 200) {
            cache.put(event.request, clone);
          }
        });
        return response;
      })
      .catch(() => {
        // 失败则从缓存返回
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/index.html');
        });
      })
  );
});