// T/L/L 디깅(DIG, 2026-11-26) — 위 줄 DIG 버튼으로 연다. 사용자 시안 '디깅 덱 셔플'(밤의 바 카운터 위 카드덱)을 그대로 옮기고 진짜 판을 붙였다
// 순서: 덱을 누름 → 스프링으로 왕복해 섞음 → 펼쳐 파도처럼 뒤집음 → 세 장(옆 동네 · 건너 동네 · 먼 나라)이 튀어 오름 → 한 장 고르면 앨범으로 변함
// 판 고르기는 engine.js(장르 지도 atlas.js + 내 취향), 판 찾기는 Spotify 찾기. 취향 재료 = /me/top/artists 세 기간 + 크레이트 아티스트,
// 장르 태그는 Spotify genres → 없으면 /api/music/tags(MusicBrainz). 기록 LS dig.v1 { fb, seen, recent } — fb·seen은 계정 문서(doc.dig)로 동기화
// 화면 전체 겹 하나를 Shadow DOM으로(앱 CSS와 안 섞임). 열려 있으면 body.digon으로 뒤 앱을 숨기고 Deck3D를 멈춘다
// iOS 16.4 전 사파리: importmap·뒤돌아보기 정규식 쓰지 않음(three는 경로로)
import * as THREE from '/3d/three.module.min.js';
import { RoomEnvironment } from '/3d/RoomEnvironment.js';
import { buildProfile, deal as dealHand, seedKey, homeNames, norm, why, SLOTS, BY_ID } from './engine.js';

const C = () => window.MusicCore;
const LSG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const PROF_DAYS = 3;

// ── 기록
export function digState() { const s = LSG('dig.v1', {}); return { fb: s.fb || {}, seen: s.seen || {}, recent: s.recent || [] }; }
function saveState(st, sync = true) { LSS('dig.v1', st); if (sync && C() && C().digSaved) C().digSaved(); }

// ── 취향 읽기
async function topArtists() {
  const out = new Map();
  const add = (a, w) => {
    if (!a || !a.name) return;
    const k = norm(a.name), x = out.get(k) || { name: a.name, id: a.id || '', w: 0, genres: [] };
    x.w += w; if (a.id && !x.id) x.id = a.id;
    if (a.genres && a.genres.length && !x.genres.length) x.genres = a.genres;
    out.set(k, x);
  };
  const R = [['short_term', 3], ['medium_term', 2.2], ['long_term', 1.5]];
  await Promise.all(R.map(async ([tr, w]) => {
    try { const j = await C().api(`/me/top/artists?time_range=${tr}&limit=50`); (j.items || []).forEach((a, i) => add(a, w * (1 - i / 70))); } catch {}
  }));
  // 크레이트에 꽂은 앨범의 아티스트(플레이리스트·잡지·잼은 뺌)
  try {
    for (const a of (C().crateAlbums ? C().crateAlbums() : [])) {
      if (a.k) continue;
      for (const n of String(a.artist || '').split(/\s*,\s*/).slice(0, 2)) add({ name: n }, 0.6);
    }
  } catch {}
  return [...out.values()].sort((a, b) => b.w - a.w).slice(0, 60);
}
async function mbTags(name) {
  const cache = LSG('dig.tags', {}), k = norm(name), hit = cache[k];
  if (hit && Date.now() - hit[0] < 30 * 864e5) return hit[1];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('/api/music/tags?a=' + encodeURIComponent(name));
      if (r.status === 503) { await new Promise((z) => setTimeout(z, 1400)); continue; }
      if (!r.ok) return [];
      const j = await r.json();
      const c2 = LSG('dig.tags', {}); c2[k] = [Date.now(), j.tags || []];
      const keys = Object.keys(c2); if (keys.length > 400) for (const x of keys.slice(0, keys.length - 400)) delete c2[x];
      LSS('dig.tags', c2);
      return j.tags || [];
    } catch { return []; }
  }
  return [];
}
// onStep(진행 글) → 취향. 캐시(dig.prof, 3일)가 있으면 바로
export async function readTaste(force, onStep) {
  const c = LSG('dig.prof', null);
  if (!force && c && Date.now() - c.t < PROF_DAYS * 864e5 && c.P && c.P.n) return c.P;
  onStep && onStep('듣는 아티스트 모으는 중');
  const L = await topArtists();
  const need = L.filter((a) => !a.genres.length).slice(0, 36);
  let done = 0;
  // MusicBrainz는 천천히: 둘씩
  const q = [...need];
  await Promise.all([0, 1].map(async () => {
    while (q.length) {
      const a = q.shift();
      a.tags = await mbTags(a.name);
      done++; onStep && onStep(`장르 읽는 중 ${done}/${need.length}`);
      if (!LSG('dig.tags', {})[norm(a.name)]) await new Promise((z) => setTimeout(z, 600));
    }
  }));
  const P = buildProfile(L.map((a) => ({ name: a.name, w: a.w, tags: a.genres.length ? a.genres.map((g, i) => [g, 10 - i]) : (a.tags || []) })));
  P.at = Date.now(); P.artists = L.length;
  LSS('dig.prof', { t: Date.now(), P });
  return P;
}

// ── Spotify에서 판 찾기
const firstArt = (s) => String(s || '').split(/\s*[&,]\s*|\s+and\s+/i)[0];
function albScore(x, seed) {
  const an = norm(seed.artist), a0 = norm(firstArt(seed.artist));
  const arts = (x.artists || []).map((y) => norm(y.name));
  const artOk = arts.some((y) => y === an || y === a0 || (y.length > 2 && (an.includes(y) || y.includes(a0))));
  if (!artOk) return -1;
  const n = norm(x.name), sn = norm(seed.album);
  let s = 2;
  if (n === sn) s += 4; else if (n.includes(sn) || sn.includes(n)) s += 2.5;
  const y = +(x.release_date || '').slice(0, 4);
  if (seed.year && y) s += Math.abs(y - seed.year) <= 1 ? 1.5 : y > seed.year + 3 ? -0.5 : 0;
  if (x.album_type === 'compilation') s -= 1; if (x.album_type === 'single') s -= 1.5;
  return s;
}
async function search(q, type) {
  const j = await C().api(`/search?type=${type}&limit=10&market=from_token&q=` + encodeURIComponent(q));
  return (j && j[type + 's'] && j[type + 's'].items || []).filter(Boolean);
}
async function findAlbum(seed) {
  let best = null, bs = 0;
  const tryL = (L) => { for (const x of L) { const s = albScore(x, seed); if (s > bs) { bs = s; best = x; } } };
  try { tryL(await search(`album:${seed.album} artist:${firstArt(seed.artist)}`, 'album')); } catch {}
  if (bs < 5) { try { tryL(await search(`${firstArt(seed.artist)} ${seed.album}`, 'album')); } catch {} }
  if (!best) {
    // 앨범 이름으로 못 찾으면 그 아티스트의 정규 앨범 중 연도가 가까운 것
    try {
      const A = (await search(firstArt(seed.artist), 'artist')).find((x) => norm(x.name) === norm(firstArt(seed.artist)));
      if (A) {
        const j = await C().api(`/artists/${A.id}/albums?include_groups=album&limit=20&market=from_token`);
        const L = (j.items || []).sort((a, b) => Math.abs(+(a.release_date || '0').slice(0, 4) - seed.year) - Math.abs(+(b.release_date || '0').slice(0, 4) - seed.year));
        best = L[0] || null;
      }
    } catch {}
  }
  if (!best) return null;
  let full = best;
  try { full = await C().api(`/albums/${best.id}?market=from_token`); } catch {}
  const img = ((full.images || best.images || []).find((i) => i.width && i.width <= 700) || (full.images || best.images || [])[0] || {}).url || '';
  const tracks = (full.tracks && full.tracks.items || []).map((t) => ({ name: t.name, ms: t.duration_ms || 0, uri: t.uri }));
  return {
    raw: full, id: full.id, uri: full.uri || 'spotify:album:' + full.id, name: full.name, artist: (full.artists || []).map((x) => x.name).join(', '),
    year: (full.release_date || '').slice(0, 4), img, label: full.label || '', tracks, n: full.total_tracks || tracks.length,
  };
}

