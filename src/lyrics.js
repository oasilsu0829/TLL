// 가사: 시간 맞춘 가사(LRC)를 두 곳에서 같이 찾는다. 전체화면에서만 부른다
//   1) LRCLIB(lrclib.net, 무료·키 없음)  2) NetEase 云音乐(music.163.com 공개 검색, 한국·아시아 곡이 많음)
// GET /api/music/lyrics?t=곡&a=아티스트(여러 번)&al=앨범&d=길이(초)
//   → { synced, plain, inst, src } (못 찾으면 { none: true }). 같은 곡은 Workers 캐시에 둔다(찾음 7일 · 못 찾음 6시간)
// 2026-11-13 개편(사용자: '가사 너무 안 떠, 특히 한국 가사'): 예전엔 LRCLIB에서 제목·가수가 거의 그대로 맞아야만 찾았다.
//   Spotify 이름(영문 'Through the Night' · 'JANNABI')과 가사 쪽 이름('밤편지' · '잔나비' · 'IU (아이유)')이 달라 못 찾던 것을
//   괄호 속 다른 이름, 띄어쓰기·기호 무시 비교, 제목만으로 찾은 뒤 가수·길이로 고르기, NetEase 추가로 메운다
import { json } from './util.js';

const LRCLIB = 'https://lrclib.net/api';
const NE = 'https://music.163.com/api';
const UA = 'TLL-turntable/1.0';
const VER = 'v2';

// 'Song (feat. X) - 2011 Remaster' → 'Song'
export function cleanTitle(s) {
  return String(s || '')
    .replace(/\s*[([](feat\.?|ft\.?|with|prod\.?)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*(remaster|version|live|mono|stereo|edit|mix|demo|deluxe|bonus|from|ost).*$/i, '')
    .replace(/\s*[([][^)\]]*(remaster|version|live|mono|stereo|edit|demo|deluxe|bonus|inst\.?)[^)\]]*[)\]]/gi, '')
    .trim();
}

// 비교용: 소문자, 글자·숫자만(한글·한자·가나 포함)
export const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// 'Through the Night (밤편지)' → ['Through the Night (밤편지)', 'Through the Night', '밤편지']
export function names(s) {
  const out = new Set();
  const add = (x) => { x = String(x || '').trim(); if (norm(x)) out.add(x); };
  add(s);
  const c = cleanTitle(s); add(c);
  add(c.replace(/\s*[([][^)\]]*[)\]]/g, ''));
  for (const m of c.matchAll(/[([]([^)\]]+)[)\]]/g)) add(m[1]);
  return [...out];
}
const artistNames = (list) => [...new Set(list.flatMap((a) => String(a || '').split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|、|\/)\s*/i)).flatMap(names))];

const like = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)))); };
const exact = (a, b) => { const x = norm(a); return !!x && x === norm(b); };

// 후보 하나가 찾는 곡과 얼마나 맞나. 안 맞으면 null
//   제목: 이름(괄호 속 포함) 하나라도 같으면. 가수: 하나라도 같으면(다르면 제목이 똑같고 길이가 2.5초 안일 때만)
//   길이: 8초 넘게 다르면 다른 녹음
export function score(c, q) {
  const T = names(q.t), CT = names(c.title);
  let ts = 0;
  for (const a of T) for (const b of CT) ts = Math.max(ts, exact(a, b) ? 3 : like(a, b) ? 1 : 0);
  if (!ts) return null;
  const diff = q.d && c.dur ? Math.abs(c.dur - q.d) : null;
  if (diff != null && diff > 8) return null;
  const A = artistNames(q.a), CA = artistNames(c.artists || []);
  const as = !CA.length ? 0 : A.some((a) => CA.some((b) => exact(a, b))) ? 3 : A.some((a) => CA.some((b) => like(a, b))) ? 2 : -1;
  if (as < 0 && !(ts === 3 && diff != null && diff <= 2.5 && norm(q.t).length >= 2)) return null;
  return ts + as + (c.synced ? 4 : 0) - (diff == null ? 1 : diff * 0.4);
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(new URL(url).hostname + ' ' + r.status);
  return r.json();
}

