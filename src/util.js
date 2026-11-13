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

// T/L/L 전용 D1(tll-db). 음악이 쓰는 테이블을 준비한다(이미 있으면 그대로)
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
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}