// ── 표지 색(바탕 · 무늬 · 점)
function loadImg(src) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
    setTimeout(() => res(null), 8000);
  });
}
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lum = (h) => { const n = parseInt(h.slice(1), 16), f = (v) => { v /= 255; return v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
const con = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function paletteOf(im) {
  const out = ['#2a2420', '#d9bb7e', '#efe7da'];
  if (!im) return out;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 28; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, 28, 28);
    const d = g.getImageData(0, 0, 28, 28).data, B = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5);
      const b = B.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; B.set(k, b);
    }
    const L = [...B.values()].map((b) => ({ n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((a, b) => b.n - a.n);
    const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 70;
    const pick = [L[0].c];
    for (const x of L) { if (pick.length >= 3) break; if (pick.every((p) => far(p, x.c))) pick.push(x.c); }
    const H = pick.map((p) => hex(...p));
    while (H.length < 3) H.push(lum(H[0]) > 0.3 ? '#14100c' : '#f6f1e7');
    return H;
  } catch { return out; }
}

// ── 화면
const CSS = `
:host{all:initial}
.root{position:fixed;inset:0;z-index:420;color-scheme:dark;--bg:#0c0907;--ink:#efe7da;--dim:#ab9e8c;--line:#3a2f26;--brass:#d9bb7e;--panel:rgba(18,13,10,.84);--acc:#d9bb7e;--accInk:#14100c;
  background:var(--bg);color:var(--ink);font:15px/1.5 "IBM Plex Sans KR",system-ui,sans-serif;overflow:hidden;opacity:0;transition:opacity .35s;-webkit-tap-highlight-color:transparent}
.root.on{opacity:1}
*{box-sizing:border-box;min-width:0}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
header{position:absolute;left:max(16px,3vw);top:max(14px,2.4vh);right:120px;pointer-events:none;max-width:min(560px,80vw);transition:opacity .3s}
h1{font:800 clamp(22px,3vw,34px)/1.08 "Noto Serif KR",serif;margin:0 0 6px;letter-spacing:.01em}
header p{margin:0;color:var(--dim);font-size:14px}
header p b{color:var(--brass);font-weight:600}
.tools{position:absolute;right:max(12px,2vw);top:max(12px,2vh);display:flex;gap:8px;transition:opacity .3s}
button{font:inherit;color:var(--ink);background:#231b15;border:1px solid var(--line);border-radius:10px;min-height:44px;padding:0 14px;cursor:pointer}
button:hover{border-color:#5a4838}
button:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
button[aria-pressed=true]{border-color:var(--acc);color:var(--acc)}
.x{width:44px;padding:0;font-size:20px;line-height:1}
.rv header,.rv .tools .re{opacity:0;pointer-events:none}
.tip{position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:14px;white-space:nowrap;transition:opacity .25s}
.tip.arrow::after{content:"";position:absolute;left:50%;bottom:-6px;width:10px;height:10px;background:inherit;border-right:1px solid var(--line);border-bottom:1px solid var(--line);transform:translateX(-50%) rotate(45deg)}
.tip.slot{padding:4px 11px;font-size:13px;color:var(--brass)}
.tip.slot small{color:var(--dim);margin-left:6px;font-size:12px}
.hide{opacity:0!important}
.msg{position:absolute;left:50%;bottom:max(20px,4vh);transform:translateX(-50%);color:var(--dim);font-size:14px;text-align:center;max-width:90vw;transition:opacity .3s}
.msg button{margin-top:10px;background:var(--brass);color:#1a120b;border-color:var(--brass);font-weight:600}
#info{position:absolute;right:max(20px,4vw);top:50%;width:min(430px,40vw);max-height:min(700px,90vh);overflow:auto;overscroll-behavior:contain;transform:translate(24px,-50%);opacity:0;pointer-events:none;background:rgba(16,12,9,.92);border:1px solid var(--line);border-top:4px solid var(--acc);border-radius:16px;padding:20px 20px 16px;transition:opacity .35s,transform .45s cubic-bezier(.2,.9,.2,1.2)}
#info.on{opacity:1;transform:translate(0,-50%);pointer-events:auto}
.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.chip{display:inline-block;background:var(--acc);color:var(--accInk);font-size:13px;font-weight:600;padding:3px 10px;border-radius:999px}
.chip.o{background:transparent;color:var(--acc);border:1px solid var(--acc)}
#info h2{font:800 clamp(24px,2.8vw,36px)/1.1 "Noto Serif KR",serif;margin:12px 0 6px;word-break:keep-all}
.meta{margin:0;font-size:16px}
.sub{margin:2px 0 12px;color:var(--dim);font-size:14px;font-variant-numeric:tabular-nums}
.why{margin:0 0 6px;font-size:15px;word-break:keep-all}
.desc{margin:0 0 14px;color:var(--dim);font-size:14px;word-break:keep-all}
#info ol{list-style:none;margin:0 0 14px;padding:0;counter-reset:n;border-top:1px solid var(--line)}
#info li{counter-increment:n;display:grid;grid-template-columns:2.2em minmax(0,1fr) auto;gap:8px;padding:9px 0;border-bottom:1px solid var(--line);font-size:15px;opacity:0;transform:translateX(10px);cursor:pointer}
#info li:hover span:nth-child(1){color:var(--acc)}
#info li::before{content:counter(n);color:var(--dim);font-variant-numeric:tabular-nums}
#info li span:nth-child(1){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#info li span:last-child{color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap}
#info.on li{animation:inl .4s cubic-bezier(.2,.9,.2,1) forwards;animation-delay:calc(var(--i) * 40ms + 180ms)}
@keyframes inl{to{opacity:1;transform:none}}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.row button{flex:1 1 auto}
.row .main{background:var(--acc);border-color:var(--acc);color:var(--accInk);font-weight:600}
button .sm{display:none}
@media (max-width:600px){header{right:116px}header p{font-size:13px}h1{font-size:22px}button.re{width:44px;padding:0;font-size:20px}button .lg{display:none}button .sm{display:inline}}
@media (max-aspect-ratio:17/20){#info{left:10px;right:10px;width:auto;top:auto;bottom:10px;max-height:54vh;transform:translateY(24px)}#info.on{transform:none}#info h2{margin-top:8px}}
@media (prefers-reduced-motion:reduce){#info,#info li{transition:none;animation:none!important;opacity:1;transform:none}}
`;
const HTML = `
<div class="root">
<canvas tabindex="0" aria-label="바 위의 카드덱. 덱을 누르면 디깅이 시작됩니다"></canvas>
<header><h1>DIG</h1><p id="sub">취향 읽는 중</p></header>
<div class="tools"><button class="re" id="re" title="최근 듣는 아티스트로 취향을 다시 읽음" aria-label="취향 다시 읽기"><span class="lg">취향 다시 읽기</span><span class="sm" aria-hidden="true">↻</span></button><button class="x" id="x" aria-label="디깅 닫기">×</button></div>
<div id="hint" class="tip arrow hide">덱을 눌러 디깅 시작</div>
<div id="wait" class="tip hide">판 고르는 중</div>
<div class="tip slot hide" id="s0"></div><div class="tip slot hide" id="s1"></div><div class="tip slot hide" id="s2"></div>
<div class="msg hide" id="msg"></div>
<aside id="info" aria-live="polite">
  <div class="chips"><span class="chip" id="iG"></span><span class="chip o" id="iSl"></span></div>
  <h2 id="iT"></h2>
  <p class="meta" id="iA"></p>
  <p class="sub" id="iS"></p>
  <p class="why" id="iW"></p>
  <p class="desc" id="iD"></p>
  <ol id="iL"></ol>
  <div class="row"><button class="main" id="play">턴테이블에 올리기</button><button id="keep">크레이트에 담기</button></div>
  <div class="row"><button id="like" aria-pressed="false">좋아요</button><button id="nope" aria-pressed="false">별로</button></div>
  <div class="row"><button id="again">다시 섞기</button><button id="other">다른 카드 고르기</button></div>
</aside>
</div>`;

let host = null, R = null, api = null;
export async function open() {
  if (!host) await init();
  api.show();
}
export function close() { if (api) api.hide(); }

async function init() {
  if (!document.getElementById('digFonts')) {
    const l = document.createElement('link'); l.id = 'digFonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@600;800&display=swap';
    document.head.append(l);
  }
  host = document.createElement('div'); host.id = 'dig'; host.hidden = true;
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${CSS}</style>${HTML}`;
  document.body.append(host);
  const $ = (s) => sh.querySelector(s);
  const root = $('.root'), cv = $('canvas');

  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const cl = (x) => Math.min(1, Math.max(0, x));
  const eio = (x) => (1 - Math.cos(Math.PI * x)) / 2;
  const eOut = (x) => 1 - (1 - x) ** 3;
  const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const rng = (s) => { let a = (s * 2654435761) % 4294967296; return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = Math.min(screen.width, screen.height) < 600;

  // ── 치수(미터)·타임라인(초) — 시안 그대로
  const N = 36, W = 0.063, HC = 0.088, TH = 0.00042;
  const HOME = new V3(0.2, 0.0011, -0.07);
  const S = new V3(0.17, 0.12, 0.035), TG = new V3(-0.13, 0.12, 0.035);
  const X0 = -0.27, STEP = 0.0125, ZS = 0.085, YB = 0.0004, K = STEP / W, BOW = 0.011;
  const GAP = 0.0165, FLY = 0.34, P1 = 0.5, P2 = 1.5;
  const SQ0 = 2.45, SQ1 = 2.97, SP1 = 3.6, W0 = 3.62, WD = 1.75, FL0 = 5.45, FG = 0.17, FD = 0.8, T_END = 6.7;
  const HOLD = SP1 - 0.02; // 판이 아직 안 골라졌으면 펼친 채 여기서 기다린다(뒤집기 전에 앞면을 바꿔 둬야 해서)
  const C0 = -10, C1 = N - 1 + 10;

  // ── 렌더러·장면
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2));
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0907);
  scene.fog = new THREE.Fog(0x0c0907, 1.2, 3.2);
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.02, 12);
  const LOOK = new V3(-0.02, 0.02, -0.02);
  const spot = new THREE.SpotLight(0xffd8a8, 9, 0, 0.62, 0.75, 0);
  spot.position.set(0.06, 0.62, 0.2); spot.target.position.set(0, 0, -0.01);
  spot.castShadow = true; spot.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); spot.shadow.bias = -0.0002; spot.shadow.normalBias = 0.0015;
  spot.shadow.camera.near = 0.2; spot.shadow.camera.far = 1.2;
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x2a1a10, 0.35));
  const rim = new THREE.DirectionalLight(0x8fb2ff, 0.6); rim.position.set(-0.5, 0.3, -0.6); scene.add(rim);
  const front = new THREE.DirectionalLight(0xfff1df, 0); scene.add(front, front.target);

  // ── 바 상판(나뭇결)·가죽 패드
  function woodTex() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#2b1a0f'; g.fillRect(0, 0, 1024, 512);
    const r = rng(11);
    for (let i = 0; i < 260; i++) {
      const y = r() * 512, a = r() * 0.12;
      g.strokeStyle = `rgba(${r() < 0.5 ? '12,6,3' : '90,56,30'},${a})`; g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 6 + r() * 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  }
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.55 }));
  bar.rotation.x = -Math.PI / 2; bar.receiveShadow = true; scene.add(bar);
  function rrShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  const leather = new THREE.MeshStandardMaterial({ color: 0x1b120d, roughness: 0.85 });
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(0.1, 0.13, 0.012)), leather);
  pad.rotation.x = -Math.PI / 2; pad.position.set(HOME.x, 0.0003, HOME.z); pad.receiveShadow = true; scene.add(pad);

  // ── 잔·시가(자리 표시)
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
  const prof = [[0, 0.0005], [0.036, 0.0005], [0.039, 0.004], [0.04, 0.085], [0.037, 0.085], [0.0355, 0.012], [0, 0.012]].map((p) => new THREE.Vector2(p[0], p[1]));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glassM); glass.position.set(-0.2, 0.001, -0.17); scene.add(glass);
  const coaster = new THREE.Mesh(new THREE.CircleGeometry(0.056, 48), leather); coaster.rotation.x = -Math.PI / 2; coaster.position.set(-0.2, 0.0004, -0.17); scene.add(coaster);
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xeaf4ff, roughness: 0.15, transparent: true, opacity: 0.4, envMapIntensity: 2, depthWrite: false });
  [[0.008, 0.026, 0.004, 0.4], [-0.01, 0.034, -0.006, 1.1]].forEach(([x, y, z, r]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 0.03), iceM); m.position.set(-0.2 + x, y, -0.17 + z); m.rotation.set(r * 0.3, r, r * 0.2); scene.add(m); });
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.014, 8), glassM); tray.position.set(-0.03, 0.007, -0.2); scene.add(tray);
  const cigar = new THREE.Group();
  const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.13, 24), new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8 })); cig.rotation.z = Math.PI / 2; cig.castShadow = true; cigar.add(cig);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0099, 0.0099, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xb8913f, metalness: 0.8, roughness: 0.3 })); band.rotation.z = Math.PI / 2; band.position.x = -0.04; cigar.add(band);
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.0093, 24), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); ember.rotation.y = Math.PI / 2; ember.position.x = 0.0651; cigar.add(ember);
  cigar.position.set(-0.02, 0.0175, -0.2); cigar.rotation.y = 0.5; scene.add(cigar);

  // ── 카드 그림
  const CW = 320, CH = Math.round(320 * HC / W);
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const PAL = [['#1f3b4d', '#e8c46a', '#d9572b'], ['#f1e4cf', '#203a2f', '#c94f3d'], ['#0f1c3f', '#7fb3d5', '#f3d9b1'], ['#3b1d3e', '#ee8a6a', '#f6d7a7'],
    ['#e4ded0', '#111111', '#e23b2e'], ['#123024', '#9fcf8a', '#f2efe0'], ['#2a2a2a', '#f5a524', '#e9e4da'], ['#6b2737', '#f0c9a0', '#2d2a32'],
    ['#d6e4e1', '#2f5d62', '#e07a5f'], ['#141414', '#5cc8c0', '#ff5d8f'], ['#f4c95d', '#1b2a41', '#e8e2d2'], ['#2e1f17', '#c98b4b', '#efe1c6'],
    ['#b9d7ea', '#14213d', '#fca311'], ['#40263c', '#9ee6cf', '#ffd6e0'], ['#f6f1e7', '#2b59c3', '#f25c54'], ['#1c2b2d', '#e9b872', '#f7f3e3'],
    ['#ff6b4a', '#1a1423', '#fff1d6'], ['#2d3047', '#e0a458', '#93b7be']];
  const faceOf = (p, i) => { const [bg, a1, a2] = p, el = con(bg, a1) >= con(bg, a2) ? a1 : a2; return { bg, el: con(bg, el) < 2.2 ? (lum(bg) > 0.3 ? '#14100c' : '#f6f1e7') : el, acc: el === a1 ? a2 : a1, rank: RANKS[(i * 7 + 3) % 13], suit: (i * 3 + Math.floor(i / 13)) % 4 }; };
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function suitPath(g, s, x, y, z) {
    g.save(); g.translate(x, y); g.scale(z / 100, z / 100); g.beginPath();
    if (s === 1) { g.moveTo(0, 38); g.bezierCurveTo(-60, -8, -38, -58, 0, -26); g.bezierCurveTo(38, -58, 60, -8, 0, 38); }
    else if (s === 2) { g.moveTo(0, -46); g.quadraticCurveTo(14, -16, 36, 0); g.quadraticCurveTo(14, 16, 0, 46); g.quadraticCurveTo(-14, 16, -36, 0); g.quadraticCurveTo(-14, -16, 0, -46); }
    else if (s === 0) { g.moveTo(0, -44); g.bezierCurveTo(-60, 4, -40, 48, -4, 20); g.lineTo(-14, 44); g.lineTo(14, 44); g.lineTo(4, 20); g.bezierCurveTo(40, 48, 60, 4, 0, -44); }
    else { g.arc(0, -20, 18, 0, 7); g.moveTo(-2, 8); g.arc(-20, 8, 18, 0, 7); g.moveTo(38, 8); g.arc(20, 8, 18, 0, 7); g.moveTo(-5, 10); g.lineTo(-14, 44); g.lineTo(14, 44); g.lineTo(5, 10); }
    g.closePath(); g.fill(); g.restore();
  }
  const PIPS = { 2: [[0.5, 0.18], [0.5, 0.82]], 3: [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]], 4: [[0.3, 0.18], [0.7, 0.18], [0.3, 0.82], [0.7, 0.82]] };
  PIPS[5] = [...PIPS[4], [0.5, 0.5]]; PIPS[6] = [...PIPS[4], [0.3, 0.5], [0.7, 0.5]]; PIPS[7] = [...PIPS[6], [0.5, 0.34]]; PIPS[8] = [...PIPS[7], [0.5, 0.66]];
  PIPS[9] = [[0.3, 0.18], [0.7, 0.18], [0.3, 0.39], [0.7, 0.39], [0.3, 0.61], [0.7, 0.61], [0.3, 0.82], [0.7, 0.82], [0.5, 0.5]]; PIPS[10] = [...PIPS[9].slice(0, 8), [0.5, 0.29], [0.5, 0.71]];
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  function trumpTex(a, tag) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    rr(g, 0, 0, CW, CH, 22); g.fillStyle = a.bg; g.fill();
    g.strokeStyle = a.acc; g.globalAlpha = 0.55; g.lineWidth = 2; rr(g, 10, 10, CW - 20, CH - 20, 15); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = a.el;
    const idx = () => { g.font = `800 ${a.rank === '10' ? 38 : 44}px "Noto Serif KR", serif`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(a.rank, 38, 20); suitPath(g, a.suit, 38, 90, 30); };
    idx(); g.save(); g.translate(CW, CH); g.rotate(Math.PI); idx(); g.restore();
    const bx = 70, by = 64, bw = CW - 140, bh = CH - 128;
    if (a.rank === 'A') { suitPath(g, a.suit, CW / 2, CH / 2, 130); g.strokeStyle = a.acc; g.lineWidth = 2; g.beginPath(); g.arc(CW / 2, CH / 2, 92, 0, 7); g.stroke(); }
    else if ('JQK'.includes(a.rank)) {
      g.fillStyle = a.acc; g.globalAlpha = 0.9; rr(g, bx, by, bw, bh, 10); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = a.el; g.lineWidth = 3; rr(g, bx + 8, by + 8, bw - 16, bh - 16, 6); g.stroke();
      g.fillStyle = a.el; g.font = '800 120px "Noto Serif KR", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.rank, CW / 2, CH / 2 + 6);
      suitPath(g, a.suit, CW / 2, by + 44, 42); g.save(); g.translate(CW / 2, by + bh - 44); g.rotate(Math.PI); suitPath(g, a.suit, 0, 0, 42); g.restore();
    } else {
      for (const [px, py] of PIPS[+a.rank]) {
        const x = bx + px * bw, y = by + py * bh;
        if (py > 0.55) { g.save(); g.translate(x, y); g.rotate(Math.PI); suitPath(g, a.suit, 0, 0, 52); g.restore(); } else suitPath(g, a.suit, x, y, 52);
      }
    }
    if (tag) { // 뽑힌 카드: 아래쪽에 장르 띠(공개 전 힌트)
      g.fillStyle = a.el; g.globalAlpha = 0.92; rr(g, 46, CH - 60, CW - 92, 30, 15); g.fill(); g.globalAlpha = 1;
      g.fillStyle = a.bg; g.font = '600 17px "IBM Plex Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let t = tag; while (g.measureText(t).width > CW - 120 && t.length > 2) t = t.slice(0, -2) + '…';
      g.fillText(t, CW / 2, CH - 45);
    }
    return tex(c);
  }
  function coverTex(h) {
    const a = h.alb, c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    rr(g, 0, 0, CW, CH, 22); g.fillStyle = '#e9e0d0'; g.fill();
    const m = 20, s = CW - m * 2;
    g.save(); g.beginPath(); g.rect(m, m, s, s); g.clip();
    if (h.im) g.drawImage(h.im, m, m, s, s); else { g.fillStyle = h.face.bg; g.fillRect(m, m, s, s); }
    g.restore();
    g.fillStyle = '#17110c'; g.font = '800 26px "Noto Serif KR", serif'; g.textBaseline = 'top'; g.textAlign = 'left';
    let t = a.name; while (g.measureText(t).width > s && t.length > 2) t = t.slice(0, -2) + '…';
    g.fillText(t, m, m + s + 16);
    g.fillStyle = '#6d6052'; g.font = '500 18px "IBM Plex Sans KR", sans-serif';
    let ar = a.artist; while (g.measureText(ar).width > s - 60 && ar.length > 2) ar = ar.slice(0, -2) + '…';
    g.fillText(ar, m, m + s + 52);
    g.textAlign = 'right'; g.fillText(String(a.year || ''), CW - m, m + s + 52);
    g.textAlign = 'left'; g.fillStyle = h.pal[0]; g.fillRect(m, CH - 50, 30, 6); g.fillStyle = h.pal[1]; g.fillRect(m + 30, CH - 50, 30, 6); g.fillStyle = h.pal[2]; g.fillRect(m + 60, CH - 50, 30, 6);
    g.fillStyle = '#8a7c6c'; g.font = '500 15px "IBM Plex Sans KR", sans-serif'; g.textAlign = 'right';
    let gn = `${h.g.name} · ${a.n || a.tracks.length}곡`; while (g.measureText(gn).width > s - 110 && gn.length > 2) gn = gn.slice(0, -2) + '…';
    g.fillText(gn, CW - m, CH - 56);
    g.strokeStyle = '#cbbfae'; g.lineWidth = 2; rr(g, 6, 6, CW - 12, CH - 12, 17); g.stroke();
    return tex(c);
  }
  function backTex() {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    rr(g, 0, 0, CW, CH, 22); g.fillStyle = '#3a1316'; g.fill();
    g.save(); rr(g, 18, 18, CW - 36, CH - 36, 12); g.clip();
    g.strokeStyle = 'rgba(217,187,126,.22)'; g.lineWidth = 1.5;
    for (let i = -20; i < 40; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + CH, CH); g.stroke(); g.beginPath(); g.moveTo(i * 22, CH); g.lineTo(i * 22 + CH, 0); g.stroke(); }
    g.restore();
    g.strokeStyle = '#d9bb7e'; g.lineWidth = 3; rr(g, 18, 18, CW - 36, CH - 36, 12); g.stroke();
    g.lineWidth = 1.2; rr(g, 26, 26, CW - 52, CH - 52, 8); g.stroke();
    g.fillStyle = '#3a1316'; g.beginPath(); g.arc(CW / 2, CH / 2, 62, 0, 7); g.fill();
    g.lineWidth = 2.5; g.beginPath(); g.arc(CW / 2, CH / 2, 62, 0, 7); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(CW / 2, CH / 2, 54, 0, 7); g.stroke();
    g.fillStyle = '#d9bb7e'; g.font = '800 34px "Noto Serif KR", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T/L/L', CW / 2, CH / 2 + 2);
    return tex(c);
  }
  await Promise.race([Promise.all([document.fonts.load('800 26px "Noto Serif KR"'), document.fonts.load('500 18px "IBM Plex Sans KR"')]), new Promise((r) => setTimeout(r, 1800))]).catch(() => {});
  const DECO = PAL.map((p, i) => trumpTex(faceOf(p, i))), BACK = backTex();

  // ── 카드(앞·뒤 판 두 장, 휨은 셰이더)
  const HH = (HC / 2).toFixed(5);
  function bendMat(map, u) {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.5, alphaTest: 0.5 });
    m.onBeforeCompile = (sh2) => { sh2.uniforms.uBend = u; sh2.vertexShader = 'uniform float uBend;\n' + sh2.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat yy = position.y / ${HH};\ntransformed.z += uBend * (1.0 - yy * yy);`); };
    m.customProgramCacheKey = () => 'bend';
    return m;
  }
  const geo = new THREE.PlaneGeometry(W, HC, 2, 16);
  const cards = [], hits = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(), uf = { value: 0 }, ub = { value: 0 };
    const f = new THREE.Mesh(geo, bendMat(DECO[i % DECO.length], uf)), b = new THREE.Mesh(geo, bendMat(BACK, ub));
    b.rotation.y = Math.PI; f.castShadow = b.castShadow = true; f.receiveShadow = b.receiveShadow = true;
    f.userData.i = b.userData.i = i; g.add(f, b); scene.add(g); hits.push(f, b);
    cards.push({ g, f, uf, ub, hov: 0, face: DECO[i % DECO.length] });
  }
  const JIT = Array.from({ length: N }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
  let picks = [0, 0, 0];
  let hand = null; // 이번 판 세 장 [{ slot, slotName, g, why, alb, im, pal, face, trump, cover }]
  const setMap = (c, t) => { if (c.f.material.map !== t) { c.f.material.map = t; c.f.material.needsUpdate = true; } };
  function shuffleFaces() {
    const perm = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    cards.forEach((c, i) => { c.face = DECO[perm[i] % DECO.length]; setMap(c, c.face); });
    picks = [3 + Math.floor(Math.random() * 7), 14 + Math.floor(Math.random() * 8), 25 + Math.floor(Math.random() * 8)];
  }
  function applyHand() { if (!hand) return; picks.forEach((j, k) => { cards[j].face = hand[k].trump; setMap(cards[j], hand[k].trump); }); }
  shuffleFaces();

  // ── 자세 계산(시안 그대로)
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
  const qAx = (a, t) => new Q().setFromAxisAngle(a, t);
  const qDown = qAx(AY, Math.PI).multiply(qAx(AX, Math.PI / 2));
  const qStream = qAx(AY, Math.PI + 0.96);
  const nL = new V3(0, 0, 1).applyQuaternion(qStream);
  const mk = () => ({ p: new V3(), q: new Q(), b: 0 });
  const A = mk(), B = mk(), qT = new Q(), qT2 = new Q(), vT = new V3();
  const homeP = (i, o) => { o.p.set(HOME.x, HOME.y + (N - 1 - i) * TH, HOME.z); o.q.copy(qDown); o.b = 0; return o; };
  const srcP = (i, o) => { o.p.copy(S).addScaledVector(nL, ((N - 1) / 2 - i) * TH * 1.8); o.q.copy(qStream); o.b = BOW; return o; };
  const tgtP = (i, o) => { o.p.copy(TG).addScaledVector(nL, ((N - 1) / 2 - i) * TH * 1.8); o.q.copy(qStream); o.b = 0; return o; };
  const flatP = (i, o) => { o.p.set(X0, YB + i * TH, ZS); o.q.copy(qDown); o.b = 0; return o; };
  function mix(a, b, u, o, arc) { o.p.lerpVectors(a.p, b.p, u); o.p.y += arc * Math.sin(Math.PI * u); o.q.slerpQuaternions(a.q, b.q, u); o.b = a.b + (b.b - a.b) * u; return o; }
  function waveP(j, phi, o) {
    const r = X0 + j * STEP + W / 2, q = sm(phi / Math.PI);
    o.p.set(r - (W / 2) * Math.cos(phi), YB + (W / 2) * Math.sin(phi) + TH * (j * (1 - q) + (N - 1 - j) * q), ZS);
    qT.setFromAxisAngle(AZ, -phi); o.q.copy(qT).multiply(qDown); o.b = 0; return o;
  }
  const chR = (p) => p - Math.asin(K * Math.sin(p));
  const chL = (p) => { let x = p; for (let k = 0; k < 5; k++) x = p + Math.asin(K * Math.sin(x)); return x; };
  const PHI = new Float32Array(N);
  function waveAt(t) {
    const u = cl((t - W0) / WD), c = C0 + (C1 - C0) * eio(u), f = Math.floor(c), a = c - f;
    const pf = Math.PI / 2 + a * (chL(Math.PI / 2) - Math.PI / 2);
    for (let j = 0; j < N; j++) {
      let p = pf;
      if (j > f) for (let k = f; k < j; k++) p = chR(p); else for (let k = f; k > j; k--) p = chL(p);
      p = Math.min(Math.PI, Math.max(0, p)) * sm((t - W0) / 0.25);
      p += (Math.PI - p) * sm((t - (W0 + WD - 0.3)) / 0.3);
      PHI[j] = p;
    }
  }
  function fly(i, p, from, to, arc, dir, b0, b1, o) {
    const e = eio(p), s = Math.sin(Math.PI * e), J = JIT[i];
    from(i, A); to(i, B);
    o.p.lerpVectors(A.p, B.p, e); o.p.y += (arc + J[0] * 0.014) * s; o.p.z += J[1] * 0.012 * s;
    o.q.copy(qStream).multiply(qT.setFromAxisAngle(AX, dir * Math.sin(Math.PI * p) * (0.8 + J[2] * 0.25))).multiply(qT2.setFromAxisAngle(AZ, J[1] * 0.35 * s));
    o.b = b0 + (b1 - b0) * e - dir * 0.008 * Math.sin(Math.PI * p); return o;
  }
  const BP = new V3(), BQ = new Q(), BR = new V3(), BU = new V3(), BF = new V3();
  let portrait = false;
  function camPt(x, y, d, o) { return o.copy(BP).addScaledVector(BR, x).addScaledVector(BU, y).addScaledVector(BF, d); }
  function slotP(k, o, bob) {
    const d = Math.max(0.5, 0.115 / (Math.tan(Math.PI / 12) * cam.aspect)), th = Math.tan(Math.PI / 12) * d;
    camPt((k - 1) * 0.078, -th * 0.08 + (bob || 0), d, o.p);
    o.q.copy(BQ).multiply(qT.setFromAxisAngle(AX, -0.12)).multiply(qT2.setFromAxisAngle(AZ, (k - 1) * -0.06)); o.b = 0; return o;
  }
  function revP(o) {
    const d = portrait ? 0.47 : 0.27, th = Math.tan(Math.PI / 12) * d;
    camPt(portrait ? 0 : -th * cam.aspect * 0.42, portrait ? th * 0.45 : th * 0.02, d, o.p);
    o.q.copy(BQ); o.b = 0; return o;
  }
  function tlPose(i, t, o) {
    if (t <= 0.45) { const u = eio(cl(t / 0.45)); mix(homeP(i, A), srcP(i, B), u, o, 0.03); o.b = BOW * u; return o; }
    const t1 = P1 + i * GAP, t2 = P2 + (N - 1 - i) * GAP;
    if (t < t1) return srcP(i, o);
    if (t < t1 + FLY) return fly(i, (t - t1) / FLY, srcP, tgtP, 0.075, 1, BOW, 0, o);
    if (t < t2) { tgtP(i, o); o.b = -BOW * sm((t - (P2 - 0.14)) / 0.14); return o; }
    if (t < t2 + FLY) return fly(i, (t - t2) / FLY, tgtP, srcP, 0.11, -1, -BOW, 0, o);
    if (t < SQ0) { srcP(i, o); o.b = 0; return o; }
    if (t < SQ1) { srcP(i, A); A.b = 0; return mix(A, flatP(i, B), eio(cl((t - SQ0) / (SQ1 - SQ0))), o, 0.025); }
    if (t < W0) {
      const u = eOut(cl((t - 2.99) / (SP1 - 2.99))), xd = X0 + u * (N - 1) * STEP;
      o.p.set(Math.min(xd, X0 + i * STEP), YB + i * TH, ZS); o.q.copy(qDown); o.b = 0; return o;
    }
    const k = picks.indexOf(i);
    if (k < 0 || t < FL0 + k * FG) return waveP(i, PHI[i], o);
    const u = cl((t - FL0 - k * FG) / FD);
    if (u >= 1) return slotP(k, o, 0);
    waveP(i, Math.PI, A); slotP(k, B, 0);
    const e = eOut(u), pre = sm(u / 0.08) * (1 - sm((u - 0.08) / 0.06));
    vT.lerpVectors(A.p, B.p, 0.5); vT.y += 0.13;
    o.p.set(0, 0, 0).addScaledVector(A.p, (1 - e) ** 2).addScaledVector(vT, 2 * e * (1 - e)).addScaledVector(B.p, e * e);
    o.p.y -= pre * 0.002;
    o.q.slerpQuaternions(A.q, B.q, e).multiply(qT.setFromAxisAngle(AX, -4 * Math.PI * eio(cl(u / 0.85)))).multiply(qT2.setFromAxisAngle(AY, Math.sin(Math.PI * e) * 0.6));
    o.b = 0.006 * pre; return o;
  }

  // ── 소리(WebAudio 잡음, 설정 '효과음'을 따름)
  let ac = null, noise = null;
  const sound = () => LSG('music.sfx', true) !== false;
  function audio() {
    try {
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      if (ac.state === 'suspended') ac.resume();
    } catch { ac = null; }
  }
  function burst(dur, f, q, gain, type = 'bandpass', f2) {
    if (!ac || !sound()) return;
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime;
    s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl).connect(g).connect(ac.destination); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.03);
  }
  const SFX = {
    lift: () => burst(0.35, 700, 0.6, 0.12, 'lowpass'),
    tick: () => burst(0.026, 3000 + Math.random() * 1600, 1.4, 0.26),
    tap: () => { burst(0.08, 800, 0.9, 0.55); burst(0.03, 3600, 1, 0.22); },
    shh: () => burst(0.7, 2600, 0.45, 0.13),
    flip: () => burst(0.045, 2300 + Math.random() * 900, 1.6, 0.2),
    flick: () => { burst(0.035, 4800, 2, 0.35); burst(0.3, 1800, 0.7, 0.1, 'bandpass', 600); },
    slap: () => { burst(0.12, 600, 0.8, 0.8); burst(0.05, 2800, 1, 0.35); },
    whirr: () => burst(0.02, 5200, 3, 0.12),
    ding: () => burst(0.5, 3200, 18, 0.25),
  };
  const EV = [[0.02, 'lift']];
  for (let i = 0; i < N; i++) EV.push([P1 + i * GAP + FLY, 'tick'], [P2 + (N - 1 - i) * GAP + FLY, 'tick']);
  EV.push([SQ1 - 0.04, 'tap'], [3.0, 'shh']);
  for (let j = 0; j < N; j++) EV.push([W0 + WD * Math.acos(1 - 2 * (j - C0) / (C1 - C0)) / Math.PI, 'flip']);
  for (let k = 0; k < 3; k++) EV.push([FL0 + k * FG + 0.01, 'flick'], [FL0 + k * FG + FD - 0.02, 'tick']);
  EV.sort((a, b) => a[0] - b[0]);

  // ── 판 고르기(데이터)
  let P = null, st = digState(), prepP = null, next = null, reading = false;
  const sub = $('#sub'), msg = $('#msg');
  const say = (h) => { sub.innerHTML = h; };
  function homeLine() { const H = P ? homeNames(P, 4) : []; say(H.length ? `내 동네 <b>${H.join(' · ')}</b> — 여기서 벗어난 세 장을 뽑아요` : '듣는 기록이 적어서 여러 갈래에서 고르게 뽑아요'); }
  async function ensureTaste(force) {
    if (P && !force) return P;
    reading = true;
    try { P = await readTaste(force, (s) => say(s)); } catch { P = buildProfile([]); }
    reading = false; homeLine(); return P;
  }
  async function makeHand() {
    await ensureTaste();
    st = digState();
    for (let tries = 0; tries < 3; tries++) {
      const H = dealHand(P, st);
      if (H.length < 3) break;
      const got = await Promise.all(H.map(async (h) => {
        for (let k = 0; k < 3 && h.seed; k++) {
          const alb = await findAlbum(h.seed).catch(() => null);
          if (alb && alb.tracks.length) return { ...h, alb };
          st.seen[seedKey(h.seed)] = { t: Date.now(), g: h.g.id, miss: 1 }; // 못 찾은 판은 다시 안 고름
          const L = h.g.seeds.filter((s) => !st.seen[seedKey(s)]);
          h.seed = L.length ? L[Math.floor(Math.random() * L.length)] : null;
          if (h.seed) h.why = why(h.g, P, h.seed.year);
        }
        return null;
      }));
      if (got.every(Boolean)) {
        await Promise.all(got.map(async (h, k) => {
          const y = +h.alb.year; if (y && Math.abs(y - (h.seed.year || y)) > 2) h.why = why(h.g, P, y);
          h.im = await loadImg(h.alb.img); h.pal = paletteOf(h.im);
          h.face = faceOf(h.pal, k * 5 + Math.floor(Math.random() * 13)); h.face.rank = RANKS[Math.floor(Math.random() * 13)]; h.face.suit = Math.floor(Math.random() * 4);
          h.trump = trumpTex(h.face, h.g.name); h.cover = null;
        }));
        st.recent = [...got.map((h) => h.g.id), ...(st.recent || [])].slice(0, 9);
        saveState(st, false);
        return got;
      }
      saveState(st, false);
    }
    throw new Error('판을 찾지 못했습니다');
  }
  function prep() {
    if (prepP) return prepP;
    prepP = makeHand().then((h) => { next = h; return h; }).catch((e) => { prepP = null; throw e; });
    return prepP;
  }
  function takeHand() { if (!next) return false; hand = next; next = null; prepP = null; applyHand(); return true; }

  // ── 상태
  let t = 0, playing = false, mode = 'tl', gk = 0, autoPlay = false, hover = -1, shake = 0, running = false, waitErr = null;
  let rv = { k: -1, j: -1, t: 0, swapped: false, half: 0, info: false, slap: false };
  const snap = Array.from({ length: N }, mk), O = mk();
  const loggedIn = () => C() && C().loggedIn && C().loggedIn();
  function needLogin() {
    msg.innerHTML = 'Spotify에 로그인해야 판을 찾을 수 있어요<br><button id="login">Spotify 로그인</button>';
    msg.classList.remove('hide'); msg.querySelector('#login').onclick = () => { api.hide(); C().openDlg(); };
  }
  function start() {
    audio();
    if (!loggedIn()) { needLogin(); return; }
    waitErr = null; msg.classList.add('hide');
    prep().catch((e) => { waitErr = e; });
    if (reduce) { if (takeHand()) { t = T_END; playing = false; } else { playing = true; t = HOLD; } return; }
    if (t >= T_END) { gather(true); return; }
    playing = true;
  }
  function snapAll() { cards.forEach((c, i) => { snap[i].p.copy(c.g.position); snap[i].q.copy(c.g.quaternion); snap[i].b = 0; }); }
  function gather(then) {
    if (mode === 'gather') return;
    hideInfo(); playing = false; autoPlay = !!then; snapAll();
    mode = 'gather'; gk = 0; SFX.shh();
    if (then) prep().catch((e) => { waitErr = e; });
  }
  const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function reveal(k) {
    const h = hand && hand[k]; if (!h) return;
    mode = 'reveal'; rv = { k, j: picks[k], t: 0, swapped: false, half: 0, info: false, slap: false };
    if (!h.cover) h.cover = coverTex(h);
    const a = h.alb, el = h.face.el;
    const acc = [el, h.face.acc, ...h.pal].find((x) => x && con(x, '#100c09') >= 3.2) || '#d9bb7e';
    root.style.setProperty('--acc', acc); root.style.setProperty('--accInk', lum(acc) > 0.3 ? '#14100c' : '#f6f1e7');
    $('#iG').textContent = h.g.name; $('#iSl').textContent = h.slotName;
    $('#iT').textContent = a.name; $('#iA').textContent = `${a.artist}${a.year ? ' · ' + a.year : ''}`;
    const tot = a.tracks.reduce((s, x) => s + x.ms, 0);
    $('#iS').textContent = `${a.tracks.length}곡 · ${Math.floor(tot / 60000)}분${a.label ? ' · ' + a.label : ''}`;
    $('#iW').textContent = h.why.text; $('#iD').textContent = h.g.desc;
    const ol = $('#iL'); ol.innerHTML = '';
    a.tracks.slice(0, 40).forEach((x, i) => {
      const li = document.createElement('li'); li.style.setProperty('--i', Math.min(i, 14));
      const s1 = document.createElement('span'), s2 = document.createElement('span'); s1.textContent = x.name; s2.textContent = mmss(x.ms);
      li.append(s1, s2); li.title = '이 곡부터 듣기'; li.onclick = () => playIt(h, x.uri); ol.append(li);
    });
    paintFb(h);
    // 본 판 기록
    st = digState(); st.seen[seedKey(h.seed)] = { t: Date.now(), g: h.g.id }; saveState(st);
    if (reduce) rv.t = 3;
    // 다음 판 미리
    setTimeout(() => prep().catch(() => {}), 2500);
  }
  function paintFb(h) { const v = ((digState().fb || {})[h.g.id] || {}).v || 0; $('#like').setAttribute('aria-pressed', v > 0); $('#nope').setAttribute('aria-pressed', v < 0); }
  function setFb(v) {
    const h = hand && hand[rv.k]; if (!h) return;
    st = digState(); const cur = (st.fb[h.g.id] || {}).v || 0;
    st.fb[h.g.id] = { v: cur === v ? 0 : v, u: Date.now() }; saveState(st);
    paintFb(h);
    next = null; prepP = null; // 다음 판은 새 기록으로
  }
  function playIt(h, uri) {
    const a = C().toAlbum ? C().toAlbum(h.alb.raw) : { id: h.alb.id, uri: h.alb.uri, name: h.alb.name, artist: h.alb.artist, img: h.alb.img, year: h.alb.year, n: h.alb.n };
    api.hide(); C().playAlbum(a, uri);
  }
  function keep() {
    const h = hand && hand[rv.k]; if (!h) return;
    const a = C().toAlbum ? C().toAlbum(h.alb.raw) : null;
    if (a && C().addToCrate) { C().addToCrate('c-dig', 'DIG', 998, a); C().toast('DIG 크레이트에 담았습니다'); $('#keep').textContent = '담음'; }
  }
  function hideInfo() { $('#info').classList.remove('on'); $('#keep').textContent = '크레이트에 담기'; }
  function unreveal() { if (mode !== 'reveal') return; hideInfo(); snapAll(); mode = 'unreveal'; gk = 0; SFX.flick(); }

  // ── 화면 맞추기
  function fit() {
    const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; portrait = cam.aspect < 0.85;
    const th = Math.tan(Math.PI / 12);
    const d = Math.max(0.29 / th, 0.33 / (th * cam.aspect)) * 0.96, el = THREE.MathUtils.degToRad(50);
    cam.position.set(LOOK.x, LOOK.y + d * Math.sin(el), LOOK.z + d * Math.cos(el));
    cam.lookAt(LOOK.x, LOOK.y - 0.025, LOOK.z); cam.updateProjectionMatrix();
    scene.fog.near = d * 1.25; scene.fog.far = d * 3.4;
    BP.copy(cam.position); BQ.copy(cam.quaternion);
    BR.set(1, 0, 0).applyQuaternion(BQ); BU.set(0, 1, 0).applyQuaternion(BQ); BF.set(0, 0, -1).applyQuaternion(BQ);
    front.position.copy(BP); front.target.position.copy(BP).add(BF);
  }
  addEventListener('resize', () => { if (running) fit(); });
  fit();
  const FOC = new V3().addVectors(S, TG).multiplyScalar(0.5), LK = new V3();
  function placeCam() {
    const k = mode === 'tl' ? sm((t - 0.3) / 0.35) * (1 - sm((t - 2.35) / 0.45)) : 0;
    cam.position.copy(BP).lerp(FOC, 0.24 * k);
    LK.set(LOOK.x, LOOK.y - 0.025, LOOK.z).lerp(FOC, 0.6 * k);
    if (shake > 0.00001) { cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake; }
    cam.lookAt(LK);
  }

  // ── 조작
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function hitAt(e) {
    const r = cv.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, cam); const h = ray.intersectObjects(hits, false)[0];
    if (h) return h.object.userData.i;
    return ray.intersectObject(pad, false)[0] ? -2 : -1;
  }
  const idle0 = () => mode === 'tl' && t === 0 && !playing, ready3 = () => mode === 'tl' && t >= T_END && !playing;
  cv.addEventListener('pointermove', (e) => {
    const i = hitAt(e); hover = ready3() && picks.includes(i) ? i : -1;
    cv.style.cursor = (idle0() && i !== -1) || hover >= 0 ? 'pointer' : 'default';
  });
  cv.addEventListener('pointerleave', () => { hover = -1; });
  cv.addEventListener('click', (e) => {
    audio(); const i = hitAt(e);
    if (idle0() && i !== -1) return start();
    if (ready3() && picks.includes(i)) { hover = -1; SFX.flick(); reveal(picks.indexOf(i)); }
    else if (ready3() && i === -2) gather(true);
  });
  $('#play').onclick = () => { const h = hand && hand[rv.k]; if (h) playIt(h); };
  $('#keep').onclick = keep;
  $('#like').onclick = () => setFb(1);
  $('#nope').onclick = () => setFb(-1);
  $('#again').onclick = () => { audio(); gather(true); };
  $('#other').onclick = () => { audio(); unreveal(); };
  $('#x').onclick = () => api.hide();
  $('#re').onclick = async () => {
    if (reading) return;
    if (!loggedIn()) { needLogin(); return; }
    next = null; prepP = null; await ensureTaste(true);
    if (mode === 'tl' && t > 0) gather(false);
    C().toast && C().toast('취향을 다시 읽었습니다');
  };
  function onKey(e) {
    if (host.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); if (mode === 'reveal') unreveal(); else api.hide(); return; }
    const tg = e.composedPath && e.composedPath()[0];
    if (tg && tg.tagName === 'BUTTON') return;
    if (e.code === 'Space') { e.preventDefault(); if (idle0()) start(); else if (ready3()) gather(true); }
    if (ready3() && ['1', '2', '3'].includes(e.key)) { audio(); SFX.flick(); reveal(+e.key - 1); }
  }

  // 공개: 왼쪽으로 와서 커짐 → 탁 → 네 바퀴 돌며 앨범 표지로 → 정보
  function revealPose(c, o) {
    const T0 = 0.55, T1 = 0.74, T2 = 2.25, h = hand[rv.k];
    slotP(rv.k, A, 0); revP(B);
    mix(A, B, eio(cl(rv.t / T0)), o, 0.015);
    if (rv.t > T0 && rv.t < T1 + 0.1) {
      const s = Math.sin(Math.PI * cl((rv.t - T0) / (T1 + 0.1 - T0)));
      o.p.addScaledVector(BF, 0.03 * s); o.q.multiply(qT.setFromAxisAngle(AZ, 0.12 * s)).multiply(qT2.setFromAxisAngle(AX, -0.35 * s));
      if (!rv.slap) { rv.slap = true; SFX.slap(); }
    }
    if (rv.t >= T1) {
      const u = cl((rv.t - T1) / (T2 - T1)), ang = 8 * Math.PI * (1 - (1 - u) ** 3);
      o.q.multiply(qT.setFromAxisAngle(AY, ang)).multiply(qT2.setFromAxisAngle(AX, 0.3 * Math.sin(Math.PI * u)));
      o.p.addScaledVector(BU, 0.012 * Math.sin(Math.PI * u));
      const half = Math.floor((ang + Math.PI / 2) / Math.PI);
      if (half > rv.half) { rv.half = half; SFX.whirr(); }
      if (!rv.swapped && u > 0.45 && Math.cos(ang) < -0.3) { rv.swapped = true; setMap(c, h.cover); }
    }
    if (!rv.info && rv.t >= T2 - 0.12) { rv.info = true; if (!rv.swapped) { rv.swapped = true; setMap(c, h.cover); } $('#info').classList.add('on'); SFX.ding(); }
    return o;
  }

  // ── 그리기
  let last = performance.now(), raf = 0;
  const hint = $('#hint'), wait = $('#wait'), slotTips = [$('#s0'), $('#s1'), $('#s2')], hv = new V3();
  const place = (el, v, dy) => {
    v.project(cam);
    const hw = (el.offsetWidth || 0) / 2 + 8, x = (v.x + 1) / 2 * innerWidth;
    el.style.left = Math.min(innerWidth - hw, Math.max(hw, x)) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight - dy) + 'px';
  };
  function frame(now) {
    raf = 0; if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'tl' && playing) {
      const prev = t; let nt = Math.min(T_END, t + dt);
      // 판이 아직이면 펼친 채 기다림
      if (!hand && nt >= HOLD && !takeHand()) nt = Math.max(t, HOLD);
      t = nt;
      for (const [et, k] of EV) if (et > prev && et <= t) { SFX[k](); if (k === 'tick' && et < SQ0) shake = Math.min(0.0035, shake + 0.0005); }
      if (t >= T_END) playing = false;
    }
    shake *= Math.exp(-dt * 10);
    if (mode === 'tl' && t >= W0) waveAt(Math.min(t, W0 + WD));
    if (mode === 'reveal') rv.t += dt;
    if (mode === 'gather' || mode === 'unreveal') gk += dt;
    placeCam();
    for (let i = 0; i < N; i++) {
      const c = cards[i], k = picks.indexOf(i);
      if (mode === 'gather') { const u = eio(cl((gk - (N - 1 - i) * 0.012) / 0.5)); homeP(i, B); mix(snap[i], B, u, O, 0.04); }
      else if (mode === 'tl') tlPose(i, t, O);
      else if (k < 0) waveP(i, Math.PI, O);
      else if (mode === 'unreveal') {
        const u = eio(cl(gk / 0.6)); slotP(k, B, 0); mix(snap[i], B, u, O, 0.02);
        if (i === rv.j) { const a = 2 * Math.PI * u; O.q.multiply(qT.setFromAxisAngle(AY, a)); if (Math.cos(a) < -0.2) setMap(c, c.face); }
      } else if (i === rv.j) revealPose(c, O);
      else { const u = eio(cl(rv.t / 0.5)); slotP(k, A, 0); waveP(i, Math.PI, B); mix(A, B, u, O, 0.05); }
      if (mode === 'tl' && t >= T_END && k >= 0) O.p.addScaledVector(BU, Math.sin(now * 0.0021 + k * 2.1) * 0.0018);
      c.hov += ((hover === i ? 1 : 0) - c.hov) * Math.min(1, dt * 14);
      if (c.hov > 0.001) O.p.addScaledVector(BF, -0.03 * c.hov).addScaledVector(BU, 0.006 * c.hov);
      c.g.position.copy(O.p); c.g.quaternion.copy(O.q); c.uf.value = O.b; c.ub.value = -O.b;
    }
    if (mode === 'gather' && gk > (N - 1) * 0.012 + 0.55) {
      mode = 'tl'; t = 0; shuffleFaces(); hand = null;
      if (autoPlay) { autoPlay = false; playing = true; }
    }
    if (mode === 'unreveal' && gk > 0.62) { mode = 'tl'; t = T_END; }
    root.classList.toggle('rv', mode === 'reveal' || mode === 'unreveal');
    front.intensity = mode === 'reveal' ? 0.7 * sm(rv.t / 0.6) : 0;
    const showHint = idle0() && !reading;
    hint.classList.toggle('hide', !showHint);
    if (showHint) { hv.set(HOME.x, 0.03, HOME.z - 0.045); place(hint, hv, 8); }
    const holding = mode === 'tl' && playing && t >= HOLD - 0.001 && !hand;
    wait.textContent = waitErr ? '판을 찾지 못했어요 · 덱을 눌러 다시' : '판 고르는 중';
    wait.classList.toggle('hide', !(holding || waitErr));
    if (waitErr && playing) { playing = false; gather(false); }
    if (holding || waitErr) { hv.set(-0.05, 0.05, ZS); place(wait, hv, 0); }
    const show3 = ready3() && hand;
    slotTips.forEach((el, k) => {
      el.classList.toggle('hide', !show3);
      if (show3) { el.innerHTML = `${hand[k].slotName}<small>${k + 1}</small>`; slotP(k, O, 0); hv.copy(O.p).addScaledVector(BU, HC * 0.6); place(el, hv, 4); }
    });
    ember.material.color.setHSL(0.06, 1, 0.5 + Math.sin(now * 0.003) * 0.06);
    R.render(scene, cam);
    // 가만히 있을 때(처음 덱·세 장 대기)는 초당 20번, 움직일 땐 매 프레임
    const calm = (idle0() || ready3()) && hover < 0 && cards.every((c) => c.hov < 0.01);
    if (calm) setTimeout(() => { if (running && !raf) raf = requestAnimationFrame(frame); }, 45); else raf = requestAnimationFrame(frame);
  }

  api = {
    show() {
      host.hidden = false; document.body.classList.add('digon');
      if (window.Deck3D && Deck3D.suspend) Deck3D.suspend(true);
      requestAnimationFrame(() => root.classList.add('on'));
      running = true; fit(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
      addEventListener('keydown', onKey);
      cv.focus({ preventScroll: true });
      if (!loggedIn()) { say('Spotify 로그인 후 내 취향을 읽어요'); needLogin(); return; }
      msg.classList.add('hide');
      ensureTaste().then(() => prep().catch((e) => { waitErr = e; })).catch(() => {});
    },
    hide() {
      root.classList.remove('on'); removeEventListener('keydown', onKey);
      setTimeout(() => {
        host.hidden = true; running = false; document.body.classList.remove('digon');
        if (window.Deck3D && Deck3D.suspend) Deck3D.suspend(false);
      }, 300);
    },
  };
}
export { SLOTS, BY_ID };
