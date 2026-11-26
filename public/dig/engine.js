// T/L/L 디깅 엔진 — 순수 함수만(화면·네트워크 없음). test/dig.mjs가 node에서 돌린다
// 1) 취향: 내가 듣는 아티스트들의 태그(Spotify 장르 · MusicBrainz 태그)를 장르 지도(atlas.js)의 칸에 놓는다 → 칸마다 무게 + 성질 평균(중심)
// 2) 고르기: 안 듣는 장르 중 성질이 내 중심(그리고 좋아요한 장르들)과 가까운 것. 카드 세 장 = 거리 세 단계
//    옆 동네(듣는 묶음 안의 안 들은 장르) · 건너 동네(안 듣는 묶음) · 먼 나라(지역 음악)
// 3) 기록: 좋아요·별로(fb)와 본 판(seen). 별로면 그 장르는 거의 안 나오고 같은 묶음도 조금 덜, 좋아요면 그 장르와 비슷한 쪽으로 중심이 끌린다
import { GENRES, BY_ID, FAMS, TRAITS } from './atlas.js';

export const SLOTS = [
  { id: 'near', name: '옆 동네', hint: '듣던 쪽에서 한 걸음' },
  { id: 'mid', name: '건너 동네', hint: '안 듣던 갈래, 결은 닮음' },
  { id: 'far', name: '먼 나라', hint: '지역 음악, 멀리 떠나기' },
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

// 한 판(대표 앨범) 고르기: 본 적 없는 것 먼저
export const seedKey = (s) => norm(s.artist) + '|' + norm(s.album);
export function pickSeed(g, seen = {}, rnd = Math.random) {
  const fresh = g.seeds.filter((s) => !seen[seedKey(s)]);
  const L = fresh.length ? fresh : [];
  return L.length ? L[Math.floor(rnd() * L.length)] : null;
}

// 카드 세 장: [{ slot, g, seed, why, score }]
// st = { fb, seen, recent: 최근 나온 장르 id들 }
export function deal(P, st = {}, rnd = Math.random) {
  const lc = likedCenter(st.fb);
  const sc = GENRES.map((g) => scoreGenre(g, P, { ...st, lc })).filter((x) => x && x.s > 0.002 && pickSeed(BY_ID[x.id], st.seen, () => 0));
  const used = new Set(), out = [];
  for (const slot of SLOTS) {
    let L = sc.filter((x) => x.slot === slot.id && !used.has(x.id));
    if (!L.length) L = sc.filter((x) => !used.has(x.id) && (slot.id === 'far' ? BY_ID[x.id].world : !BY_ID[x.id].world));
    if (!L.length) L = sc.filter((x) => !used.has(x.id));
    if (!L.length) break;
    L.sort((a, b) => b.s - a.s);
    const top = L.slice(0, 7), pw = top.map((x) => x.s ** 2.2), tot = pw.reduce((a, b) => a + b, 0);
    let r = rnd() * tot, k = 0;
    while (k < top.length - 1 && (r -= pw[k]) > 0) k++;
    const x = top[k], g = BY_ID[x.id];
    used.add(x.id);
    const seed = pickSeed(g, st.seen, rnd);
    out.push({ slot: slot.id, slotName: slot.name, g, seed, why: why(g, P, seed && seed.year), score: x.s, aff: x.aff });
  }
  return out;
}

// 화면용: 내 동네 이름들
export const homeNames = (P, n = 4) => P.top.slice(0, n).map((id) => BY_ID[id] && BY_ID[id].name).filter(Boolean);
export { GENRES, BY_ID, FAMS, TRAITS };
