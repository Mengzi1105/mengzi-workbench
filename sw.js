// 萌子的小天地 —— 离线缓存（Service Worker）
// 策略：页面与静态资源采用 network-first（在线取最新，离线用缓存）；
// 同步 API（/api/data）直接放行，不缓存。
// 仅当页面通过 HTTPS 或 localhost 访问时才会注册（iOS/Android 要求安全上下文）。
const CACHE = 'mengzi-cache-v1';
const ASSETS = ['/', '/待办工作台.html', '/icon.png', '/sw.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // POST（同步写入）直接走网络
  var url = new URL(req.url);

  if (url.pathname === '/api/data') {
    e.respondWith(fetch(req).catch(function () { return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); }));
    return;
  }

  // 页面/静态：network-first，失败回退缓存（保证断网/服务器休眠时仍能打开）
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('/待办工作台.html'); });
    })
  );
});
