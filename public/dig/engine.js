// T/L/L 디깅 엔진 — 순수 함수만(화면·네트워크 없음). test/dig.mjs가 node에서 돌린다
// 1) 취향: 내가 듣는 아티스트들의 태그(Spotify 장르 · MusicBrainz 태그)를 장르 지도(atlas.js)의 칸에 놓는다 → 칸마다 무게 + 성질 평균(중심)
// 2) 고르기: 안 듣는 장르 중 성질이 내 중심(그리고 좋아요한 장르들)과 가까운 것. 카드 네 장 = 필터 안 세 장 + 필터 밖 아예 다른 장르 한 장
// 3) 기록: 좋아요·별로(fb)와 본 판(seen). 별로면 그 장르는 거의 안 나오고 같은 묶음도 조금 덜, 좋아요면 그 장르와 비슷한 쪽으로 중심이 끌린다
import { GENRES, BY_ID, FAMS, TRAITS } from './atlas.js';

export const SLOTS = [
  { id: 'in', name: '범위 안', hint: '필터 안에서 취향에 맞는 쪽' },
  { id: 'out', name: '완전 다른 곳', hint: '필터 밖, 다른 갈래' },
];
export const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const K = [1, 1, 1, 1, 0.8, 1, 0.45]; // 성질마다 거리 무게(시대는 덜)
const KS = K.reduce((s, x) => s + x, 0);
export function dist(a, b) { let s = 0; for (let i = 0; i < 7; i++) s += K[i] * (a[i] - b[i]) ** 2; return Math.sqrt(s / KS * 7); }

// 대표 앨범 아티스트 → 장르(태그가 없어도 바로 놓을 수 있게)
const SEED_ART = {};
for (const g of GENRES) for (const s of g.seeds) SEED_ART[norm(s.artist)] = SEED_ART[norm(s.artist)] || g.id;
export const seedArtistGenre = (name) => SEED_ART[norm(name)] || null;

// 태그 하나 → 장르 id(지도 순서대로 처음 맞는 칸: 좁은 장르가 앞, 넓은 '집' 칸이 뒤)
const TAGC = new Map();
export function tagGenre(tag) {
  const t = String(tag || '').toLowerCase().trim();
  if (!t) return null;
  if (TAGC.has(t)) return TAGC.get(t);
  const g = GENRES.find((x) => x.kw.test(t));
  const id = g ? g.id : null; TAGC.set(t, id); return id;
}

// artists: [{ name, w(이 아티스트 무게), tags: [[태그, 세기]] }] → 취향
export function buildProfile(artists) {
  const w = {};
  let n = 0;
  for (const a of artists || []) {
    const aw = a.w > 0 ? a.w : 1, got = {};
    const s = seedArtistGenre(a.name); if (s) got[s] = 2;
    const tags = (a.tags || []).filter((x) => x && x[0]).slice(0, 12);
    const top = Math.max(1, ...tags.map((x) => +x[1] || 1));
    tags.forEach(([t, c], i) => { const id = tagGenre(t); if (id) got[id] = Math.max(got[id] || 0, (0.35 + 0.65 * ((+c || 1) / top)) * (i < 3 ? 1 : 0.7)); });
    const sum = Object.values(got).reduce((x, y) => x + y, 0);
    if (!sum) continue;
    n++;
    for (const [id, v] of Object.entries(got)) w[id] = (w[id] || 0) + aw * v / sum;
  }
  const max = Math.max(0, ...Object.values(w));
  const W = {}, fam = {}, c = [0, 0, 0, 0, 0, 0, 0];
  let tot = 0;
  for (const [id, v] of Object.entries(w)) {
    const g = BY_ID[id]; if (!g) continue;
    W[id] = v / max; fam[g.fam] = (fam[g.fam] || 0) + v; tot += v;
    for (let i = 0; i < 7; i++) c[i] += g.tr[i] * v;
  }
  if (tot) { for (let i = 0; i < 7; i++) c[i] /= tot; for (const k in fam) fam[k] /= tot; } else c.fill(0.5);
  const top = Object.entries(W).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  return { w: W, fam, c, top, n };
}

// 좋아요한 장르들의 중심(없으면 null)
function likedCenter(fb) {
  const L = Object.entries(fb || {}).filter(([id, x]) => x && x.v > 0 && BY_ID[id]).map(([id]) => BY_ID[id]);
  if (!L.length) return null;
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const g of L) for (let i = 0; i < 7; i++) c[i] += g.tr[i] / L.length;
  return c;
}

