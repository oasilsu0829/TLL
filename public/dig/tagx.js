// 디깅 — 태그·씨앗 고르기(순수 함수, 네트워크 없음). data.js가 Last.fm·ListenBrainz에서 받은 것을 넘긴다. test/dig.mjs가 node에서 돌린다
// 2026-11-26 사용자 선택: 개선안 2(태그 그래프 + 실제 인기 앨범) + 3(씨앗에서 출발)
//  - 취향: 내 아티스트 태그 = 집 태그. 비슷한 아티스트들의 태그 중 집에 없는 것 = 이웃 태그 → 세 장. 집·이웃과 낱말이 겹치지 않는 인기 태그 = 먼 태그 → 한 장
//  - 태그: 내가 고른 태그들의 인기 앨범에서 세 장, 먼 태그에서 한 장
//  - 씨앗: 씨앗 아티스트에서 비슷한 아티스트로 한 다리 · 두 다리 건너간 곳에서 세 장, 먼 태그(없으면 장르 지도)에서 한 장

// 장르가 아닌 태그(듣는 사람 표시·평가·국적·연대 등)
const JUNK = /^(seen live|favou?rites?|favou?rite|my favou?rite|albums? i own|love|loved|beautiful|awesome|amazing|cool|good|great|best|spotify|under \d+.*|check out|to listen|female vocalists?|male vocalists?|female vocal|male vocal|vocalists?|singer|songwriter|bands?|composer|producer|guitarist|pianist|the beatles|\d+s|\d{4}s?|\d{2}s|american|british|uk|usa|english|german|french|japanese|korean|swedish|canadian|australian|italian|spanish|brazilian|irish|scottish|icelandic|norwegian|finnish|danish|dutch|belgian|mexican|argentinian|chilean|russian|polish|african|nigerian|ghanaian|ethiopian|seoul|tokyo|london|new york|all|other|misc|music|instrumental|cover|covers|remix|soundtrack|live|acoustic|chill|chillout|mellow|sad|happy|sexy|party|summer|relax|relaxing|catchy|fun|epic|melancholy|melancholic|atmospheric|dreamy|romantic|easy listening|00s|90s|80s|70s|60s|50s|10s|20s|classic|oldies)$/;
// 너무 넓어 디깅 목적지로는 안 쓰는 태그(집 계산에는 씀)
const BROAD = new Set(['indie', 'rock', 'pop', 'electronic', 'electronica', 'alternative', 'alternative rock', 'indie rock', 'indie pop', 'hip-hop', 'hip hop', 'rap', 'jazz', 'metal', 'folk', 'soul', 'rnb', 'r&b', 'classical', 'dance', 'experimental', 'singer-songwriter', 'blues', 'country', 'punk', 'world', 'k-pop', 'kpop', 'j-pop', 'jpop', 'ballad', 'pop rock', 'soft rock', 'hard rock', 'classic rock']);
export const isDigTag = (t) => isGenreTag(t) && !BROAD.has(cleanTag(t));
export const cleanTag = (t) => String(t || '').toLowerCase().normalize('NFKC').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
export const isGenreTag = (t) => { t = cleanTag(t); return t.length >= 3 && t.length <= 32 && !JUNK.test(t) && !/^\d/.test(t); };
// 'dream pop' → ['dream','pop'], 'hip-hop' → ['hip','hop', 'hiphop']
export function tokens(t) {
  t = cleanTag(t); const w = t.split(/[\s/&,-]+/).filter(Boolean);
  return new Set([...w, w.join('')].filter((x) => x.length >= 3 || w.length === 1));
}
// 두 태그가 같은 동네인지(낱말 하나라도 겹치면)
export function related(a, b) {
  const A = tokens(a), B = tokens(b), ja = cleanTag(a).replace(/[^a-z0-9\p{L}]/gu, ''), jb = cleanTag(b).replace(/[^a-z0-9\p{L}]/gu, '');
  for (const x of B) if (A.has(x) || (x.length >= 3 && ja.includes(x))) return true;
  for (const x of A) if (x.length >= 3 && jb.includes(x)) return true;
  return false;
}

// 아티스트들([{ name, w, tags: [[태그, 세기]] }]) → 집 태그 { 태그: 0~1 }
export function homeTags(arts) {
  const m = {};
  for (const a of arts || []) {
    const T = (a.tags || []).filter((x) => isGenreTag(x[0])).slice(0, 8);
    const top = Math.max(1, ...T.map((x) => +x[1] || 1));
    T.forEach(([t, c], i) => { t = cleanTag(t); m[t] = (m[t] || 0) + (a.w > 0 ? a.w : 1) * ((+c || 1) / top) * (i < 3 ? 1 : 0.6); });
  }
  const max = Math.max(0, ...Object.values(m));
  for (const k in m) m[k] /= max || 1;
  return m;
}
export const topOf = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);

