// T/L/L 서비스 워커. 주소 전체(/)를 맡는다: 내 턴테이블(/), 친구용(/deck/)
// - 앱 파일: 캐시를 먼저 보여 주고 뒤에서 새 파일을 받아 둔다(다음에 열 때 반영)
// - 새로고침은 네트워크를 먼저 쓴다. 글꼴은 따로 캐시. /api/ 는 건드리지 않는다
// 여러 파일을 함께 고쳤으면 VERSION을 올린다
const VERSION = 'tll-v2';
const FONTS = 'tll-fonts-1';
const KEEP = [VERSION, FONTS];
const SHELL = [
  '/', '/deck/', '/shell.js', '/merge.js', '/3d/deck3d.js', '/3d/three.module.min.js', '/3d/geometries/RoundedBoxGeometry.js',
  '/manifest.webmanifest', '/icon-192.png', '/deck/manifest.webmanifest', '/deck/icon-192.png',
];

const storable = (res) => res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(SHELL.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (storable(res)) await c.put(u, res);
        else if (u === '/') throw new Error('home ' + res.status);
      } catch (err) { if (u === '/') throw err; }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(e, name, key, matchOpt, keep, fallback) {
  const c = await caches.open(name);
  const hit = await c.match(key, matchOpt);
  const net = fetch(e.request).then((res) => {
    if (keep(res)) return c.put(key, res.clone()).then(() => res, () => res);
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  try { return await net; } catch (err) {
    const fb = fallback && await fallback();
    if (fb) return fb;
    throw err;
  }
}

async function networkFirst(req, key, matchOpt) {
  const c = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (storable(res)) c.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(key, matchOpt);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req, FONTS)); return; }
  if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(staleWhileRevalidate(e, FONTS, req, undefined, (r) => r.ok || r.type === 'opaque'));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // 화면(HTML)은 ?code=… 같은 꼬리를 떼고 주소 하나로 저장한다
  const nav = req.mode === 'navigate';
  const key = nav ? url.origin + url.pathname : req;
  const opt = nav ? { ignoreSearch: true } : undefined;
  const home = () => (nav ? caches.match(url.pathname.startsWith('/deck') ? '/deck/' : '/') : null);

  // Spotify 로그인에서 돌아올 때(?code=)와 새로고침은 네트워크 먼저
  if (url.searchParams.has('code') || req.cache === 'no-store' || req.cache === 'reload' || req.cache === 'no-cache') {
    e.respondWith(networkFirst(req, key, opt).catch(async (err) => (await home()) || Promise.reject(err)));
    return;
  }
  e.respondWith(staleWhileRevalidate(e, VERSION, key, opt, storable, home));
});
