// T/L/L 디깅 — 데이터(취향 읽기 · Spotify에서 판 찾기 · 표지 색 · 기록). 화면은 table.js(턴테이블 장면 안 카드덱)
import { buildProfile, deal as dealHand, seedKey, why, norm, pickSeed, cleanFilter } from './engine.js';
export { dealHand, seedKey, why };
export { cleanFilter, filterEmpty, describeFilter, inFilter, DECADES, ENERGY, SOUND, FAMS, GENRES } from './engine.js';
const C = () => window.MusicCore;
const LSG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const PROF_DAYS = 3;
import * as TX from './tagx.js';

// ── 기록
export function digState() { const s = LSG('dig.v1', {}); return { fb: s.fb || {}, seen: s.seen || {}, recent: s.recent || [], filter: cleanFilter(s.filter), fu: s.fu || 0 }; }
// 필터 저장(fu = 고친 시각, 기기끼리 늦은 쪽)
export function setFilter(f) { const st = digState(); st.filter = cleanFilter(f); st.fu = Date.now(); saveState(st); return st.filter; }
export function saveState(st, sync = true) { LSS('dig.v1', st); if (sync && C() && C().digSaved) C().digSaved(); }

// ── 취향 읽기
async function topArtists() {
  const out = new Map();
  const add = (a, w) => {
    if (!a || !a.name) return;
    const k = norm(a.name), x = out.get(k) || { name: a.name, id: a.id || '', w: 0, genres: [] };
    x.w += w; if (a.id && !x.id) x.id = a.id;
    if (a.genres && a.genres.length && !x.genres.length) x.genres = a.genres;
    out.set(k, x);
  };
  const R = [['short_term', 3], ['medium_term', 2.2], ['long_term', 1.5]];
  await Promise.all(R.map(async ([tr, w]) => {
    try { const j = await C().api(`/me/top/artists?time_range=${tr}&limit=50`); (j.items || []).forEach((a, i) => add(a, w * (1 - i / 70))); } catch {}
  }));
  // 크레이트에 꽂은 앨범의 아티스트(플레이리스트·잡지·잼은 뺌)
  try {
    for (const a of (C().crateAlbums ? C().crateAlbums() : [])) {
      if (a.k) continue;
      for (const n of String(a.artist || '').split(/\s*,\s*/).slice(0, 2)) add({ name: n }, 0.6);
    }
  } catch {}
  return [...out.values()].sort((a, b) => b.w - a.w).slice(0, 60);
}
async function mbTags(name) {
  const cache = LSG('dig.tags', {}), k = norm(name), hit = cache[k];
  if (hit && Date.now() - hit[0] < 30 * 864e5) return hit[1];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('/api/music/tags?a=' + encodeURIComponent(name));
      if (r.status === 503) { await new Promise((z) => setTimeout(z, 1400)); continue; }
      if (!r.ok) return [];
      const j = await r.json();
      const c2 = LSG('dig.tags', {}); c2[k] = [Date.now(), j.tags || []];
      const keys = Object.keys(c2); if (keys.length > 400) for (const x of keys.slice(0, keys.length - 400)) delete c2[x];
      LSS('dig.tags', c2);
      return j.tags || [];
    } catch { return []; }
  }
  return [];
}
// onStep(진행 글) → 취향. 캐시(dig.prof, 3일)가 있으면 바로
export async function readTaste(force, onStep) {
  const c = LSG('dig.prof', null);
  if (!force && c && Date.now() - c.t < PROF_DAYS * 864e5 && c.P && c.P.n) return c.P;
  onStep && onStep('듣는 아티스트 모으는 중');
  const L = await topArtists();
  // Last.fm 키가 있으면 아티스트 태그를 Last.fm에서(빠르고 풍부). 없으면 Spotify genres → MusicBrainz
  if (await hasLf()) {
    let done = 0; const top = L.slice(0, 36);
    await pool(top, 4, async (a) => { a.lf = await artistTags(a.name); done++; onStep && onStep(`장르 읽는 중 ${done}/${top.length}`); });
  }
  const need = L.filter((a) => !a.genres.length && !(a.lf && a.lf.length)).slice(0, 36);
  let done = 0;
  // MusicBrainz는 천천히: 둘씩
  const q = [...need];
  await Promise.all([0, 1].map(async () => {
    while (q.length) {
      const a = q.shift();
      a.tags = await mbTags(a.name);
      done++; onStep && onStep(`장르 읽는 중 ${done}/${need.length}`);
      if (!LSG('dig.tags', {})[norm(a.name)]) await new Promise((z) => setTimeout(z, 600));
    }
  }));
  const tagsOf = (a) => (a.lf && a.lf.length ? a.lf : a.genres.length ? a.genres.map((g, i) => [g, 10 - i]) : (a.tags || []));
  const P = buildProfile(L.map((a) => ({ name: a.name, w: a.w, tags: tagsOf(a) })));
  P.at = Date.now(); P.artists = L.length;
  P.arts = L.slice(0, 40).map((a) => ({ name: a.name, w: +a.w.toFixed(2), tags: tagsOf(a).slice(0, 8) }));
  LSS('dig.prof', { t: Date.now(), P });
  return P;
}