const SIG = 0.24;
// 장르 하나의 점수와 칸(near·mid·far) — 집(이미 많이 듣는 장르)은 null
export function scoreGenre(g, P, st = {}) {
  if (g.home || !g.seeds.length) return null;
  const h = P.w[g.id] || 0;
  if (h > 0.45) return null;
  const fb = (st.fb || {})[g.id];
  if (fb && fb.v < 0 && st.strict) return null;
  let aff = Math.exp(-(dist(g.tr, P.c) ** 2) / (2 * SIG * SIG));
  const LC = st.lc !== undefined ? st.lc : likedCenter(st.fb);
  if (LC) aff = Math.max(aff, 0.9 * Math.exp(-(dist(g.tr, LC) ** 2) / (2 * SIG * SIG)));
  let s = aff * (1 - h);
  if (fb) s *= fb.v > 0 ? 1.5 : 0.12;
  const famBad = Object.entries(st.fb || {}).filter(([id, x]) => x && x.v < 0 && BY_ID[id] && BY_ID[id].fam === g.fam && id !== g.id).length;
  s *= 0.82 ** famBad;
  if ((st.recent || []).includes(g.id)) s *= 0.15;
  const f = P.fam[g.fam] || 0;
  const slot = g.world && f < 0.12 ? 'far' : f >= 0.08 ? 'near' : 'mid';
  return { id: g.id, s, aff, slot, f };
}

// 성질 낱말: [높을 때, 낮을 때]
const ADJ = [['에너지가 큰', '조용한'], ['생악기 소리', '전자음'], ['그루브가 있는', '박자가 느슨한'], ['어두운', '밝은'], ['목소리가 앞에 나온', '연주가 중심인'], ['실험적인', '귀에 익은 짜임의']];
const cl01 = (x) => Math.min(1, Math.max(0, x));
const decade = (t) => { const y = 1950 + t * 72; return `${Math.floor(y / 10) * 10}년대`; };
// 왜 이 장르인지 한두 문장
export function why(g, P, year) {
  const homes = P.top.filter((id) => BY_ID[id] && P.w[id] >= 0.15).slice(0, 6);
  let br = null, bd = 9;
  for (const id of homes) { const d = dist(BY_ID[id].tr, g.tr); if (d < bd) { bd = d; br = BY_ID[id]; } }
  const ref = br ? br.tr : P.c;
  const same = [], diff = [];
  for (let i = 0; i < 6; i++) {
    const a = g.tr[i], b = ref[i];
    if (Math.abs(a - b) < 0.2 && (a >= 0.62 || a <= 0.3)) same.push(ADJ[i][a >= 0.62 ? 0 : 1]);
    if (Math.abs(a - b) >= 0.33) diff.push([Math.abs(a - b), ADJ[i][a > b ? 0 : 1]]);
  }
  diff.sort((x, y) => y[0] - x[0]);
  const who = br ? `자주 듣는 ${br.name}` : '평소 듣는 판';
  let s1 = same.length ? `${who}처럼 ${same.slice(0, 2).join(' · ')} 쪽.` : `${who}과 결이 가깝다.`;
  const bits = diff.slice(0, 2).map((x) => x[1]);
  const et = year ? cl01((year - 1950) / 72) : g.tr[6];
  if (Math.abs(et - ref[6]) > 0.3) bits.push(decade(et));
  const s2 = bits.length ? ` 대신 ${bits.join(' · ')}.` : '';
  return { text: s1 + s2, bridge: br ? br.id : null };
}

// ── 필터(2026-11-26 사용자 요청 '내가 원하는 범위 안에서, 4장 중 하나는 아예 다른 장르'): 비어 있는 칸은 '전부'
//   f = { fams: [묶음 id], dec: [1950 … 2020 (연대)], en: ['calm'|'mid'|'loud'], snd: ['ac'|'el'] }
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
export const ENERGY = { calm: '조용', mid: '보통', loud: '강렬' };
export const SOUND = { ac: '생악기', el: '전자' };
export function cleanFilter(f) {
  f = f && typeof f === 'object' ? f : {};
  const arr = (x, ok) => [...new Set(Array.isArray(x) ? x.filter(ok) : [])];
  return { fams: arr(f.fams, (x) => x in FAMS), dec: arr(f.dec, (x) => DECADES.includes(x)).sort(), en: arr(f.en, (x) => x in ENERGY), snd: arr(f.snd, (x) => x in SOUND) };
}
export const filterEmpty = (f) => { f = cleanFilter(f); return !f.fams.length && !f.dec.length && !f.en.length && !f.snd.length; };
const enOf = (g) => (g.tr[0] < 0.4 ? 'calm' : g.tr[0] < 0.7 ? 'mid' : 'loud');
const sndOk = (g, snd) => !snd.length || snd.some((x) => (x === 'ac' ? g.tr[1] >= 0.45 : g.tr[1] <= 0.55));
const decOf = (y) => Math.min(2020, Math.max(1950, Math.floor(y / 10) * 10));
// 장르가 필터에 드는지(연대는 대표 앨범 연도로 본다: 그 연대 앨범이 하나라도 있어야)
export function inFilter(g, f) {
  f = cleanFilter(f);
  if (f.fams.length && !f.fams.includes(g.fam)) return false;
  if (f.en.length && !f.en.includes(enOf(g))) return false;
  if (!sndOk(g, f.snd)) return false;
  if (f.dec.length && !g.seeds.some((s) => f.dec.includes(decOf(s.year)))) return false;
  return true;
}
export function describeFilter(f) {
  f = cleanFilter(f);
  const bits = [];
  if (f.fams.length) bits.push(f.fams.map((x) => FAMS[x]).join('·'));
  if (f.dec.length) bits.push(f.dec.map((d) => `${String(d).slice(2)}년대`).join('·'));
  if (f.en.length) bits.push(f.en.map((x) => ENERGY[x]).join('·'));
  if (f.snd.length) bits.push(f.snd.map((x) => SOUND[x]).join('·'));
  return bits.join(' · ');
}

