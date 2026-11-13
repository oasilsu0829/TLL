// 가사: LRCLIB(lrclib.net, 무료·키 없음)에서 시간 맞춘 가사(LRC)를 찾아 준다. 전체화면에서만 부른다
// GET /api/music/lyrics?t=곡&a=아티스트&al=앨범&d=길이(초)
//   → { synced, plain, inst } (못 찾으면 { none: true }). 같은 곡은 Workers 캐시에 둔다(찾음 7일 · 못 찾음 1일)
import { json } from './util.js';

const BASE = 'https://lrclib.net/api';
const UA = 'TLL-turntable/1.0';

// 'Song (feat. X) - 2011 Remaster' → 'Song'
export function cleanTitle(s) {
  return String(s || '')
    .replace(/\s*[([](feat\.?|ft\.?|with|prod\.?)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*(remaster|version|live|mono|stereo|edit|mix|demo|deluxe|bonus).*$/i, '')
    .replace(/\s*[([][^)\]]*(remaster|version|live|mono|stereo|edit|demo|deluxe|bonus)[^)\]]*[)\]]/gi, '')
    .trim();
}

const has = (x) => x && (x.syncedLyrics || x.plainLyrics || x.instrumental);
const out = (x) => ({ synced: x.syncedLyrics || null, plain: x.plainLyrics || null, inst: !!x.instrumental && !x.syncedLyrics && !x.plainLyrics });

// 길이가 5초 넘게 다르면 다른 녹음으로 본다. 시간 맞춘 가사 > 길이 가까운 것
export function pick(list, d) {
  const ok = (Array.isArray(list) ? list : []).filter((x) => has(x) && (!d || !x.duration || Math.abs(x.duration - d) <= 5));
  ok.sort((p, q) => (!!q.syncedLyrics - !!p.syncedLyrics) || (Math.abs((p.duration || d) - d) - Math.abs((q.duration || d) - d)));
  return ok[0] || null;
}

async function get(path, qs) {
  const r = await fetch(BASE + path + '?' + new URLSearchParams(qs), { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('lrclib ' + r.status);
  return r.json();
}

export async function find({ t, a, al, d }) {
  const t2 = cleanTitle(t);
  if (al && d) {
    const x = await get('/get', { track_name: t, artist_name: a, album_name: al, duration: String(d) });
    if (has(x)) return out(x);
  }
  for (const qs of [{ track_name: t, artist_name: a }, t2 !== t && { track_name: t2, artist_name: a }, { q: t2 + ' ' + a }]) {
    if (!qs) continue;
    const x = pick(await get('/search', qs), d);
    if (x) return out(x);
  }
  return { none: true };
}

export async function lyricsApi(req) {
  const u = new URL(req.url);
  const q = { t: (u.searchParams.get('t') || '').slice(0, 200), a: (u.searchParams.get('a') || '').slice(0, 200), al: (u.searchParams.get('al') || '').slice(0, 200), d: Math.round(Number(u.searchParams.get('d')) || 0) };
  if (!q.t || !q.a) return json({ error: '곡 이름과 아티스트가 필요합니다' }, 400);
  const cache = typeof caches !== 'undefined' && caches.default;
  const key = new Request('https://lyrics.cache/v1?' + new URLSearchParams({ t: q.t, a: q.a, al: q.al, d: String(q.d) }));
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let body;
  try { body = await find(q); } catch (err) { return json({ error: err.message || String(err) }, 502); }
  const res = json(body);
  res.headers.set('Cache-Control', 'public, max-age=' + (body.none ? 86400 : 604800));
  if (cache) await cache.put(key, res.clone());
  return res;
}
