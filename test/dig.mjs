// 디깅 엔진 검사: node test/dig.mjs
import assert from 'node:assert/strict';
import { GENRES, BY_ID } from '../public/dig/atlas.js';
import { buildProfile, tagGenre, deal, scoreGenre, why, seedKey, inFilter, describeFilter } from '../public/dig/engine.js';

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
// 네 장: 서로 다른 장르, 앞 세 장은 '범위 안', 마지막은 '완전 다른 곳'(세 장과 다른 묶음)
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const seen = {}, recent = [], cnt = {};
for (let k = 0; k < 30; k++) {
  const H = deal(me, { seen, recent }, rnd);
  assert.equal(H.length, 4);
  assert.equal(new Set(H.map((x) => x.g.id)).size, 4);
  assert.deepEqual(H.map((x) => x.slot), ['in', 'in', 'in', 'out']);
  assert.ok(!H.slice(0, 3).some((x) => x.g.fam === H[3].g.fam), '다른 장르는 다른 묶음');
  for (const x of H) { assert.ok(!x.g.home && x.seed && !seen[seedKey(x.seed)]); seen[seedKey(x.seed)] = 1; cnt[x.g.id] = (cnt[x.g.id] || 0) + 1; recent.unshift(x.g.id); }
  recent.length = Math.min(recent.length, 9);
}
// 필터: 재즈·브라질 · 70년대 → 세 장은 그 안(판도 70년대), 한 장은 밖
const F = { fams: ['jazz', 'brazil'], dec: [1970] };
assert.equal(describeFilter(F), '재즈·브라질 · 70년대');
for (let k = 0; k < 15; k++) {
  const H = deal(me, { filter: F }, rnd);
  assert.equal(H.length, 4);
  for (const x of H.slice(0, 3)) { assert.ok(inFilter(x.g, F), x.g.id); assert.ok(x.seed.year >= 1970 && x.seed.year < 1980, x.seed.album); }
  assert.ok(!inFilter(H[3].g, F) && !['jazz', 'brazil'].includes(H[3].g.fam), H[3].g.id);
}
// 좁은 필터(투바·몽골 목노래 하나뿐) → 모자란 칸은 '범위 근처'로 채움
const H2 = deal(me, { filter: { fams: ['asia'], en: ['loud'], snd: ['ac'] } }, rnd);
assert.equal(H2.length, 4); assert.ok(H2.some((x) => x.relaxed));
// 별로 누른 장르는 거의 안 나옴, 좋아요는 더 나옴
const first = deal(me, {}, () => 0)[1].g.id;
const sBad = scoreGenre(BY_ID[first], me, { fb: { [first]: { v: -1, u: 1 } } }).s, sOk = scoreGenre(BY_ID[first], me).s;
assert.ok(sBad < sOk * 0.2);
const w = why(BY_ID.slowcore, me);
assert.ok(w.text.length > 8);
console.log('dig ok', Object.keys(cnt).length, '장르 나옴 /', GENRES.filter((g) => !g.home).length);
console.log(deal(me, { filter: { fams: ['jazz', 'soul', 'africa'] } }, Math.random).map((x) => `${x.slotName}: ${x.g.name} — ${x.seed.artist} [${x.seed.album}] · ${x.why.text}`).join('\n'));

// 기록 합치기(merge.js)
await import('../public/merge.js');
const MM = globalThis.MusicMerge;
const a = { v: 1, crates: {}, dig: { fb: { bossa: { v: 1, u: 10 }, dub: { v: -1, u: 5 } }, seen: { 'x|y': { t: 50, g: 'bossa' } } } };
const b = { v: 1, crates: {}, dig: { fb: { dub: { v: 0, u: 9 }, '<bad>': { v: 1, u: 1 } }, seen: { 'x|y': { t: 30, g: 'bossa' }, 'p|q': { t: 7, g: 'dub' }, bad: { t: 1 } } } };
const m = MM.merge(MM.clean(a), MM.clean(b));
assert.deepEqual(m.dig.fb, { bossa: { v: 1, u: 10 }, dub: { v: 0, u: 9 } });
assert.deepEqual(Object.keys(m.dig.seen).sort(), ['p|q', 'x|y']);
assert.equal(m.dig.seen['x|y'].t, 30);
const m3 = MM.merge(MM.clean({ v: 1, crates: {}, dig: { fb: {}, seen: {}, filter: { fams: ['jazz'] }, fu: 5 } }), MM.clean({ v: 1, crates: {}, dig: { fb: {}, seen: {}, filter: { fams: ['latin'], dec: [1970] }, fu: 9 } }));
assert.deepEqual(m3.dig.filter.fams, ['latin']); assert.equal(m3.dig.fu, 9);
assert.equal(MM.clean({ v: 1, crates: {} }).dig, undefined);
console.log('dig merge ok');

