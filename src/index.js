// T/L/L Worker: 화면(public/)과 음악 API(/api/music/*)
// - /        내 턴테이블
// - /deck/   친구용 턴테이블: 같은 index.html(화면이 주소를 보고 친구 모드로 바뀐다). 아이콘·매니페스트는 public/deck/
import { musicApi } from './music.js';
import { json, ensureTables } from './util.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    if (path === '/deck') return Response.redirect(new URL('/deck/', url).toString(), 301);
    if (path === '/deck/' || path === '/deck/index.html') {
      const r = await env.ASSETS.fetch(new Request(new URL('/', url), req));
      return new Response(r.body, r);
    }
    // 예전 Sabathia 주소 모양(/music/…)으로 들어오면 새 주소로
    if (path === '/music' || path.startsWith('/music/')) {
      return Response.redirect(new URL((path.replace(/^\/music\/?/, '/') || '/') + url.search + url.hash, url).toString(), 301);
    }
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);

    // 인증은 Spotify 토큰(X-Spotify)으로 music.js가 한다. 손님 잼 창은 로그인 없이 곡만 보낸다
    try { await ensureTables(env); } catch (err) { return json({ error: err.message || String(err) }, 500); }
    if (path === '/api/music' || path.startsWith('/api/music/')) return musicApi(req, env, path);
    return json({ error: '없는 주소입니다' }, 404);
  },
};