// 한 판(대표 앨범) 고르기: 본 적 없는 것 먼저, 연대 필터가 있으면 그 연대 앨범만
export const seedKey = (s) => norm(s.artist) + '|' + norm(s.album);
export function pickSeed(g, seen = {}, rnd = Math.random, dec = []) {
  const L = g.seeds.filter((s) => !seen[seedKey(s)] && (!dec.length || dec.includes(decOf(s.year))));
  return L.length ? L[Math.floor(rnd() * L.length)] : null;
}
function sample(L, rnd, pow = 2.2, top = 7) {
  L = [...L].sort((a, b) => b.s - a.s).slice(0, top);
  const pw = L.map((x) => Math.max(1e-6, x.s) ** pow), tot = pw.reduce((a, b) => a + b, 0);
  let r = rnd() * tot, k = 0;
  while (k < L.length - 1 && (r -= pw[k]) > 0) k++;
  return L[k];
}

// 카드 네 장: 세 장은 필터 안(취향 점수로, 같은 묶음은 되도록 한 번씩) + 한 장은 필터 밖이자 세 장과 다른 묶음(아예 다른 장르)
// 필터가 비면 '안' = 전체. 필터 안 장르가 모자라면 성질이 가장 가까운 바깥 장르로 채우고 relaxed 표시
// st = { fb, seen, recent: 최근 나온 장르 id들, filter }
export function deal(P, st = {}, rnd = Math.random) {
  const f = cleanFilter(st.filter), lc = likedCenter(st.fb);
  const all = GENRES.map((g) => scoreGenre(g, P, { ...st, lc })).filter((x) => x && x.s > 0.002);
  const has = (x, dec) => !!pickSeed(BY_ID[x.id], st.seen, () => 0, dec);
  const inside = all.filter((x) => inFilter(BY_ID[x.id], f) && has(x, f.dec));
  const used = new Set(), fams = new Set(), out = [];
  const push = (x, slot, slotName, dec, relaxed) => {
    const g = BY_ID[x.id]; used.add(x.id); fams.add(g.fam);
    const seed = pickSeed(g, st.seen, rnd, dec);
    out.push({ slot, slotName, g, seed, why: why(g, P, seed && seed.year), score: x.s, aff: x.aff, relaxed: !!relaxed });
  };
  for (let k = 0; k < 3; k++) {
    let L = inside.filter((x) => !used.has(x.id)).map((x) => ({ ...x, s: x.s * (fams.has(BY_ID[x.id].fam) ? 0.35 : 1) }));
    if (L.length) { push(sample(L, rnd), 'in', filterEmpty(f) ? '취향 추천' : '범위 안', f.dec); continue; }
    // 모자람: 필터 밖에서 필터와 결이 가장 비슷한 장르(필터 안 장르들 성질 중심에 가까운 순)
    const ref = inside.length ? centerOf(inside.map((x) => BY_ID[x.id])) : P.c;
    L = all.filter((x) => !used.has(x.id) && has(x, [])).map((x) => ({ ...x, s: Math.exp(-(dist(BY_ID[x.id].tr, ref) ** 2) / 0.08) }));
    if (!L.length) break;
    push(sample(L, rnd, 3, 4), 'in', '범위 근처', [], true);
  }
  // 아예 다른 장르: 필터 밖 + 세 장과 다른 묶음 + 덜 듣는 묶음일수록. 결이 너무 멀면 덜 나오게(취향 점수의 제곱근)
  let W = all.filter((x) => !used.has(x.id) && has(x, []) && !fams.has(BY_ID[x.id].fam) && (filterEmpty(f) || !inFilter(BY_ID[x.id], f)));
  W = W.map((x) => ({ ...x, s: Math.sqrt(x.s) * (1 - Math.min(0.8, (P.fam[BY_ID[x.id].fam] || 0) * 3)) }));
  if (!W.length) W = all.filter((x) => !used.has(x.id) && has(x, []));
  if (W.length) push(sample(W, rnd, 1.2, 12), 'out', '완전 다른 곳', []);
  return out;
}
function centerOf(L) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const g of L) for (let i = 0; i < 7; i++) c[i] += g.tr[i] / L.length; return c; }

// 화면용: 내 동네 이름들
export const homeNames = (P, n = 4) => P.top.slice(0, n).map((id) => BY_ID[id] && BY_ID[id].name).filter(Boolean);
export { GENRES, BY_ID, FAMS, TRAITS };
