// T/L/L 음악 API (/api/music). 인증은 Spotify 토큰(X-Spotify)으로만 한다
// - 크레이트: Spotify 계정마다 따로(D1 settings k = 'music.u.<Spotify id>'). 요청에 X-Spotify(액세스 토큰)를 붙이면
//   서버가 Spotify /me로 누구인지 확인한다(클라이언트가 id를 우기지 못하게). 합치기는 화면과 같은 코드(public/merge.js)
//   예전(계정 나누기 전) 문서 k = 'music'은 처음 동기화한 계정이 가져간다(k = 'music.owner'에 기록)
// - 잼: 지금 열린 잼 하나(k = 'music.jam')와 손님 요청 대기열(jam_q 테이블). 호스트 화면이 4초마다 가져가 자기 토큰으로 처리한다
//   · 곡 넣기(kind ''): 정확한 곡(uris) 또는 곡 이름(q). 로그인 없는 손님도 됨
//   · 조작(kind 'ctl', 로그인한 참가자만): play · pause · next · prev · from(i). 잼은 하나라 누가 눌러도 모두의 음악이 같이 움직인다
//   · 참가자(k = 'music.jam.m'): 로그인한 친구가 잼에 들어오면 2초마다 hello. 30초 넘게 소식 없으면 나간 것
//   · 재생 위치: 호스트가 올린 위치(ps)와 서버 시각(pu)을 같이 두고, 읽을 때 서버 시각(now)을 붙여 준다 → 참가자 기기가 시계 차이 없이 따라 튼다
import '../public/merge.js';
import { json, httpError, readBody } from './util.js';

const { clean, merge } = globalThis.MusicMerge;
const MAX_BYTES = 500000;
const JAM_TTL = 8 * 3600e3;       // 8시간 넘게 소식 없는 잼은 끝난 것으로 본다
const MAX_Q = 40;                 // 손님 대기열 한도(잼마다)
const MEMBER_TTL = 30000;

// ---------- 누구인가: Spotify 토큰 → 계정 id (isolate 안에서 10분 기억) ----------
const who = new Map();
async function spotifyUser(req) {
  const tk = (req.headers.get('X-Spotify') || '').trim();
  if (!tk) return null;
  const hit = who.get(tk);
  if (hit && hit.exp > Date.now()) return hit;
  const r = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + tk } });
  if (!r.ok) throw httpError(r.status === 401 ? 401 : 502, r.status === 401 ? 'Spotify 로그인이 만료되었습니다' : 'Spotify 확인 실패 ' + r.status);
  const j = await r.json();
  if (!j || !j.id) throw httpError(502, 'Spotify 계정을 읽지 못했습니다');
  const u = { id: String(j.id), name: String(j.display_name || j.id).slice(0, 40), exp: Date.now() + 600000 };
  if (who.size > 200) who.clear();
  who.set(tk, u);
  return u;
}
async function needUser(req) {
  const u = await spotifyUser(req);
  if (!u) throw httpError(401, 'Spotify 로그인이 필요합니다');
  return u;
}

const getV = async (env, k) => {
  const row = await env.DB.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first();
  return row ? row.v : null;
};
const putV = (env, k, v) => env.DB.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run();
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
const userKey = (id) => 'music.u.' + id.replace(/[^\w.-]/g, '_').slice(0, 80);

// 계정 문서. 없으면: 예전 문서를 아무도 안 가져갔을 때 이 계정이 가져간다
async function loadUser(env, uid) {
  const own = await getV(env, userKey(uid));
  if (own != null) return { doc: clean(parse(own)), claimed: false };
  const owner = await getV(env, 'music.owner');
  if (!owner) {
    await putV(env, 'music.owner', uid);
    return { doc: clean(parse(await getV(env, 'music'))), claimed: true };
  }
  if (owner === uid) return { doc: clean(parse(await getV(env, 'music'))), claimed: true };
  return { doc: clean(null), claimed: false };
}

// ---------- 잼 ----------
const SP_ID = /^[A-Za-z0-9]{10,40}$/;
async function liveJam(env) {
  const j = parse(await getV(env, 'music.jam'));
  if (!j || !j.pid || Date.now() - (j.u || 0) > JAM_TTL) return null;
  return j;
}
const s = (x, n) => (typeof x === 'string' ? x.trim().slice(0, n) : '');

