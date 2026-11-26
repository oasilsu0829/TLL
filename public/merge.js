/* 음악 크레이트 합치기 — 서버(src/music.js)와 화면(public/index.html)이 같이 쓴다.
   문서 하나: { v: 1, crates: { id: { id, name, o, u, albums: [{ id, uri, name, artist, img, year, n, k?, p?, t?, m? }] — k: 'pl' 이면 플레이리스트(앨범 한 장처럼 꽂힘), t는 잼 테이프 카세트 } } }
   - 크레이트마다 고친 시각 u. 두 기기 것을 합칠 때 크레이트 id마다 u가 늦은 쪽이 이긴다
   - 지운 크레이트는 { id, del: 1, u } 로 남겨 다른 기기에서도 지워지게 한다(180일 뒤 치움)
   - 기본 크레이트(c-main)는 기기마다 같은 id에 u: 0 이라 겹치지 않는다
   - 잡지(mag, 2026-11-13): { opened: { 호 id: 처음 뜯은 시각 }, pl: { 호 id: { id, name, n } } } — 뜯은 호와 부록 LP 플레이리스트.
     기기마다 따로 두면 다른 기기에서 또 새 호로 뜨고 부록 플레이리스트가 또 만들어져서, 계정 문서에 같이 싣는다.
     opened는 합집합(이른 시각), pl은 먼저 만든 것(a 쪽)이 이긴다
   - 폴더(2026-11-24): folders: { id: { id, name, o, u } | { id, del: 1, u } } — 보관함에서 크레이트를 묶는 폴더. 크레이트처럼 u가 늦은 쪽이 이긴다.
     크레이트의 f = 들어 있는 폴더 id, '' = 폴더 밖(일부러 꺼냄), 없으면 기본(화면이 정함: JAM·잡지 크레이트는 T/L/L 폴더)
   - 디깅(dig, 2026-11-26): { fb: { 장르: { v, u } }, seen: { 판 키: { t, g } } } — 좋아요·별로와 본 판. fb는 u 늦은 쪽, seen은 합집합
   일반 스크립트로 불러도(window.MusicMerge), 모듈에서 import 해도(globalThis.MusicMerge) 된다 */