// 이웃 태그: 비슷한 아티스트들(cands: [{ name, sim(0~1), via(내 아티스트), tags }])에 붙은 태그 중 집에서 약한 것. 집에서 아주 센 태그(> .2)는 뺀다
export function neighborTags(home, cands, fb = {}) {
  const m = {};
  for (const a of cands || []) {
    const T = (a.tags || []).filter((x) => isGenreTag(x[0])).slice(0, 6);
    T.forEach(([t], i) => {
      if (!isDigTag(t)) return;
      t = cleanTag(t); if ((home[t] || 0) > 0.2) return;
      const v = (a.sim || 0.5) * (i < 2 ? 1 : 0.6) * (1 - (home[t] || 0) * 2);
      if (!m[t] || m[t].s < v) m[t] = { tag: t, s: (m[t] ? m[t].s : 0) + v, via: a.via, art: a.name }; else m[t].s += v * 0.5;
    });
  }
  return Object.values(m).map((x) => ({ ...x, s: x.s * fbK(fb, x.tag) })).filter((x) => x.s > 0);
}
// 먼 태그: 인기 태그 목록(pool: [태그]) 중 집 위쪽 태그·이웃·고른 태그와 낱말이 하나도 안 겹치는 것
export function farTags(pool, avoid, fb = {}) {
  const A = [...new Set((avoid || []).map(cleanTag))];
  return [...new Set((pool || []).map(cleanTag))].filter((t) => isDigTag(t) && !A.some((a) => related(a, t)) && fbK(fb, t) > 0.2)
    .map((tag, i) => ({ tag, s: fbK(fb, tag) * (0.6 + 0.4 * Math.random()) / (1 + i * 0.004) }));
}
const fbK = (fb, t) => { const x = fb['t:' + cleanTag(t)]; return !x ? 1 : x.v > 0 ? 1.6 : x.v < 0 ? 0.05 : 1; };

// 무게대로 하나(위 n개에서)
export function pick(L, rnd = Math.random, pow = 1.5, n = 10) {
  L = [...L].filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
  if (!L.length) return null;
  const pw = L.map((x) => x.s ** pow), tot = pw.reduce((a, b) => a + b, 0);
  let r = rnd() * tot, k = 0;
  while (k < L.length - 1 && (r -= pw[k]) > 0) k++;
  return L[k];
}
// 서로 낱말이 안 겹치는 태그 n개
export function pickSpread(L, n, rnd = Math.random) {
  const out = []; let rest = [...L];
  while (out.length < n && rest.length) {
    const x = pick(rest, rnd); if (!x) break;
    out.push(x); rest = rest.filter((y) => y !== x && !related(y.tag, x.tag));
  }
  if (out.length < n) for (const x of L) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); } // 모자라면 겹쳐도
  return out;
}

// 앨범 고르기: 이미 본 판 · 내가 듣는 아티스트 · 모음집·라이브는 뺀다
export const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export const albumKey = (artist, album) => norm(artist) + '|' + norm(album);
const COMP = /greatest hits|best of|the best|collection|essential|anthology|hits|live at|live in|\blive\b|deluxe|remaster|karaoke|tribute|playlist|mixtape vol|\(null\)/i;
export function pickAlbum(albums, { seen = {}, known = new Set(), avoid = new Set(), rnd = Math.random } = {}) {
  const L = (albums || []).filter((a) => a && a.name && a.artist && !COMP.test(a.name) && !seen[albumKey(a.artist, a.name)] && !known.has(norm(a.artist)) && !avoid.has(norm(a.artist)));
  if (!L.length) return null;
  // 위쪽(인기)일수록 조금 더, 하지만 너무 뻔하지 않게 위 25개에서 고르게
  const top = L.slice(0, 25);
  return top[Math.floor(rnd() * top.length)];
}

// 씨앗: 비슷한 아티스트 목록에서 한 다리(뻔한 위쪽 몇은 건너뜀) · 두 다리 후보
export function seedSteps(hop1, hop2, { seed, known = new Set(), skip = 6 } = {}) {
  const sn = norm(seed);
  const ok = (a) => a && a.name && norm(a.name) !== sn && !known.has(norm(a.name));
  const one = (hop1 || []).filter(ok).slice(skip, 60);
  const h1 = new Set((hop1 || []).map((a) => norm(a.name)));
  const two = (hop2 || []).filter((a) => ok(a) && !h1.has(norm(a.name)));
  return { one, two };
}
