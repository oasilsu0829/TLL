// 디깅 데이터 프록시(2026-11-26, 사용자 선택 '개선안 2(태그 그래프 + 실제 인기 앨범) + 3(씨앗에서 출발)')
// GET /api/music/lf?m=<메서드>&<인자>  → Last.fm API(키는 Worker secret LASTFM_KEY, 화면엔 안 보냄). 키가 없으면 501 { nokey: 1 }
// GET /api/music/lb/similar?mbid=<아티스트 MBID> → ListenBrainz 비슷한 아티스트(키 없음). 씨앗 모드가 Last.fm 키 없이도 돌게
// 둘 다 Workers 캐시(7일, 차트는 1일)
import { json } from './util.js';

const UA = 'TLL-turntable/1.0 (personal music app)';
// 쓰는 메서드와 받는 인자만 통과
const METHODS = {
  'tag.gettopalbums': ['tag', 'limit', 'page'],
  'tag.gettopartists': ['tag', 'limit', 'page'],
  'tag.getinfo': ['tag'],
  'chart.gettoptags': ['limit', 'page'],
  'artist.gettoptags': ['artist'],
  'artist.getsimilar': ['artist', 'limit'],
  'artist.gettopalbums': ['artist', 'limit'],
  'album.gettoptags': ['artist', 'album'],
};
const LB_ALGO = 'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

async function cached(key, ttl, make) {
  const cache = typeof caches !== 'undefined' && caches.default;
  const k = new Request('https://dig.cache/v1/' + key);
  if (cache) { const hit = await cache.match(k); if (hit) return hit; }
  const res = await make();
  if (res.ok && cache) { res.headers.set('Cache-Control', 'public, max-age=' + ttl); await cache.put(k, res.clone()); }
  return res;
}

export async function lastfmApi(req, env) {
  const sp = new URL(req.url).searchParams, m = (sp.get('m') || '').toLowerCase();
  if (!METHODS[m]) return json({ error: '없는 메서드입니다' }, 400);
  if (!env.LASTFM_KEY) return json({ nokey: 1, error: 'Last.fm 키(LASTFM_KEY)가 Worker에 없습니다' }, 501);
  const q = new URLSearchParams({ method: m, format: 'json', autocorrect: '1' });
  for (const p of METHODS[m]) { const v = sp.get(p); if (v) q.set(p, v.slice(0, 200)); }
  const key = m + '?' + [...q].filter(([k]) => !['method', 'format', 'autocorrect'].includes(k)).map(([k, v]) => k + '=' + encodeURIComponent(v.toLowerCase())).join('&');
  return cached('lf/' + key, m.startsWith('chart.') ? 86400 : 604800, async () => {
    q.set('api_key', env.LASTFM_KEY);
    let r;
    try { r = await fetch('https://ws.audioscrobbler.com/2.0/?' + q, { headers: { 'User-Agent': UA } }); } catch (e) { return json({ error: String(e.message || e) }, 502); }
    const j = await r.json().catch(() => null);
    if (!j) return json({ error: 'Last.fm ' + r.status }, 502);
    if (j.error) return json({ error: j.message || 'Last.fm 오류 ' + j.error, code: j.error }, j.error === 10 || j.error === 26 ? 501 : j.error === 29 ? 503 : 404);
    return json(j);
  });
}

export async function lbSimilarApi(req) {
  const mbid = (new URL(req.url).searchParams.get('mbid') || '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(mbid)) return json({ error: 'MBID가 필요합니다' }, 400);
  return cached('lb/' + mbid, 604800, async () => {
    let r;
    try { r = await fetch(`https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=${mbid}&algorithm=${LB_ALGO}`, { headers: { 'User-Agent': UA } }); } catch (e) { return json({ error: String(e.message || e) }, 502); }
    if (!r.ok) return json({ error: 'ListenBrainz ' + r.status }, r.status === 429 ? 503 : 502);
    const L = await r.json().catch(() => []);
    return json({ artists: (Array.isArray(L) ? L : []).slice(0, 100).map((x) => ({ name: x.name, mbid: x.artist_mbid, score: x.score })) });
  });
}
