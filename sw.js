const CACHE_NAME = "lushi-cache-v2";
const urlsToCache = [
  "/",
  "/lushi.html",
  "/lushi-core.js",
  "/lushi-plugin.js",
  "/manifest.json",
  "/icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log("缓存安装失败:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 不缓存 API 请求和外部代理
  if (url.pathname.startsWith("/api") || 
      url.hostname.includes("workers.dev") || 
      url.hostname === "lushi.31lushi.deno.net") {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        // 离线时回退到首页
        if (event.request.mode === "navigate") {
          return caches.match("/lushi.html");
        }
      })
  );
});
