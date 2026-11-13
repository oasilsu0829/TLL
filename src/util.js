// 공통 도구: JSON 응답, 오류, 본문 읽기, 테이블 준비

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function readBody(req) {
  try {
    return await req.json();
  } catch {
    throw httpError(400, 'JSON 본문을 읽을 수 없습니다');
  }
}

// T/L/L 전용 D1(tll-db). 음악이 쓰는 테이블을 준비하고(이미 있으면 그대로), 예전 Sabathia D1이 붙어 있으면 한 번 복사한다
let ready = null;
export function ensureTables(env) {
  if (!ready) {
    ready = env.DB.batch([
      // 크레이트(k='music.u.<Spotify id>'), Client ID(k='music.cid'), 주인(k='music.owner'), 잼(k='music.jam')
      env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)'),
      // 잼: 손님이 넣은 곡·조작 대기열(호스트 화면이 가져가 처리하고 지운다)
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS jam_q (
        id TEXT PRIMARY KEY, pid TEXT NOT NULL, uris TEXT NOT NULL DEFAULT '[]', q TEXT NOT NULL DEFAULT '',
        label TEXT NOT NULL DEFAULT '', by TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT '')`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_jam_q ON jam_q (pid, at)'),
    ])
      // jam_q 첫 판에는 kind 열이 없었다
      .then(() => env.DB.prepare("ALTER TABLE jam_q ADD COLUMN kind TEXT NOT NULL DEFAULT ''").run().catch((e) => {
        if (!/duplicate column/i.test(String(e && e.message))) throw e;
      }))
      .then(() => copyOld(env).catch((e) => console.log('copyOld', e && e.message))) // 실패해도 앱은 돈다(다음 isolate에서 다시)
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// 임시(2026-11-13): 예전 Sabathia D1(env.OLD)의 음악 데이터를 한 번만 복사한다.
// 크레이트 music.u.<id> · 예전 공유 문서 music · Client ID music.cid · 주인 music.owner (잼은 지나간 것이라 옮기지 않음)
// 끝나면 settings k='tll.copied'에 시각. 이미 새 DB에 있는 키는 덮지 않는다. wrangler.toml의 OLD를 지우면 아무것도 안 한다
async function copyOld(env) {
  if (!env.OLD) return;
  if (await env.DB.prepare("SELECT 1 FROM settings WHERE k = 'tll.copied'").first()) return;
  const { results } = await env.OLD.prepare(
    "SELECT k, v FROM settings WHERE k = 'music' OR k = 'music.cid' OR k = 'music.owner' OR k LIKE 'music.u.%'"
  ).all();
  const put = (k, v) => env.DB.prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)').bind(k, v);
  await env.DB.batch([...(results || []).map((r) => put(r.k, r.v)), put('tll.copied', String(Date.now()))]);
}