/* ── LRCLIB ── */
const lrc = (path, qs) => getJson(LRCLIB + path + '?' + new URLSearchParams(qs));
const fromLrclib = (x) => ({ synced: x.syncedLyrics || null, plain: x.plainLyrics || null, inst: !!x.instrumental && !x.syncedLyrics && !x.plainLyrics, src: 'LRCLIB' });
const hasL = (x) => x && (x.syncedLyrics || x.plainLyrics || x.instrumental);

// 예전 방식(길이 5초 · 시간 맞춘 가사 먼저). 남겨 둠
export function pick(list, d) {
  const ok = (Array.isArray(list) ? list : []).filter((x) => hasL(x) && (!d || !x.duration || Math.abs(x.duration - d) <= 5));
  ok.sort((p, q) => (!!q.syncedLyrics - !!p.syncedLyrics) || (Math.abs((p.duration || d) - d) - Math.abs((q.duration || d) - d)));
  return ok[0] || null;
}

export async function lrclib(q) {
  const a0 = q.a[0] || '', t2 = cleanTitle(q.t);
  if (q.al && q.d) { // 딱 맞는 것 먼저(빠름)
    const x = await lrc('/get', { track_name: q.t, artist_name: a0, album_name: q.al, duration: String(q.d) }).catch(() => null);
    if (x && x.syncedLyrics) return fromLrclib(x);
  }
  const alt = names(q.t).filter((x) => x !== q.t && x !== t2);
  const tries = [
    { track_name: q.t, artist_name: a0 },
    t2 !== q.t && { track_name: t2, artist_name: a0 },
    { q: `${t2} ${a0}` },
    { q: t2 },
    ...alt.slice(0, 2).map((x) => ({ q: x })),
  ].filter(Boolean);
  const got = await Promise.allSettled(tries.map((qs) => lrc('/search', qs)));
  if (got.every((g) => g.status === 'rejected')) throw got[0].reason;
  const seen = new Set();
  let best = null, bs = -Infinity;
  for (const g of got) {
    for (const x of (g.status === 'fulfilled' && Array.isArray(g.value) ? g.value : [])) {
      if (!hasL(x) || seen.has(x.id)) continue;
      seen.add(x.id);
      const s = score({ title: x.trackName || x.name, artists: [x.artistName], dur: x.duration, synced: !!x.syncedLyrics }, q);
      if (s != null && s > bs) { best = x; bs = s; }
    }
  }
  return best ? fromLrclib(best) : null;
}

/* ── NetEase ── */
const neHead = { Referer: 'https://music.163.com/' };
// 맨 앞·뒤의 크레딧 줄(作词 : … · 작곡 : …)과 '순음악' 표시는 가사가 아니다
const CREDIT = /^\s*(作词|作曲|编曲|編曲|制作人|制作|監製|监制|混音|母带|录音|和声|吉他|贝斯|鼓|键盘|弦乐|配唱|出品|发行|企划|统筹|OP|SP|Lyrics?|Lyricist|Written|Composer|Composed|Music|Arrange[rd]?|Produc(?:er|ed)|작사|작곡|편곡|프로듀서)(?![A-Za-z])[^:：]{0,20}[:：]/i;
export function cleanNetease(text) {
  const out = [];
  let inst = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const s = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (/纯音乐.*欣赏/.test(s)) { inst = true; continue; }
    if (s && CREDIT.test(s)) continue;
    out.push(raw);
  }
  const body = out.join('\n');
  const lines = out.map((x) => x.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean);
  if (!lines.length) return inst ? { synced: null, plain: null, inst: true, src: 'NetEase' } : null;
  const timed = out.filter((x) => /\[\d+:\d+/.test(x)).length;
  return timed >= lines.length * 0.6 ? { synced: body, plain: null, inst: false, src: 'NetEase' } : { synced: null, plain: lines.join('\n'), inst: false, src: 'NetEase' };
}

