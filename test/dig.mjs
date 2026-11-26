// 디깅 엔진 검사: node test/dig.mjs
import assert from 'node:assert/strict';
import { GENRES, BY_ID } from '../public/dig/atlas.js';
import { buildProfile, tagGenre, deal, scoreGenre, why, seedKey } from '../public/dig/engine.js';

// 지도: id 겹침 없음, 성질 7개, 추천지는 대표 앨범 2장 이상
const ids = new Set();
for (const g of GENRES) {
  assert.ok(!ids.has(g.id), 'id 겹침 ' + g.id); ids.add(g.id);
  assert.equal(g.tr.length, 7, g.id);
  if (!g.home) assert.ok(g.seeds.length >= 2, '대표 앨범 부족 ' + g.id);
  for (const s of g.seeds) assert.ok(s.artist && s.album && s.year > 1900, g.id + ' ' + JSON.stringify(s));
}
// 태그 → 장르
const T = { 'dream pop': 'shoegaze', 'k-pop': 'kpop', 'indie rock': 'indierock', 'bossa nova': 'bossa', 'electro house': 'edm', 'blues rock': 'classicrock', 'dubstep': 'ukg', 'city pop': 'citypop', 'trip hop': 'triphop', 'korean r&b': 'kindie', 'jazz': 'jazz', 'post-rock': 'postrock' };
for (const [t, id] of Object.entries(T)) assert.equal(tagGenre(t), id, t);

const me = buildProfile([
  { name: 'Beach House', w: 3, tags: [['dream pop', 10], ['indie', 4]] },
  { name: '실리카겔', w: 2, tags: [['k-indie', 5], ['psychedelic', 2]] },
  { name: 'NewJeans', w: 2, tags: [['k-pop', 9]] },
  { name: 'Frank Ocean', w: 2, tags: [['alternative r&b', 8], ['r&b', 5]] },
  { name: 'Radiohead', w: 1, tags: [['alternative rock', 43], ['art rock', 30], ['electronic', 14]] },
]);
assert.ok(me.top.includes('shoegaze') && me.top.includes('kpop'));
// 이미 많이 듣는 장르는 안 나온다
assert.equal(scoreGenre(BY_ID.shoegaze, me), null);
// 세 장: 서로 다른 장르, 세 칸
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const seen = {}, recent = [], cnt = {};
for (let k = 0; k < 40; k++) {
  const H = deal(me, { seen, recent }, rnd);
  assert.equal(H.length, 3);
  assert.equal(new Set(H.map((x) => x.g.id)).size, 3);
  assert.deepEqual(H.map((x) => x.slot), ['near', 'mid', 'far']);
  for (const x of H) { assert.ok(!x.g.home && x.seed && !seen[seedKey(x.seed)]); seen[seedKey(x.seed)] = 1; cnt[x.g.id] = (cnt[x.g.id] || 0) + 1; recent.unshift(x.g.id); }
  recent.length = Math.min(recent.length, 9);
  assert.ok(H[2].g.world, '먼 나라는 지역 음악');
}
// 별로 누른 장르는 거의 안 나옴, 좋아요는 더 나옴
const first = deal(me, {}, () => 0)[1].g.id;
const sBad = scoreGenre(BY_ID[first], me, { fb: { [first]: { v: -1, u: 1 } } }).s, sOk = scoreGenre(BY_ID[first], me).s;
assert.ok(sBad < sOk * 0.2);
const w = why(BY_ID.slowcore, me);
assert.ok(w.text.length > 8);
console.log('dig ok', Object.keys(cnt).length, '장르 나옴 /', GENRES.filter((g) => !g.home).length);
console.log(deal(me, {}, Math.random).map((x) => `${x.slotName}: ${x.g.name} — ${x.seed.artist} [${x.seed.album}] · ${x.why.text}`).join('\n'));

// 기록 합치기(merge.js)
await import('../public/merge.js');
const MM = globalThis.MusicMerge;
const a = { v: 1, crates: {}, dig: { fb: { bossa: { v: 1, u: 10 }, dub: { v: -1, u: 5 } }, seen: { 'x|y': { t: 50, g: 'bossa' } } } };
const b = { v: 1, crates: {}, dig: { fb: { dub: { v: 0, u: 9 }, '<bad>': { v: 1, u: 1 } }, seen: { 'x|y': { t: 30, g: 'bossa' }, 'p|q': { t: 7, g: 'dub' }, bad: { t: 1 } } } };
const m = MM.merge(MM.clean(a), MM.clean(b));
assert.deepEqual(m.dig.fb, { bossa: { v: 1, u: 10 }, dub: { v: 0, u: 9 } });
assert.deepEqual(Object.keys(m.dig.seen).sort(), ['p|q', 'x|y']);
assert.equal(m.dig.seen['x|y'].t, 30);
assert.equal(MM.clean({ v: 1, crates: {} }).dig, undefined);
console.log('dig merge ok');