async function jamApi(req, env, path, m) {
  if (path === '/api/music/jam' && m === 'GET') {
    const j = await liveJam(env);
    if (!j) return json({ jam: null });
    const { results } = await env.DB.prepare("SELECT label, by FROM jam_q WHERE pid = ? AND kind = '' ORDER BY at").bind(j.pid).all();
    const mm = parse(await getV(env, 'music.jam.m')) || {}, now = Date.now();
    const members = mm.pid === j.pid ? Object.values(mm.m || {}).filter((x) => now - x.at < MEMBER_TTL).map((x) => x.n) : [];
    return json({ jam: { pid: j.pid, name: j.name, host: j.host, tape: j.tape, at: j.at, list: j.list || [], cur: j.cur ?? -1, on: !!j.on, ps: j.ps || 0, pu: j.pu || 0, u: j.u, wait: results || [], members }, now });
  }
  // 호스트: 잼 열기·갱신(셋리스트 · 지금 곡). 가장 최근에 연 사람이 호스트
  if (path === '/api/music/jam' && m === 'PUT') {
    const u = await needUser(req);
    const b = (await readBody(req)) || {};
    if (!SP_ID.test(b.pid || '')) throw httpError(400, '플레이리스트 id가 필요합니다');
    const old = await liveJam(env);
    const list = (Array.isArray(b.list) ? b.list : []).slice(0, 300).map((x) => {
      x = x || {};
      const y = { t: s(x.t, 120), a: s(x.a, 120), by: s(x.by, 40), ms: Math.max(0, Math.floor(+x.ms || 0)) };
      if (/^spotify:track:[A-Za-z0-9]{10,40}$/.test(x.uri || '')) y.uri = x.uri;
      if (/^https:\/\/i\.scdn\.co\//.test(x.img || '')) y.img = s(x.img, 200);
      return y;
    });
    const now = Date.now();
    const j = { pid: b.pid, name: s(b.name, 60) || 'JAM', host: u.name, hostId: u.id, tape: s(b.tape, 20), at: old && old.pid === b.pid ? old.at : now, list, cur: Number.isInteger(b.cur) ? b.cur : -1,
      on: !!b.on, ps: Math.max(0, Math.floor(+b.ps || 0)), pu: now, u: now };
    await putV(env, 'music.jam', JSON.stringify(j));
    if (old && old.pid !== b.pid) await env.DB.prepare('DELETE FROM jam_q WHERE pid = ?').bind(old.pid).run();
    return json({ ok: true });
  }
  if (path === '/api/music/jam' && m === 'DELETE') {
    const u = await needUser(req);
    const pid = new URL(req.url).searchParams.get('pid') || '';
    const j = await liveJam(env);
    if (j && j.pid === pid && j.hostId === u.id) {
      await env.DB.prepare("DELETE FROM settings WHERE k = 'music.jam'").run();
      await env.DB.prepare('DELETE FROM jam_q WHERE pid = ?').bind(pid).run();
    }
    return json({ ok: true });
  }
  // 손님: 곡 넣기 요청. uris(정확한 곡) 또는 q(곡 이름 — 호스트가 찾아서 첫 결과를 넣음)
  if (path === '/api/music/jam/add' && m === 'POST') {
    const b = (await readBody(req)) || {};
    const j = await liveJam(env);
    if (!j || j.pid !== b.pid) throw httpError(409, '이 잼은 끝났습니다');
    const uris = (Array.isArray(b.uris) ? b.uris : []).filter((x) => /^spotify:track:[A-Za-z0-9]{10,40}$/.test(x)).slice(0, 50);
    const q = s(b.q, 120);
    if (!uris.length && !q) throw httpError(400, '곡을 골라 주세요');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM jam_q WHERE pid = ?').bind(j.pid).first();
    if (n && n.n >= MAX_Q) throw httpError(429, '대기 중인 곡이 많습니다. 잠시 뒤에 넣어 주세요');
    const u = await spotifyUser(req).catch(() => null);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO jam_q (id, pid, uris, q, label, by, at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, '')")
      .bind(id, j.pid, JSON.stringify(uris), q, s(b.label, 120) || q, s(b.by, 24) || (u && u.name) || '손님', Date.now()).run();
    return json({ ok: true, id });
  }
  // 참가자(로그인한 친구): 조작 요청. 호스트 화면이 실행하고, 모두의 기기가 호스트를 따라간다
  if (path === '/api/music/jam/ctl' && m === 'POST') {
    const u = await needUser(req);
    const b = (await readBody(req)) || {};
    const j = await liveJam(env);
    if (!j || j.pid !== b.pid) throw httpError(409, '이 잼은 끝났습니다');
    const k = ['play', 'pause', 'next', 'prev', 'from'].includes(b.k) ? b.k : '';
    if (!k) throw httpError(400, '알 수 없는 조작입니다');
    const i = Number.isInteger(b.i) ? b.i : -1;
    await env.DB.prepare("DELETE FROM jam_q WHERE pid = ? AND kind = 'ctl' AND at < ?").bind(j.pid, Date.now() - 60000).run();
    await env.DB.prepare("INSERT INTO jam_q (id, pid, uris, q, label, by, at, kind) VALUES (?, ?, '[]', ?, '', ?, ?, 'ctl')")
      .bind(crypto.randomUUID(), j.pid, k + ':' + i, u.name, Date.now()).run();
    return json({ ok: true });
  }
  // 참가자: 들어와 있다는 표시(2초마다)
  if (path === '/api/music/jam/hello' && m === 'POST') {
    const u = await needUser(req);
    const b = (await readBody(req)) || {};
    const j = await liveJam(env);
    if (!j || j.pid !== b.pid) return json({ ok: false });
    if (u.id === j.hostId) return json({ ok: true });
    const now = Date.now();
    let mm = parse(await getV(env, 'music.jam.m')) || {};
    if (mm.pid !== j.pid) mm = { pid: j.pid, m: {} };
    const last = mm.m[u.id];
    if (!b.bye && last && now - last.at < 10000) return json({ ok: true }); // 10초 안에 다시 쓸 필요 없음(D1 쓰기 아끼기)
    if (b.bye) delete mm.m[u.id]; else mm.m[u.id] = { n: u.name, at: now };
    for (const [k, x] of Object.entries(mm.m)) if (now - x.at > MEMBER_TTL) delete mm.m[k];
    await putV(env, 'music.jam.m', JSON.stringify(mm));
    return json({ ok: true });
  }
  // 호스트: 대기열 가져가기 → 넣은 뒤 done으로 지운다
  if (path === '/api/music/jam/q' && m === 'GET') {
    const u = await needUser(req);
    const j = await liveJam(env);
    if (!j || j.hostId !== u.id) return json({ items: [] });
    const { results } = await env.DB.prepare('SELECT id, uris, q, label, by, kind FROM jam_q WHERE pid = ? ORDER BY at LIMIT 20').bind(j.pid).all();
    return json({ items: (results || []).map((x) => ({ ...x, uris: parse(x.uris) || [] })) });
  }
  if (path === '/api/music/jam/done' && m === 'POST') {
    const u = await needUser(req);
    const b = (await readBody(req)) || {};
    const j = await liveJam(env);
    if (!j || j.hostId !== u.id) return json({ ok: true });
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => typeof x === 'string').slice(0, 50);
    if (ids.length) await env.DB.batch(ids.map((id) => env.DB.prepare('DELETE FROM jam_q WHERE id = ? AND pid = ?').bind(id, j.pid)));
    return json({ ok: true });
  }
  return null;
}

