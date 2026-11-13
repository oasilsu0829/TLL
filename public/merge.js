/* 음악 크레이트 합치기 — 서버(src/music.js)와 화면(public/index.html)이 같이 쓴다.
   문서 하나: { v: 1, crates: { id: { id, name, o, u, albums: [{ id, uri, name, artist, img, year, n, k?, p?, t?, m? }] — k: 'pl' 이면 플레이리스트(앨범 한 장처럼 꽂힘), t는 잼 테이프 카세트 } } }
   - 크레이트마다 고친 시각 u. 두 기기 것을 합칠 때 크레이트 id마다 u가 늦은 쪽이 이긴다
   - 지운 크레이트는 { id, del: 1, u } 로 남겨 다른 기기에서도 지워지게 한다(180일 뒤 치움)
   - 기본 크레이트(c-main)는 기기마다 같은 id에 u: 0 이라 겹치지 않는다
   일반 스크립트로 불러도(window.MusicMerge), 모듈에서 import 해도(globalThis.MusicMerge) 된다 */
(function (root) {
  'use strict';
  const ID = /^[\w.-]{1,40}$/;
  const AID = /^[A-Za-z0-9]{10,40}$/;
  const KEEP_DEL = 180 * 864e5;
  const MAX_CRATES = 60, MAX_ALBUMS = 600;
  const num = (x) => (Number.isFinite(x) ? x : 0);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');

  function album(a) {
    a = obj(a);
    if (!AID.test(a.id || '')) return null;
    const img = str(a.img, 300), pl = a.k === 'pl';
    const y = {
      id: a.id, uri: (pl ? 'spotify:playlist:' : 'spotify:album:') + a.id, name: str(a.name, 200), artist: str(a.artist, 200),
      img: /^https:\/\//.test(img) ? img : /^(\/music)?\/mag\/sleeves\/[a-z0-9-]+\.webp$/.test(img) ? img.replace(/^\/music\//, '/') : '',
      // ↑ 예전 Sabathia 주소(/music/mag/…)는 /mag/…로 바꿔 둔다
      year: str(a.year, 10), n: Math.max(0, Math.floor(num(a.n))),
    };
    if (pl) y.k = 'pl';
    if (pl && /^[a-z]{2,8}$/.test(a.m || '')) y.m = a.m; // 잡지 부록 LP: 잡지 키(drop·fb·cy·mo) → 투명 비닐 커버·라벨
    const p = Math.max(0, Math.floor(num(a.p)));
    if (p) y.p = Math.min(p, 99999); // 들은 횟수(슬리브 낡음)
    if (pl && /^[a-z0-9]{2,20}$/.test(a.t || '')) y.t = a.t; // 잼 테이프: 카세트 디자인(jam/boombox.js TAPES)
    return y;
  }

  // 어떤 모양이 와도 문서 모양으로 맞춘다. now를 주면 앞서 있는 시계(u)를 now + 5분으로 누르고 오래된 지운 표시를 치운다
  function clean(doc, now) {
    const out = { v: 1, crates: {} };
    let n = 0;
    for (const [id, x] of Object.entries(obj(obj(doc).crates))) {
      if (!ID.test(id) || !x || typeof x !== 'object' || Array.isArray(x)) continue;
      let u = Math.max(0, Math.floor(num(x.u)));
      if (now) u = Math.min(u, now + 300000);
      if (x.del) {
        if (now && u < now - KEEP_DEL) continue;
        out.crates[id] = { id, del: 1, u };
        continue;
      }
      if (++n > MAX_CRATES) continue;
      const seen = new Set(), albums = [];
      for (const a of Array.isArray(x.albums) ? x.albums : []) {
        const y = album(a);
        if (!y || seen.has(y.id) || albums.length >= MAX_ALBUMS) continue;
        seen.add(y.id); albums.push(y);
      }
      out.crates[id] = { id, name: str(x.name, 40) || '크레이트', o: num(x.o), u, albums };
    }
    return out;
  }

  // a, b: clean 된 두 문서. 새 문서를 돌려준다. u가 같으면 a 것
  function merge(a, b) {
    const A = obj(a && a.crates), B = obj(b && b.crates);
    const out = { v: 1, crates: { ...A } };
    for (const [id, x] of Object.entries(B)) {
      if (!(id in A) || num(x.u) > num(A[id].u)) out.crates[id] = x;
    }
    return out;
  }

  root.MusicMerge = { clean, merge, album };
})(typeof globalThis !== 'undefined' ? globalThis : this);
