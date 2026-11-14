// 가사 검증: node test/lyrics.mjs
// LRC 읽기(public/lyrics.js)와 가사 찾기(src/lyrics.js: LRCLIB · NetEase, 가짜 fetch)
import assert from 'node:assert/strict';
import { parseLrc, indexAt } from '../public/lyrics.js';
import { cleanTitle, pick, find, lyricsApi, names, norm, score, cleanNetease } from '../src/lyrics.js';

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

// 길이 5초 넘게 다르면 버림, 시간 맞춘 가사 먼저(예전 pick)
assert.equal(pick([{ duration: 300, syncedLyrics: 'x' }], 200), null);
assert.equal(pick([{ duration: 201, plainLyrics: 'p' }, { duration: 204, syncedLyrics: 's' }], 200).syncedLyrics, 's');

// 이름 비교: 괄호 속 다른 이름, 띄어쓰기·기호 무시
assert.deepEqual(names('Through the Night (밤편지)'), ['Through the Night (밤편지)', 'Through the Night', '밤편지']);
assert.equal(norm('Let’s  Say-Goodbye'), 'letssaygoodbye');
// 점수: 제목이 맞고 가수가 맞으면 통과, 가수가 다르면 제목이 똑같고 길이가 2.5초 안일 때만, 길이 8초 넘게 다르면 탈락
const Q = { t: '밤편지', a: ['아이유'], d: 253 };
assert.ok(score({ title: 'Through the Night (밤편지)', artists: ['IU (아이유)'], dur: 253, synced: true }, Q) > 0);
assert.ok(score({ title: '밤편지', artists: ['IU'], dur: 254 }, Q) != null);
assert.equal(score({ title: '밤편지', artists: ['IU'], dur: 258 }, Q), null);
assert.equal(score({ title: '밤편지', artists: ['IU'], dur: 280 }, Q), null);
assert.equal(score({ title: '좋은 날', artists: ['아이유'], dur: 253 }, Q), null);
assert.ok(score({ title: '밤편지', artists: ['아이유'], dur: 253, synced: true }, Q) > score({ title: '밤편지', artists: ['아이유'], dur: 253 }, Q));
// NetEase 크레딧 줄·순음악 표시는 뺀다
assert.deepEqual(cleanNetease('[00:00.000] 作词 : IU\n[00:00.213] 작곡 : 이종훈\n[00:01.000]이 밤 그날의\n[00:08.760]반딧불을'), { synced: '[00:01.000]이 밤 그날의\n[00:08.760]반딧불을', plain: null, inst: false, src: 'NetEase' });
assert.equal(cleanNetease('[00:00.00]纯音乐，请欣赏').inst, true);
assert.equal(cleanNetease('[00:05.68]Piano by：Factist\n[00:07.10]Mixed by : Jo\n[00:10.00]Stand by me').synced, '[00:10.00]Stand by me');

// find: LRCLIB(가짜) — 한국어 가수 이름으로 물어도 'IU (아이유)'로 올라 있는 가사를 찾는다. NetEase는 빈 결과
const calls = [];
const lrcRow = { id: 7, trackName: 'Through the Night (밤편지)', artistName: 'IU (아이유)', duration: 253.4, syncedLyrics: '[00:01.00]이 밤' };
globalThis.fetch = async (url) => {
  const u = new URL(url); calls.push(u.hostname + u.pathname);
  if (u.pathname === '/api/get') return new Response('{}', { status: 404 });
  if (u.hostname === 'lrclib.net') return new Response(JSON.stringify(u.searchParams.get('q') === '밤편지' ? [lrcRow, { ...lrcRow, id: 8, artistName: 'X', trackName: '다른 곡' }] : []));
  return new Response(JSON.stringify({ result: { songs: [] } }));
};
let r = await find({ t: '밤편지', a: ['아이유'], al: 'Palette', d: 253 });
assert.deepEqual(r, { synced: '[00:01.00]이 밤', plain: null, inst: false, src: 'LRCLIB' });
assert.ok(calls.includes('music.163.com/api/search/get'));
// LRCLIB에 없고 NetEase에 있으면 NetEase(가수가 중국어 이름이어도 제목·길이가 맞으면)
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.hostname === 'lrclib.net') return new Response('[]');
  if (u.pathname === '/api/search/get') return new Response(JSON.stringify({ result: { songs: [{ id: 1, name: '너의 모든 순간 (Inst.)', artists: [{ name: '成始璄' }], duration: 243000 }, { id: 2, name: '너의 모든 순간', artists: [{ name: '成始璄' }], duration: 243100 }] } }));
  if (u.pathname === '/api/song/lyric') return new Response(JSON.stringify({ lrc: { lyric: u.searchParams.get('id') === '2' ? '[00:10.00]이윽고 내가 한눈에' : '' } }));
  return new Response('{}', { status: 404 });
};
r = await find({ t: '너의 모든 순간', a: ['성시경'], al: '', d: 243 });
assert.equal(r.src, 'NetEase'); assert.equal(r.synced, '[00:10.00]이윽고 내가 한눈에');
globalThis.fetch = async (url) => new Response(new URL(url).hostname === 'lrclib.net' ? '[]' : '{}');
assert.deepEqual(await find({ t: 'Nope', a: ['B'], al: '', d: 100 }), { none: true, partial: false });

// API: 이름 없으면 400, 있으면 200(가수 여러 명), 두 곳 다 오류면 502
assert.equal((await lyricsApi(new Request('https://x/api/music/lyrics?t=a'))).status, 400);
const res = await lyricsApi(new Request('https://x/api/music/lyrics?t=Nope&a=B&a=C&d=100'));
assert.equal(res.status, 200); const body = await res.json(); assert.equal(body.none, true); assert.ok(!('partial' in body));
globalThis.fetch = async () => new Response('err', { status: 500 });
assert.equal((await lyricsApi(new Request('https://x/api/music/lyrics?t=X&a=Y'))).status, 502);
console.log('lyrics ok');