export async function musicApi(req, env, path) {
  try {
    const m = req.method;
    if (path.startsWith('/api/music/jam')) {
      const r = await jamApi(req, env, path, m);
      if (r) return r;
    }
    if (path === '/api/music' && m === 'GET') {
      const u = await needUser(req);
      return json({ doc: (await loadUser(env, u.id)).doc });
    }

    // Spotify Client ID(공개값, 비밀 아님): 한 기기에서 로그인하면 올려 두고 다른 기기는 받아서 바로 로그인 버튼만 누른다
    if (path === '/api/music/cid') {
      if (m === 'GET') return json({ cid: (await getV(env, 'music.cid')) || '' });
      if (m === 'PUT') {
        // 주인(music.owner) 계정만 바꾼다. 아직 주인이 없으면 처음 올린 계정이 주인
        const u = await needUser(req);
        const owner = await getV(env, 'music.owner');
        if (owner && owner !== u.id) throw httpError(403, 'Client ID는 주인 계정만 바꿀 수 있습니다');
        if (!owner) await putV(env, 'music.owner', u.id);
        const body = await readBody(req);
        const cid = String((body && body.cid) || '').trim();
        if (!/^[0-9a-f]{32}$/i.test(cid)) throw httpError(400, 'Client ID 모양이 아닙니다');
        await putV(env, 'music.cid', cid);
        return json({ ok: true });
      }
    }

    // 기기가 가진 문서를 보내면 그 계정의 서버 문서와 합쳐 저장하고, 합친 문서를 돌려준다
    if (path === '/api/music/sync' && m === 'POST') {
      const u = await needUser(req);
      const body = await readBody(req);
      if (!body || typeof body.doc !== 'object' || !body.doc) throw httpError(400, 'doc이 필요합니다');
      const now = Date.now();
      const { doc: server, claimed } = await loadUser(env, u.id);
      const next = merge(clean(server, now), clean(body.doc, now));
      const text = JSON.stringify(next);
      if (text.length > MAX_BYTES) throw httpError(413, '크레이트가 너무 큽니다. 안 쓰는 크레이트를 지워 주세요');
      await putV(env, userKey(u.id), text);
      return json({ doc: next, claimed, user: u.id });
    }
    throw httpError(404, '없는 주소입니다');
  } catch (err) {
    return json({ error: err.message || String(err) }, err.status || 400);
  }
}
