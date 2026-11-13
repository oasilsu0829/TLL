// 음악 크레이트 합치기 검증: node test/music.mjs
import assert from 'node:assert/strict';
import '../public/merge.js';
const { clean, merge } = globalThis.MusicMerge;

const A1 = { id: '4aawyAB9vmqN3uQ7FjRGTy', name: 'Global Warming', artist: 'Pitbull', img: 'https://i.scdn.co/image/x', year: '2012', n: 18 };
const A2 = { id: '1A2GTWGtFfWp7KSQTwWOyo', name: 'Vulnicura', artist: 'Björk', img: 'javascript:alert(1)', n: 9 };
const seed = () => clean({ crates: { 'c-main': { id: 'c-main', name: '내 크레이트', u: 0, albums: [] } } });

// 앨범 정리: 이상한 id·주소는 빠지고 uri는 id로 만든다
let d = clean({ crates: { 'c-main': { name: 'x', u: 1, albums: [A1, A2, A1, { id: '../evil' }] } } });
assert.equal(d.crates['c-main'].albums.length, 2);
assert.equal(d.crates['c-main'].albums[0].uri, 'spotify:album:' + A1.id);
assert.equal(d.crates['c-main'].albums[1].img, '');

// 두 기기에서 다른 크레이트를 고치면 둘 다 남는다
let p = seed(), q = seed();
p.crates['c-main'] = { ...p.crates['c-main'], albums: [A1], u: 100 };
q.crates['c-jazz'] = { id: 'c-jazz', name: '재즈', o: 1, u: 200, albums: [A2] };
let m = merge(clean(p), clean(q));
assert.equal(m.crates['c-main'].albums.length, 1);
assert.equal(m.crates['c-jazz'].name, '재즈');
assert.deepEqual(merge(clean(q), clean(p)), m, '순서를 바꿔도 같다');

// 같은 크레이트는 늦게 고친 쪽, 지운 것은 기본 크레이트(u: 0)를 이긴다
p = seed(); q = seed();
p.crates['c-main'] = { id: 'c-main', del: 1, u: 500 };
assert.equal(merge(q, clean(p)).crates['c-main'].del, 1);

// 시계가 앞선 기기는 now + 5분으로 눌린다. 오래된 지운 표시는 치운다
const now = 1e12;
d = clean({ crates: { a: { name: 'a', u: now + 9e9, albums: [] }, b: { del: 1, u: now - 200 * 864e5 } } }, now);
assert.equal(d.crates.a.u, now + 300000);
assert.ok(!('b' in d.crates));
// 플레이리스트도 꽂을 수 있다
d = clean({ crates: { a: { name: 'a', u: 1, albums: [{ k: 'pl', id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Today', artist: 'Spotify', n: 50 }, A1] } } });
assert.equal(d.crates.a.albums[0].k, 'pl');
assert.equal(d.crates.a.albums[0].uri, 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
assert.ok(!('k' in d.crates.a.albums[1]));
// 들은 횟수 p는 남고, 0이면 빠진다
d = clean({ crates: { a: { name: 'a', u: 1, albums: [{ ...A1, p: 7 }, { ...A2, p: 0 }] } } });
assert.equal(d.crates.a.albums[0].p, 7);
assert.ok(!('p' in d.crates.a.albums[1]));
console.log('music merge ok');