// ── Spotify에서 판 찾기
const firstArt = (s) => String(s || '').split(/\s*[&,]\s*|\s+and\s+/i)[0];
function albScore(x, seed) {
  const an = norm(seed.artist), a0 = norm(firstArt(seed.artist));
  const arts = (x.artists || []).map((y) => norm(y.name));
  const artOk = arts.some((y) => y === an || y === a0 || (y.length > 2 && (an.includes(y) || y.includes(a0))));
  if (!artOk) return -1;
  const n = norm(x.name), sn = norm(seed.album);
  let s = 2;
  if (n === sn) s += 4; else if (n.includes(sn) || sn.includes(n)) s += 2.5;
  const y = +(x.release_date || '').slice(0, 4);
  if (seed.year && y) s += Math.abs(y - seed.year) <= 1 ? 1.5 : y > seed.year + 3 ? -0.5 : 0;
  if (x.album_type === 'compilation') s -= 1; if (x.album_type === 'single') s -= 1.5;
  return s;
}
async function search(q, type) {
  const j = await C().api(`/search?type=${type}&limit=10&market=from_token&q=` + encodeURIComponent(q));
  return (j && j[type + 's'] && j[type + 's'].items || []).filter(Boolean);
}
export async function findAlbum(seed) {
  let best = null, bs = 0;
  const tryL = (L) => { for (const x of L) { const s = albScore(x, seed); if (s > bs) { bs = s; best = x; } } };
  try { tryL(await search(`album:${seed.album} artist:${firstArt(seed.artist)}`, 'album')); } catch {}
  if (bs < 5) { try { tryL(await search(`${firstArt(seed.artist)} ${seed.album}`, 'album')); } catch {} }
  if (!best) {
    // 앨범 이름으로 못 찾으면 그 아티스트의 정규 앨범 중 연도가 가까운 것
    try {
      const A = (await search(firstArt(seed.artist), 'artist')).find((x) => norm(x.name) === norm(firstArt(seed.artist)));
      if (A) {
        const j = await C().api(`/artists/${A.id}/albums?include_groups=album&limit=20&market=from_token`);
        const L = seed.year ? (j.items || []).sort((a, b) => Math.abs(+(a.release_date || '0').slice(0, 4) - seed.year) - Math.abs(+(b.release_date || '0').slice(0, 4) - seed.year)) : (j.items || []);
        best = L[0] || null;
      }
    } catch {}
  }
  if (!best) return null;
  let full = best;
  try { full = await C().api(`/albums/${best.id}?market=from_token`); } catch {}
  const img = ((full.images || best.images || []).find((i) => i.width && i.width <= 700) || (full.images || best.images || [])[0] || {}).url || '';
  const tracks = (full.tracks && full.tracks.items || []).map((t) => ({ name: t.name, ms: t.duration_ms || 0, uri: t.uri }));
  return {
    raw: full, id: full.id, uri: full.uri || 'spotify:album:' + full.id, name: full.name, artist: (full.artists || []).map((x) => x.name).join(', '),
    year: (full.release_date || '').slice(0, 4), img, label: full.label || '', tracks, n: full.total_tracks || tracks.length,
  };
}

