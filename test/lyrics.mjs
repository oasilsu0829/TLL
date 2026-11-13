// 가사 검증: node test/lyrics.mjs
// LRC 읽기(public/lyrics.js)와 LRCLIB 찾기(src/lyrics.js, 가짜 fetch)
import assert from 'node:assert/strict';
import { parseLrc, indexAt } from '../public/lyrics.js';
import { cleanTitle, pick, find, lyricsApi } from '../src/lyrics.js';

// LRC: 시간순 정렬, 한 줄에 여러 시각, 메타 줄 무시, 전주가 길면 점 줄, 끝의 빈 줄 버림
const L = parseLrc('[ar:X]\n[00:05.20]둘째\n[00:04.00][00:20.5]첫째\n[00:10.00]\n[00:11.00]\n[00:12.00]셋째\n[00:30.00]\n');
assert.deepEqual(L.map((x) => x.s), ['', '첫째', '둘째', '', '셋째', '첫째']);
assert.deepEqual(L.map((x) => x.t), [0, 4000, 5200, 10000, 12000, 20500]);
assert.equal(indexAt(L, 3999), 0);
assert.equal(indexAt(L, 4000), 1);
assert.equal(indexAt(L, 11000), 3);
assert.equal(indexAt(L, 99999), 5);
assert.equal(indexAt([{ t: 500, s: 'a' }], 100), -1);
assert.deepEqual(parseLrc(''), []);

assert.equal(cleanTitle('Use Somebody (feat. Someone)'), 'Use Somebody');
assert.equal(cleanTitle('Song - 2011 Remaster'), 'Song');
assert.equal(cleanTitle('Song (Live at Wembley)'), 'Song');
assert.equal(cleanTitle('Hype Boy'), 'Hype Boy');

// 길이 5초 넘게 다르면 버림, 시간 맞춘 가사 먼저
assert.equal(pick([{ duration: 300, syncedLyrics: 'x' }], 200), null);
assert.equal(pick([{ duration: 201, plainLyrics: 'p' }, { duration: 204, syncedLyrics: 's' }], 200).syncedLyrics, 's');

// find: /get 404 → /search(제목 그대로) 빈 목록 → /search(정리한 제목)
const calls = [];
globalThis.fetch = async (url) => {
  const u = new URL(url); calls.push(u.pathname + ' ' + [...u.searchParams.values()].join('|'));
  if (u.pathname === '/api/get') return new Response('{}', { status: 404 });
  if (u.searchParams.get('track_name') === 'Song') return new Response(JSON.stringify([{ duration: 199, syncedLyrics: '[00:01.00]hi' }]));
  return new Response('[]');
};
let r = await find({ t: 'Song - 2011 Remaster', a: 'A', al: 'Al', d: 200 });
assert.deepEqual(r, { synced: '[00:01.00]hi', plain: null, inst: false });
assert.equal(calls.length, 3);
calls.length = 0;
globalThis.fetch = async () => new Response('[]');
assert.deepEqual(await find({ t: 'Nope', a: 'B', al: '', d: 100 }), { none: true });

// API: 이름 없으면 400, 있으면 200
assert.equal((await lyricsApi(new Request('https://x/api/music/lyrics?t=a'))).status, 400);
const res = await lyricsApi(new Request('https://x/api/music/lyrics?t=Nope&a=B&d=100'));
assert.equal(res.status, 200); assert.equal((await res.json()).none, true);
globalThis.fetch = async () => new Response('err', { status: 500 });
assert.equal((await lyricsApi(new Request('https://x/api/music/lyrics?t=X&a=Y'))).status, 502);
console.log('lyrics ok');
