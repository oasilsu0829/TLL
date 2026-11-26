// 디깅: 아티스트 장르 태그(MusicBrainz, 무료·키 없음). Spotify 개발 모드 앱은 아티스트 genres가 비어 올 때가 많아서 대신 쓴다
// GET /api/music/tags?a=아티스트 → { tags: [[태그, 세기]], mb } (못 찾으면 tags: []). Workers 캐시 30일(못 찾음 3일)
// MusicBrainz는 초당 1번 정도만 받으니 화면이 아티스트를 하나씩 물어본다. 503이면 화면이 잠깐 쉬고 다시
import { json } from './util.js';

const UA = 'TLL-turntable/1.0 (personal music app)';
const VER = 'v1';
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function pickArtist(list, name) {
  const n = norm(name);
  const L = (list || []).filter((a) => a && (a.score || 0) >= 85);
  return L.find((a) => norm(a.name) === n || (a.aliases || []).some((x) => norm(x.name) === n)) || (L[0] && (L[0].score || 0) >= 95 ? L[0] : null);
}
export const topTags = (a) => (a && a.tags ? a.tags : [])
  .map((t) => [String(t.name || '').toLowerCase().slice(0, 40), Math.max(0, +t.count || 0)])
  .filter((t) => t[0]).sort((x, y) => y[1] - x[1]).slice(0, 12);

export async function tagsApi(req) {
  const a = (new URL(req.url).searchParams.get('a') || '').trim().slice(0, 120);
  if (!a) return json({ error: '아티스트 이름이 필요합니다' }, 400);
  const cache = typeof caches !== 'undefined' && caches.default;
  const key = new Request(`https://tags.cache/${VER}?a=` + encodeURIComponent(norm(a) || a));
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const q = 'artist:"' + a.replace(/["\\]/g, ' ') + '"';
  let r;
  try {
    r = await fetch('https://musicbrainz.org/ws/2/artist?fmt=json&limit=5&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  } catch (err) { return json({ error: String(err.message || err) }, 502); }
  if (r.status === 503 || r.status === 429) return json({ error: '잠깐 뒤에 다시', retry: 1 }, 503);
  if (!r.ok) return json({ error: 'MusicBrainz ' + r.status }, 502);
  const j = await r.json().catch(() => ({}));
  const hit = pickArtist(j.artists, a);
  const body = { tags: topTags(hit), mb: hit ? hit.id : null };
  const res = json(body);
  res.headers.set('Cache-Control', 'public, max-age=' + (body.tags.length ? 2592000 : 259200));
  if (cache) await cache.put(key, res.clone());
  return res;
}