// 태그·씨앗(tagx.js)
const TX = await import('../public/dig/tagx.js');
assert.ok(!TX.isGenreTag('seen live') && !TX.isGenreTag('female vocalists') && !TX.isGenreTag('80s') && !TX.isGenreTag('korean') && TX.isGenreTag('dream pop') && TX.isGenreTag('ethio-jazz'));
assert.ok(TX.related('dream pop', 'pop') && TX.related('hip-hop', 'hip hop') && !TX.related('shoegaze', 'bossa nova'));
const home = TX.homeTags([{ name: 'Beach House', w: 3, tags: [['dream pop', 100], ['indie', 60], ['seen live', 40]] }, { name: 'NewJeans', w: 2, tags: [['k-pop', 100], ['korean', 50]] }]);
assert.ok(home['dream pop'] === 1 && !('seen live' in home) && !('korean' in home));
const nb = TX.neighborTags(home, [{ name: 'Cocteau Twins', sim: 0.9, via: 'Beach House', tags: [['dream pop', 100], ['ethereal', 80], ['gothic', 50]] }, { name: 'Slowdive', sim: 0.8, via: 'Beach House', tags: [['shoegaze', 100], ['dream pop', 90]] }], { 't:gothic': { v: -1, u: 1 } });
const nbT = nb.map((x) => x.tag);
assert.ok(nbT.includes('ethereal') && nbT.includes('shoegaze') && !nbT.includes('dream pop'));
assert.ok(nb.find((x) => x.tag === 'gothic').s < nb.find((x) => x.tag === 'ethereal').s * 0.2, '별로 태그는 거의 안 나옴');
const far = TX.farTags(['pop', 'synthpop', 'afrobeat', 'krautrock', 'seen live', 'indie pop'], ['dream pop', 'indie', 'shoegaze']).map((x) => x.tag);
assert.deepEqual(far.sort(), ['afrobeat', 'krautrock']);
const sp = TX.pickSpread([{ tag: 'dream pop', s: 5 }, { tag: 'synth pop', s: 4 }, { tag: 'krautrock', s: 3 }, { tag: 'afrobeat', s: 2 }], 3, () => 0);
assert.equal(sp.length, 3); assert.ok(!(sp.some((x) => x.tag === 'dream pop') && sp.some((x) => x.tag === 'synth pop')));
const albs = [{ name: 'Greatest Hits', artist: 'X' }, { name: 'Heaven or Las Vegas', artist: 'Cocteau Twins' }, { name: 'Souvlaki', artist: 'Slowdive' }, { name: 'Teen Dream', artist: 'Beach House' }];
for (let i = 0; i < 20; i++) { const a = TX.pickAlbum(albs, { known: new Set(['beachhouse']), seen: { [TX.albumKey('Slowdive', 'Souvlaki')]: 1 } }); assert.equal(a.name, 'Heaven or Las Vegas'); }
const ss = TX.seedSteps(Array.from({ length: 12 }, (_, i) => ({ name: 'A' + i })), [{ name: 'A3' }, { name: 'B1' }, { name: 'Me' }], { seed: 'Me', known: new Set(['a7']) });
assert.deepEqual(ss.one.map((x) => x.name), ['A6', 'A8', 'A9', 'A10', 'A11']); assert.deepEqual(ss.two.map((x) => x.name), ['B1']);
console.log('tagx ok');