(function (root) {
  'use strict';
  const ID = /^[\w.-]{1,40}$/;
  const AID = /^[A-Za-z0-9]{10,40}$/;
  const KEEP_DEL = 180 * 864e5;
  const MAX_CRATES = 60, MAX_ALBUMS = 600, MAX_FOLDERS = 30;
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
    if (pl && /^[a-z0-9]{2,20}$/.test(a.t || '')) y.t = a.t; // 잼 테이프: 카세트 디자인(jam/doodle.js TAPES)
    return y;
  }

  const MID = /^[a-z0-9-]{2,40}$/, MAX_MAG = 400;
  function cleanMag(m) {
    m = obj(m);
    const opened = {}, pl = {};
    for (const [id, t] of Object.entries(obj(m.opened)).slice(0, MAX_MAG)) if (MID.test(id) && num(t) > 0) opened[id] = Math.floor(num(t));
    for (const [id, x0] of Object.entries(obj(m.pl)).slice(0, MAX_MAG)) {
      const x = obj(x0);
      if (MID.test(id) && AID.test(x.id || '')) pl[id] = { k: 'pl', id: x.id, name: str(x.name, 200), artist: str(x.artist, 200), n: Math.max(0, Math.floor(num(x.n))) };
    }
    return { opened, pl };
  }
  function mergeMag(a, b) {
    const A = cleanMag(a), B = cleanMag(b), opened = { ...A.opened };
    for (const [id, t] of Object.entries(B.opened)) opened[id] = opened[id] ? Math.min(opened[id], t) : t;
    return { opened, pl: { ...B.pl, ...A.pl } };
  }
  const emptyMag = (m) => !Object.keys(m.opened).length && !Object.keys(m.pl).length;

  // 디깅(2026-11-26): { fb: { 장르 id: { v: 1 | 0 | -1, u } }, seen: { 판 키: { t, g, miss? } } }. fb는 u 늦은 쪽, seen은 합집합(이른 t), 최근 600개
  const GID = /^[a-z0-9]{2,20}$/, SKEY = /^[^|]{1,80}\|[^|]{1,120}$/, MAX_SEEN = 600;
  function cleanDig(d) {
    d = obj(d);
    const fb = {}, seen = {};
    for (const [id, x0] of Object.entries(obj(d.fb)).slice(0, 200)) {
      const x = obj(x0), v = Math.sign(num(x.v));
      if (GID.test(id)) fb[id] = { v, u: Math.max(0, Math.floor(num(x.u))) };
    }
    const L = Object.entries(obj(d.seen)).filter(([k, x]) => SKEY.test(k) && num(obj(x).t) > 0)
      .sort((a, b) => num(b[1].t) - num(a[1].t)).slice(0, MAX_SEEN);
    for (const [k, x] of L) { const y = { t: Math.floor(num(x.t)), g: GID.test(x.g || '') ? x.g : '' }; if (x.miss) y.miss = 1; seen[k] = y; }
    const out = { fb, seen };
    // 필터(2026-11-26): { fams, dec, en, snd } + fu(고친 시각). 값 모양은 화면(engine.cleanFilter)이 다시 거른다
    const fl = obj(d.filter), fu = Math.max(0, Math.floor(num(d.fu)));
    if (fu) { const L2 = (x, re) => (Array.isArray(x) ? x.filter((y) => re.test(String(y))).slice(0, 20) : []); out.filter = { fams: L2(fl.fams, /^[a-z]{2,12}$/), dec: L2(fl.dec, /^(19|20)\d0$/).map(Number), en: L2(fl.en, /^[a-z]{2,6}$/), snd: L2(fl.snd, /^[a-z]{2,4}$/) }; out.fu = fu; }
    return out;
  }
  function mergeDig(a, b) {
    const A = cleanDig(a), B = cleanDig(b), fb = { ...A.fb }, seen = { ...A.seen };
    for (const [id, x] of Object.entries(B.fb)) if (!fb[id] || x.u > fb[id].u) fb[id] = x;
    for (const [k, x] of Object.entries(B.seen)) if (!seen[k] || x.t < seen[k].t) seen[k] = x;
    const F = (B.fu || 0) > (A.fu || 0) ? B : A;
    return cleanDig({ fb, seen, filter: F.filter, fu: F.fu });
  }
  const emptyDig = (d) => !Object.keys(d.fb).length && !Object.keys(d.seen).length && !d.fu;

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
        // 잡지 부록 LP는 같은 잡지·같은 이름이면 한 장만(예전에 기기마다 플레이리스트를 새로 만들어 겹쳐 꽂힌 것 정리). 앞(최근) 것이 남는다
        const mk = y && y.m ? 'm|' + y.m + '|' + y.name : '';
        if (!y || seen.has(y.id) || (mk && seen.has(mk)) || albums.length >= MAX_ALBUMS) continue;
        seen.add(y.id); if (mk) seen.add(mk); albums.push(y);
      }
      out.crates[id] = { id, name: str(x.name, 40) || '크레이트', o: num(x.o), u, albums };
      if (x.f === '' || (typeof x.f === 'string' && ID.test(x.f))) out.crates[id].f = x.f;
    }
    let nf = 0;
    for (const [id, x] of Object.entries(obj(obj(doc).folders))) {
      if (!ID.test(id) || !x || typeof x !== 'object' || Array.isArray(x)) continue;
      let u = Math.max(0, Math.floor(num(x.u)));
      if (now) u = Math.min(u, now + 300000);
      if (x.del) { if (!(now && u < now - KEEP_DEL)) (out.folders = out.folders || {})[id] = { id, del: 1, u }; continue; }
      if (++nf > MAX_FOLDERS) continue;
      (out.folders = out.folders || {})[id] = { id, name: str(x.name, 40) || '폴더', o: num(x.o), u };
    }
    const mag = cleanMag(obj(doc).mag);
    if (!emptyMag(mag)) out.mag = mag;
    const dg = cleanDig(obj(doc).dig);
    if (!emptyDig(dg)) out.dig = dg;
    return out;
  }

  // a, b: clean 된 두 문서. 새 문서를 돌려준다. u가 같으면 a 것
  function merge(a, b) {
    const A = obj(a && a.crates), B = obj(b && b.crates);
    const out = { v: 1, crates: { ...A } };
    for (const [id, x] of Object.entries(B)) {
      if (!(id in A) || num(x.u) > num(A[id].u)) out.crates[id] = x;
    }
    const FA = obj(a && a.folders), FB = obj(b && b.folders), folders = { ...FA };
    for (const [id, x] of Object.entries(FB)) if (!(id in FA) || num(x.u) > num(FA[id].u)) folders[id] = x;
    if (Object.keys(folders).length) out.folders = folders;
    const mag = mergeMag(a && a.mag, b && b.mag);
    if (!emptyMag(mag)) out.mag = mag;
    const dg = mergeDig(a && a.dig, b && b.dig);
    if (!emptyDig(dg)) out.dig = dg;
    return out;
  }

  root.MusicMerge = { clean, merge, album, cleanMag, mergeMag, cleanDig, mergeDig };
})(typeof globalThis !== 'undefined' ? globalThis : this);