async function neSearch(s) {
  const j = await getJson(NE + '/search/get?' + new URLSearchParams({ s, type: '1', limit: '20', offset: '0' }), neHead);
  return (j && j.result && Array.isArray(j.result.songs) ? j.result.songs : []).map((x) => ({
    id: x.id, title: x.name, alias: [...(x.alias || []), ...(x.transNames || [])], artists: (x.artists || x.ar || []).map((a) => a.name), dur: (x.duration || x.dt || 0) / 1000,
  }));
}
export async function netease(q) {
  const t2 = cleanTitle(q.t), a0 = q.a[0] || '';
  const rank = (L) => L.map((c) => {
    let s = null;
    for (const t of [c.title, ...c.alias]) { const v = score({ ...c, title: t }, q); if (v != null && (s == null || v > s)) s = v; }
    return { c, s };
  }).filter((x) => x.s != null).sort((x, y) => y.s - x.s);
  let L = rank(await neSearch(`${t2} ${a0}`));
  if (!L.length) L = rank(await neSearch(t2));
  for (const { c } of L.slice(0, 3)) {
    const j = await getJson(NE + '/song/lyric?' + new URLSearchParams({ id: String(c.id), lv: '1', kv: '0', tv: '0' }), neHead).catch(() => null);
    const r = j && !j.nolyric && !j.uncollected && j.lrc && j.lrc.lyric ? cleanNetease(j.lrc.lyric) : j && j.nolyric ? { synced: null, plain: null, inst: true, src: 'NetEase' } : null;
    if (r) return r;
  }
  return null;
}

// 두 곳을 같이 찾는다. 시간 맞춘 가사(LRCLIB > NetEase) > 그냥 가사 > 연주곡
export async function find(q0) {
  const q = { ...q0, a: Array.isArray(q0.a) ? q0.a.filter(Boolean) : [q0.a].filter(Boolean) };
  const [L, N] = await Promise.allSettled([lrclib(q), netease(q)]);
  const l = L.status === 'fulfilled' ? L.value : null, n = N.status === 'fulfilled' ? N.value : null;
  const r = [l, n].find((x) => x && x.synced) || [l, n].find((x) => x && x.plain) || [l, n].find((x) => x && x.inst);
  if (r) return r;
  // 둘 다 오류면 캐시하지 않게 알린다
  if (L.status === 'rejected' && N.status === 'rejected') throw L.reason;
  return { none: true, partial: L.status === 'rejected' || N.status === 'rejected' };
}

export async function lyricsApi(req) {
  const u = new URL(req.url), sp = u.searchParams;
  const q = {
    t: (sp.get('t') || '').slice(0, 200), a: sp.getAll('a').map((x) => x.slice(0, 200)).filter(Boolean).slice(0, 6),
    al: (sp.get('al') || '').slice(0, 200), d: Math.round(Number(sp.get('d')) || 0),
  };
  if (!q.t || !q.a.length) return json({ error: '곡 이름과 아티스트가 필요합니다' }, 400);
  const cache = typeof caches !== 'undefined' && caches.default;
  const key = new Request(`https://lyrics.cache/${VER}?` + new URLSearchParams({ t: q.t, a: q.a.join('\u001f'), al: q.al, d: String(q.d) }));
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let body;
  try { body = await find(q); } catch (err) { return json({ error: err.message || String(err) }, 502); }
  const partial = body.partial; delete body.partial;
  const res = json(body);
  res.headers.set('Cache-Control', 'public, max-age=' + (body.none ? 21600 : 604800));
  if (cache && !partial) await cache.put(key, res.clone());
  return res;
}
