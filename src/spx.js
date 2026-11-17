// 위클리·데이리스트 정보: Spotify가 개발 모드 앱에 자동 플레이리스트(/playlists/{id})를 막아 두어서
// 로그인 없이 열리는 임베드 페이지(open.spotify.com/embed/playlist/<id>)의 __NEXT_DATA__에서 이름·곡 목록을 읽는다.
// GET /api/music/spx?id=<22자> → { name, img, tracks: [{ id, uri, name, artist, ms }] } (못 읽으면 { none: true })
// 데이리스트는 계정 전용이라 임베드가 빈 목록('daylist', 0곡)을 줄 때가 있다 → 화면이 재생 중 대기열(/me/player/queue)로 채운다
import { json } from './util.js';

const TTL = 900; // 15분

export function parseEmbed(html) {
  const m = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let d; try { d = JSON.parse(m[1]); } catch { return null; }
  const e = d && d.props && d.props.pageProps && d.props.pageProps.state && d.props.pageProps.state.data && d.props.pageProps.state.data.entity;
  if (!e) return null;
  const src = (e.coverArt && e.coverArt.sources) || [];
  const tracks = (e.trackList || []).filter((t) => t && /^spotify:track:[A-Za-z0-9]{22}$/.test(t.uri || '')).slice(0, 200).map((t) => ({
    id: t.uri.split(':')[2], uri: t.uri, name: String(t.title || '').slice(0, 200), artist: String(t.subtitle || '').slice(0, 200), ms: +t.duration || 0,
  }));
  return { name: String(e.name || e.title || '').slice(0, 200), img: (src[0] && src[0].url) || '', tracks };
}

export async function spxApi(req) {
  const url = new URL(req.url), id = url.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return json({ error: 'id가 이상합니다' }, 400);
  const cache = caches.default, ck = new Request('https://tll-cache/spx/v1/' + id);
  const hit = await cache.match(ck);
  if (hit) return new Response(hit.body, hit);
  let out = { none: true };
  try {
    const r = await fetch('https://open.spotify.com/embed/playlist/' + id, { headers: { 'User-Agent': 'Mozilla/5.0 (TLL turntable)', 'Accept-Language': 'ko,en;q=0.8' } });
    if (r.ok) { const p = parseEmbed(await r.text()); if (p) out = p; }
  } catch {}
  const res = json(out);
  res.headers.set('Cache-Control', 'public, max-age=' + TTL);
  await cache.put(ck, res.clone()).catch(() => {});
  return res;
}