// ── 표지 색(바탕 · 무늬 · 점)
export function loadImg(src) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
    setTimeout(() => res(null), 8000);
  });
}
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export const lum = (h) => { const n = parseInt(h.slice(1), 16), f = (v) => { v /= 255; return v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
export const con = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export function paletteOf(im) {
  const out = ['#2a2420', '#d9bb7e', '#efe7da'];
  if (!im) return out;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 28; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, 28, 28);
    const d = g.getImageData(0, 0, 28, 28).data, B = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5);
      const b = B.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; B.set(k, b);
    }
    const L = [...B.values()].map((b) => ({ n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((a, b) => b.n - a.n);
    const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 70;
    const pick = [L[0].c];
    for (const x of L) { if (pick.length >= 3) break; if (pick.every((p) => far(p, x.c))) pick.push(x.c); }
    const H = pick.map((p) => hex(...p));
    while (H.length < 3) H.push(lum(H[0]) > 0.3 ? '#14100c' : '#f6f1e7');
    return H;
  } catch { return out; }
}


// 네 장 고르기 + Spotify에서 실제 판 찾기 + 표지 그림·색. 못 찾은 판은 seen에 miss로 적고 같은 장르 다른 판
export async function makeHand(P) {
  let st = digState();
  for (let tries = 0; tries < 3; tries++) {
    const H = dealHand(P, st);
    if (H.length < 4) break;
    const got = await Promise.all(H.map(async (h) => {
      for (let k = 0; k < 3 && h.seed; k++) {
        const alb = await findAlbum(h.seed).catch(() => null);
        if (alb && alb.tracks.length) return { ...h, alb };
        st.seen[seedKey(h.seed)] = { t: Date.now(), g: h.g.id, miss: 1 };
        h.seed = pickSeed(h.g, st.seen, Math.random, h.slot === 'in' && !h.relaxed ? st.filter.dec : []);
        if (h.seed) h.why = why(h.g, P, h.seed.year);
      }
      return null;
    }));
    if (got.every(Boolean)) {
      await Promise.all(got.map(async (h) => {
        const y = +h.alb.year; if (y && Math.abs(y - (h.seed.year || y)) > 2) h.why = why(h.g, P, y);
        h.im = await loadImg(h.alb.img); h.pal = paletteOf(h.im);
      }));
      st.recent = [...got.map((h) => h.g.id), ...(st.recent || [])].slice(0, 9);
      saveState(st, false);
      return got;
    }
    saveState(st, false);
  }
  throw new Error('판을 찾지 못했습니다');
}
export { homeNames } from './engine.js';
export { buildProfile };

// ── Last.fm · ListenBrainz(2026-11-26, 개선안 2 + 3). 서버 /api/music/lf · /api/music/lb/similar 를 거친다(키는 서버에만)
let LF = null; // null = 아직 모름, true/false
const mem = new Map();
export async function lf(m, params = {}) {
  const q = new URLSearchParams({ m, ...params }).toString();
  if (mem.has(q)) return mem.get(q);
  const p = (async () => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch('/api/music/lf?' + q);
      if (r.status === 501) { LF = false; throw Object.assign(new Error('Last.fm 키 없음'), { nokey: 1 }); }
      if (r.status === 503) { await new Promise((z) => setTimeout(z, 1200 * (i + 1))); continue; }
      if (!r.ok) throw new Error('Last.fm ' + r.status);
      LF = true; return r.json();
    }
    throw new Error('Last.fm 바쁨');
  })();
  mem.set(q, p); p.catch(() => mem.delete(q));
  return p;
}
export async function hasLf() {
  if (LF !== null) return LF;
  try { await lf('chart.gettoptags', { limit: '200' }); } catch {}
  return !!LF;
}
async function pool(L, n, fn) { const q = [...L]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const x = q.shift(); try { await fn(x); } catch {} } })); }
export async function artistTags(name) {
  const c = LSG('dig.lft', {}), k = norm(name);
  if (c[k] && Date.now() - c[k][0] < 30 * 864e5) return c[k][1];
  const j = await lf('artist.gettoptags', { artist: name }).catch(() => null);
  const T = ((j && j.toptags && j.toptags.tag) || []).slice(0, 10).map((t) => [TX.cleanTag(t.name), +t.count || 0]).filter((t) => t[0]);
  const c2 = LSG('dig.lft', {}); c2[k] = [Date.now(), T];
  const keys = Object.keys(c2); if (keys.length > 600) for (const x of keys.slice(0, keys.length - 600)) delete c2[x];
  LSS('dig.lft', c2);
  return T;
}
const simList = (j) => ((j && j.similarartists && j.similarartists.artist) || []).map((a) => ({ name: a.name, sim: +a.match || 0 }));
async function similar(name) {
  if (await hasLf()) { const j = await lf('artist.getsimilar', { artist: name, limit: '60' }).catch(() => null); const L = simList(j); if (L.length) return L; }
  // 키 없음: MusicBrainz로 MBID → ListenBrainz 비슷한 아티스트
  try {
    const t = await (await fetch('/api/music/tags?a=' + encodeURIComponent(name))).json();
    if (!t.mb) return [];
    const r = await (await fetch('/api/music/lb/similar?mbid=' + t.mb)).json();
    const L = r.artists || [], max = Math.max(1, ...L.map((x) => x.score || 0));
    return L.map((x) => ({ name: x.name, sim: (x.score || 0) / max, mbid: x.mbid }));
  } catch { return []; }
}
async function tagAlbums(tag, page) {
  const j = await lf('tag.gettopalbums', { tag, limit: '50', page: String(page || 1) }).catch(() => null);
  return ((j && j.albums && j.albums.album) || []).map((a) => ({ name: a.name, artist: a.artist && a.artist.name }));
}
async function farPool() {
  const j = await lf('chart.gettoptags', { limit: '200' }).catch(() => null);
  const chart = ((j && j.tags && j.tags.tag) || []).map((t) => t.name);
  // 차트 태그는 흔한 것 위주라, 장르 지도의 독특한 장르 이름(영어 태그)도 섞는다
  const atlas = GENRES2.filter((g) => !g.home).map((g) => g.kw.source.split('|')[0].replace(/\\b|[\\^$()]/g, '').trim()).filter((x) => /^[a-z -]{3,}$/.test(x));
  return [...atlas, ...chart];
}
import { GENRES as GENRES2 } from './engine.js';
const FIXT = { kraut: 'krautrock', prog: 'progressive rock', stoner: 'stoner rock', 'garage rock': 'garage rock', ethio: 'ethio-jazz', exotica: 'exotica', 'library music': 'library music' };
export const SUGGEST = () => GENRES2.filter((g) => !g.home).map((g) => g.kw.source.split('|')[0].replace(/\\b|[\\^$()]/g, '').trim()).filter((x) => /^[a-z -]{3,}$/.test(x)).map((x) => FIXT[x] || x);
// Spotify에서 그 아티스트의 대표 정규 앨범(검색 순서 = 인기)
export async function findTopAlbum(artist) {
  try {
    const j = await C().api('/search?type=album&limit=10&market=from_token&q=' + encodeURIComponent(`artist:${artist}`));
    const L = ((j && j.albums && j.albums.items) || []).filter((x) => x && (x.artists || []).some((y) => norm(y.name) === norm(artist)));
    const a = L.find((x) => x.album_type === 'album') || L[0];
    if (!a) return null;
    return findAlbum({ artist, album: a.name, year: +(a.release_date || '').slice(0, 4) || 0 });
  } catch { return null; }
}
const card = (slot, slotName, tag, artist, album, whyText, extra = {}) => ({
  slot, slotName, g: { id: 't:' + TX.cleanTag(tag || artist), name: tag || artist, desc: extra.desc || '' }, seed: { artist, album: album || '', year: 0 }, why: { text: whyText }, tag, ...extra,
});
// 태그 하나에서 아직 안 본 인기 앨범 한 장(Spotify에서 실제로 찾고, 연대 필터가 있으면 맞을 때까지)
async function albumFromTag(tag, ctx, dec) {
  for (const page of [1 + Math.floor(Math.random() * 2), 3, 1]) {
    const L = await tagAlbums(tag, page);
    for (let k = 0; k < 6; k++) {
      const a = TX.pickAlbum(L, ctx); if (!a) break;
      ctx.seen[TX.albumKey(a.artist, a.name)] = { t: Date.now(), g: 't:' + tag, miss: 1 };
      const alb = await findAlbum({ artist: a.artist, album: a.name, year: 0 }).catch(() => null);
      if (!alb || !alb.tracks.length) continue;
      if (dec && dec.length && !dec.includes(Math.floor(+alb.year / 10) * 10)) continue;
      delete ctx.seen[TX.albumKey(a.artist, a.name)];
      ctx.avoid.add(norm(a.artist));
      return { a, alb };
    }
  }
  return null;
}
async function finish(cards) {
  await Promise.all(cards.map(async (h) => { h.im = await loadImg(h.alb.img); h.pal = paletteOf(h.im); }));
  return cards;
}
const knownSet = (P) => new Set((P.arts || []).map((a) => norm(a.name)));
function farCandidates(pool2, avoid, st) { return TX.farTags(pool2, avoid, st.fb); }
async function farCard(P, st, ctx, avoid) {
  if (await hasLf()) {
    const F = farCandidates(await farPool(), avoid, st);
    for (let i = 0; i < 4 && F.length; i++) {
      const t = TX.pick(F, Math.random, 1, 40); F.splice(F.indexOf(t), 1);
      const got = await albumFromTag(t.tag, ctx); if (!got) continue;
      return { ...card('out', '완전 다른 곳', t.tag, got.a.artist, got.a.name, `'${t.tag}' — 지금 범위와 한 낱말도 겹치지 않는 갈래의 인기 판`), alb: got.alb };
    }
  }
  // 키 없음 · 못 찾음: 장르 지도에서 다른 갈래 한 장
  const H = dealHand(P, { ...digState(), filter: {} }).filter((x) => x.slot === 'out');
  for (const h of H) { const alb = await findAlbum(h.seed).catch(() => null); if (alb && alb.tracks.length) return { ...h, slotName: '완전 다른 곳', alb }; }
  return null;
}
// ── 모드별 네 장. 모두 [{ slot, slotName, g:{id,name,desc}, seed, why:{text}, alb, im, pal }]
// 취향: 내 아티스트와 비슷한 아티스트들의 태그 중 집에 없는 이웃 태그 세 개 → 그 태그 인기 판, + 먼 태그 한 장
export async function tasteHand(P, onStep) {
  if (!(await hasLf()) || !(P.arts && P.arts.length)) return makeHand(P); // 키가 없으면 예전 장르 지도
  const st = digState(), home = TX.homeTags(P.arts), known = knownSet(P);
  const ctx = { seen: { ...st.seen }, known, avoid: new Set(), rnd: Math.random };
  onStep && onStep('비슷한 아티스트 찾는 중');
  const mine = [...P.arts].sort(() => Math.random() - 0.5).slice(0, 6);
  const cands = [];
  await pool(mine, 3, async (a) => { for (const s of (await similar(a.name)).slice(3, 30)) if (!known.has(norm(s.name))) cands.push({ ...s, via: a.name }); });
  const pickC = cands.sort(() => Math.random() - 0.5).slice(0, 16);
  onStep && onStep('이웃 태그 읽는 중');
  await pool(pickC, 4, async (c) => { c.tags = await artistTags(c.name); });
  const N = TX.pickSpread(TX.neighborTags(home, pickC, st.fb), 6, Math.random);
  onStep && onStep('판 고르는 중');
  const out = [];
  for (const t of N) {
    if (out.length >= 3) break;
    const got = await albumFromTag(t.tag, ctx); if (!got) continue;
    out.push({ ...card('in', '이웃 태그', t.tag, got.a.artist, got.a.name, `자주 듣는 ${t.via} → 비슷한 ${t.art}에 붙은 '${t.tag}'`), alb: got.alb });
  }
  if (out.length < 3) throw new Error('이웃 판을 찾지 못했습니다');
  const far = await farCard(P, st, ctx, [...TX.topOf(home, 12), ...out.map((x) => x.tag)]);
  if (!far) throw new Error('먼 판을 찾지 못했습니다');
  out.push(far); saveSeen(out);
  return finish(out);
}
// 태그: 고른 태그들(라운드로빈)에서 세 장 + 먼 태그 한 장. 연대 필터는 Spotify 발매 연도로
export async function tagHand(P, tags, dec, onStep) {
  if (!(await hasLf())) throw Object.assign(new Error('태그 디깅은 Last.fm 키가 필요해요'), { nokey: 1 });
  const st = digState(), ctx = { seen: { ...st.seen }, known: knownSet(P), avoid: new Set(), rnd: Math.random };
  const T = [...tags].sort(() => Math.random() - 0.5), out = [];
  onStep && onStep('판 고르는 중');
  for (let i = 0; out.length < 3 && i < 9; i++) {
    const t = T[i % T.length];
    const got = await albumFromTag(t, ctx, dec); if (!got) continue;
    out.push({ ...card('in', '고른 태그', t, got.a.artist, got.a.name, `'${t}' 인기 판 중 아직 안 들은 것`), alb: got.alb });
  }
  if (out.length < 3) throw new Error('이 태그에서 판을 찾지 못했습니다');
  const far = await farCard(P, st, ctx, [...tags, ...TX.topOf(TX.homeTags(P.arts || []), 8)]);
  if (!far) throw new Error('먼 판을 찾지 못했습니다');
  out.push(far); saveSeen(out);
  return finish(out);
}
// 씨앗: 씨앗 아티스트 → 비슷한 아티스트(한 다리, 뻔한 위쪽은 건너뜀) · 그 옆(두 다리)에서 세 장 + 먼 곳 한 장
export async function seedHand(P, seedArt, onStep) {
  const st = digState(), known = knownSet(P);
  onStep && onStep(`${seedArt}에서 출발`);
  const hop1 = await similar(seedArt);
  if (!hop1.length) throw new Error('비슷한 아티스트를 찾지 못했습니다');
  const mids = hop1.slice(4, 20).sort(() => Math.random() - 0.5).slice(0, 2);
  const hop2 = []; for (const m of mids) for (const x of (await similar(m.name)).slice(4, 40)) hop2.push({ ...x, via: m.name });
  const { one, two } = TX.seedSteps(hop1, hop2, { seed: seedArt, known });
  const lfOn = await hasLf();
  // 같은 결만 나오지 않게: Last.fm이면 대표 태그가 서로 다른 아티스트로
  const seedTop = lfOn ? ((await artistTags(seedArt))[0] || [''])[0] : '';
  const usedTag = new Set([seedTop]), usedArt = new Set(), out = [];
  const tryA = async (a, label, whyText) => {
    if (usedArt.has(norm(a.name))) return false;
    let tag = '';
    if (lfOn) { const AT = await artistTags(a.name); tag = (AT.find((t) => TX.isDigTag(t[0])) || AT.find((t) => TX.isGenreTag(t[0])) || [''])[0]; if (tag && usedTag.has(tag)) return false; }
    let alb = null;
    if (lfOn) {
      const j = await lf('artist.gettopalbums', { artist: a.name, limit: '6' }).catch(() => null);
      const L = ((j && j.topalbums && j.topalbums.album) || []).map((x) => ({ name: x.name, artist: a.name }));
      const pa = TX.pickAlbum(L, { seen: st.seen, rnd: () => 0 });
      if (pa) alb = await findAlbum({ artist: a.name, album: pa.name, year: 0 }).catch(() => null);
    }
    if (!alb) alb = await findTopAlbum(a.name);
    if (!alb || !alb.tracks.length || st.seen[TX.albumKey(alb.artist, alb.name)]) return false;
    usedArt.add(norm(a.name)); if (tag) usedTag.add(tag);
    out.push({ ...card('in', label, tag || a.name, a.name, alb.name, whyText), alb, g: { id: 't:' + TX.cleanTag(tag || a.name), name: tag || a.name, desc: '' } });
    return true;
  };
  const sh = (L) => [...L].sort(() => Math.random() - 0.5);
  for (const a of sh(one).slice(0, 8)) { if (await tryA(a, '씨앗 한 다리', `씨앗 ${seedArt} → 비슷한 ${a.name}`)) break; }
  for (const a of sh(two).slice(0, 16)) { if (out.length >= 3) break; await tryA(a, '씨앗 두 다리', `씨앗 ${seedArt} → ${a.via} → ${a.name}`); }
  for (const a of sh(one).slice(0, 12)) { if (out.length >= 3) break; await tryA(a, '씨앗 한 다리', `씨앗 ${seedArt} → 비슷한 ${a.name}`); }
  if (out.length < 3) throw new Error('씨앗 근처에서 판을 찾지 못했습니다');
  const ctx = { seen: { ...st.seen }, known, avoid: usedArt, rnd: Math.random };
  const far = await farCard(P, st, ctx, [seedTop, ...out.map((x) => x.tag)].filter(Boolean));
  if (!far) throw new Error('먼 판을 찾지 못했습니다');
  out.push(far); saveSeen(out);
  return finish(out);
}
function saveSeen(cards) {
  const st = digState();
  st.recent = [...cards.map((h) => h.g.id), ...(st.recent || [])].slice(0, 12);
  saveState(st, false);
}
export const albumKey = TX.albumKey;
