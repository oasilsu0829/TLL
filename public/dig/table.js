// T/L/L 디깅 — 턴테이블 장면(deck3d.js) 안의 카드덱(2026-11-26 사용자 요청: 'DIG 버튼 없애고 온더락·시가 옆에 카드덱, LP 화면에서 카메라를 옮겨 거기서')
// 덱은 재떨이 왼쪽 앞 바닥에 놓여 있다. 누르면 카메라가 턴테이블 앞으로 내려오고, 사용자 시안 그대로 섞음 → 펼침 → 웨이브 → 세 장 → 고른 카드가 앨범으로
// 카드 그림: 뒷면은 고전 트럼프(바이시클 같은) 모양(흰 테두리 + 빨간 바탕 고운 무늬, 점대칭), 앞면은 시안 그대로 색 바탕 트럼프(뽑힌 카드는 앨범 표지 색 + 장르 띠)
// 좌표: 시안의 미터 단위를 그대로 쓰고, 묶음 G(위치 P0, 배율 K3)로 장면에 놓는다. 카메라도 G 안 좌표로 계산해 장면 좌표로 바꾼다
// 불빛(digSpot·digFront)은 deck3d가 처음부터 장면에 둔 것을 받아 세기만 바꾼다(불빛 수가 바뀌면 모든 셰이더를 다시 만들어 폰이 멈춤)
import * as THREE from '/3d/three.module.min.js';

const LSG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const cl = (x) => Math.min(1, Math.max(0, x));
const eio = (x) => (1 - Math.cos(Math.PI * x)) / 2;
const eOut = (x) => 1 - (1 - x) ** 3;
const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
const V3 = THREE.Vector3, Q = THREE.Quaternion;

// ── 시안 치수(미터)·타임라인(초)
const N = 36, W = 0.063, HC = 0.088, TH = 0.00042;
const HOME = new V3(0.2, 0.0011, -0.07);
const S = new V3(0.17, 0.12, 0.035), TG = new V3(-0.13, 0.12, 0.035);
const X0 = -0.27, STEP = 0.0125, ZS = 0.085, YB = 0.0004, KK = STEP / W, BOW = 0.011;
const GAP = 0.0165, FLY = 0.34, P1 = 0.5, P2 = 1.5;
const SQ0 = 2.45, SQ1 = 2.97, SP1 = 3.6, W0 = 3.62, WD = 1.75, FL0 = 5.45, FG = 0.17, FD = 0.8, NP = 4, T_END = FL0 + (NP - 1) * FG + FD + 0.02; // 네 장(2026-11-26)
const HOLD = SP1 - 0.02; // 판이 아직이면 펼친 채(뒤집기 전) 여기서 기다림: 뽑힐 카드 앞면을 앨범 색으로 바꿔 둬야 해서
const C0 = -10, C1 = N - 1 + 10;
const LOOK = new V3(-0.02, 0.02, -0.02);

// ── 카드 그림(바이시클 같은 고전 트럼프)
const CW = 400, CH = Math.round(CW * HC / W);
const RED = '#c4122f', INK = '#141414', BACKC = '#b0182a';
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SERIF = 'Georgia, "Times New Roman", "Noto Serif KR", serif';
function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 무늬 0 스페이드 · 1 하트 · 2 다이아 · 3 클럽. 크기 z = 대략 폭(px)
function pip(g, s, x, y, z, flip) {
  g.save(); g.translate(x, y); if (flip) g.rotate(Math.PI); g.scale(z / 100, z / 100); g.beginPath();
  if (s === 1) { g.moveTo(0, 40); g.bezierCurveTo(-12, 26, -52, 4, -50, -22); g.bezierCurveTo(-48, -48, -12, -54, 0, -26); g.bezierCurveTo(12, -54, 48, -48, 50, -22); g.bezierCurveTo(52, 4, 12, 26, 0, 40); }
  else if (s === 2) { g.moveTo(0, -50); g.quadraticCurveTo(18, -22, 38, 0); g.quadraticCurveTo(18, 22, 0, 50); g.quadraticCurveTo(-18, 22, -38, 0); g.quadraticCurveTo(-18, -22, 0, -50); }
  else if (s === 0) { g.moveTo(0, -50); g.bezierCurveTo(12, -24, 52, -6, 50, 18); g.bezierCurveTo(48, 40, 16, 42, 4, 24); g.quadraticCurveTo(8, 40, 20, 50); g.lineTo(-20, 50); g.quadraticCurveTo(-8, 40, -4, 24); g.bezierCurveTo(-16, 42, -48, 40, -50, 18); g.bezierCurveTo(-52, -6, -12, -24, 0, -50); }
  else { g.arc(0, -24, 22, 0, Math.PI * 2); g.moveTo(-2, 10); g.arc(-24, 10, 22, 0, Math.PI * 2); g.moveTo(46, 10); g.arc(24, 10, 22, 0, Math.PI * 2); g.moveTo(-5, 8); g.quadraticCurveTo(-4, 38, -18, 50); g.lineTo(18, 50); g.quadraticCurveTo(4, 38, 5, 8); }
  g.closePath(); g.fill(); g.restore();
}
function blank() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  rr(g, 0, 0, CW, CH, 26); g.fillStyle = '#fbfaf6'; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; rr(g, 1, 1, CW - 2, CH - 2, 25); g.stroke();
  return [c, g];
}
// 앞면(2026-11-26 사용자 '숫자·기호 있는 쪽은 전 게 더 좋았음' → 시안 앞면으로 되돌림): 색 바탕 + 같은 색 계열 무늬·숫자, 안쪽 가는 테.
// 장식 카드는 팔레트 18개, 뽑힌 네 장은 그 앨범 표지 색 + 아래 장르 띠
const FW = 320, FH = Math.round(320 * HC / W);
const PAL = [['#1f3b4d', '#e8c46a', '#d9572b'], ['#f1e4cf', '#203a2f', '#c94f3d'], ['#0f1c3f', '#7fb3d5', '#f3d9b1'], ['#3b1d3e', '#ee8a6a', '#f6d7a7'],
  ['#e4ded0', '#111111', '#e23b2e'], ['#123024', '#9fcf8a', '#f2efe0'], ['#2a2a2a', '#f5a524', '#e9e4da'], ['#6b2737', '#f0c9a0', '#2d2a32'],
  ['#d6e4e1', '#2f5d62', '#e07a5f'], ['#141414', '#5cc8c0', '#ff5d8f'], ['#f4c95d', '#1b2a41', '#e8e2d2'], ['#2e1f17', '#c98b4b', '#efe1c6'],
  ['#b9d7ea', '#14213d', '#fca311'], ['#40263c', '#9ee6cf', '#ffd6e0'], ['#f6f1e7', '#2b59c3', '#f25c54'], ['#1c2b2d', '#e9b872', '#f7f3e3'],
  ['#ff6b4a', '#1a1423', '#fff1d6'], ['#2d3047', '#e0a458', '#93b7be']];
const lum = (h) => { const n = parseInt(h.slice(1), 16), f = (v) => { v /= 255; return v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
const con = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function faceOf(p, rank, suit) {
  const [bg, a1, a2] = p, el0 = con(bg, a1) >= con(bg, a2) ? a1 : a2;
  const el = con(bg, el0) < 2.2 ? (lum(bg) > 0.3 ? '#14100c' : '#f6f1e7') : el0;
  return { bg, el, acc: el0 === a1 ? a2 : a1, rank, suit };
}
const SPIPS = { 2: [[0.5, 0.18], [0.5, 0.82]], 3: [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]], 4: [[0.3, 0.18], [0.7, 0.18], [0.3, 0.82], [0.7, 0.82]] };
SPIPS[5] = [...SPIPS[4], [0.5, 0.5]]; SPIPS[6] = [...SPIPS[4], [0.3, 0.5], [0.7, 0.5]]; SPIPS[7] = [...SPIPS[6], [0.5, 0.34]]; SPIPS[8] = [...SPIPS[7], [0.5, 0.66]];
SPIPS[9] = [[0.3, 0.18], [0.7, 0.18], [0.3, 0.39], [0.7, 0.39], [0.3, 0.61], [0.7, 0.61], [0.3, 0.82], [0.7, 0.82], [0.5, 0.5]]; SPIPS[10] = [...SPIPS[9].slice(0, 8), [0.5, 0.29], [0.5, 0.71]];
function colorFace(a, tag) {
  const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d');
  rr(g, 0, 0, FW, FH, 22); g.fillStyle = a.bg; g.fill();
  g.strokeStyle = a.acc; g.globalAlpha = 0.55; g.lineWidth = 2; rr(g, 10, 10, FW - 20, FH - 20, 15); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = a.el;
  const idx = () => { g.font = `bold ${a.rank === '10' ? 38 : 44}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(a.rank, 38, 20); pip(g, a.suit, 38, 90, 30); };
  idx(); g.save(); g.translate(FW, FH); g.rotate(Math.PI); idx(); g.restore();
  const bx = 70, by = 64, bw = FW - 140, bh = FH - 128;
  if (a.rank === 'A') { pip(g, a.suit, FW / 2, FH / 2, 130); g.strokeStyle = a.acc; g.lineWidth = 2; g.beginPath(); g.arc(FW / 2, FH / 2, 92, 0, 7); g.stroke(); }
  else if ('JQK'.includes(a.rank)) {
    g.fillStyle = a.acc; g.globalAlpha = 0.9; rr(g, bx, by, bw, bh, 10); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = a.el; g.lineWidth = 3; rr(g, bx + 8, by + 8, bw - 16, bh - 16, 6); g.stroke();
    g.fillStyle = a.el; g.font = `bold 120px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.rank, FW / 2, FH / 2 + 6);
    pip(g, a.suit, FW / 2, by + 44, 42); pip(g, a.suit, FW / 2, by + bh - 44, 42, true);
  } else {
    for (const [px, py] of SPIPS[+a.rank]) pip(g, a.suit, bx + px * bw, by + py * bh, 52, py > 0.55);
  }
  if (tag) {
    g.fillStyle = a.el; g.globalAlpha = 0.92; rr(g, 46, FH - 60, FW - 92, 30, 15); g.fill(); g.globalAlpha = 1;
    g.fillStyle = a.bg; g.font = '600 17px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let t = tag; while (g.measureText(t).width > FW - 120 && t.length > 2) t = t.slice(0, -2) + '…';
    g.fillText(t, FW / 2, FH - 45);
  }
  return c;
}
// 뒷면: 흰 테두리 + 빨간 바탕에 흰 실선 무늬(소용돌이 격자 · 이중 테 · 가운데 메달), 180도 돌려도 같은 점대칭
function backCanvas() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  rr(g, 0, 0, CW, CH, 26); g.fillStyle = '#fbfaf6'; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; rr(g, 1, 1, CW - 2, CH - 2, 25); g.stroke();
  const m = 22, fx = m, fy = m, fw = CW - m * 2, fh = CH - m * 2;
  g.fillStyle = BACKC; rr(g, fx, fy, fw, fh, 10); g.fill();
  g.save(); rr(g, fx, fy, fw, fh, 10); g.clip();
  // 격자 소용돌이: 칸마다 네 잎 장미 곡선 + 이어지는 원
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.1;
  const cs = 26;
  for (let y = fy - cs; y < fy + fh + cs; y += cs) for (let x = fx - cs; x < fx + fw + cs; x += cs) {
    const ox = ((y - fy) / cs) % 2 ? cs / 2 : 0;
    g.beginPath();
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, r = 10 * Math.cos(2 * a); const px = x + ox + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    g.beginPath(); g.arc(x + ox, y, 12.5, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  // 이중 테
  g.strokeStyle = '#fff'; g.lineWidth = 3; rr(g, fx + 8, fy + 8, fw - 16, fh - 16, 7); g.stroke();
  g.lineWidth = 1.2; rr(g, fx + 14, fy + 14, fw - 28, fh - 28, 5); g.stroke();
  // 네 모서리 소용돌이 장식(점대칭)
  const corner = () => {
    g.save(); g.translate(fx + 14, fy + 14);
    g.fillStyle = BACKC; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI / 2); g.lineTo(0, 0); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.6;
    for (const r of [34, 26]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI / 2); g.stroke(); }
    g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 3, r = 4 + a * 3.2; const px = 18 + Math.cos(a) * r * 0.5, py = 18 + Math.sin(a) * r * 0.5; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    g.restore();
  };
  for (let k = 0; k < 4; k++) { g.save(); g.translate(CW / 2, CH / 2); g.rotate(k * Math.PI / 2 * (k % 2 ? 1 : 1)); g.scale(k === 1 || k === 3 ? -1 : 1, k >= 2 ? -1 : 1); g.translate(-CW / 2, -CH / 2); corner(); g.restore(); }
  // 가운데 메달: 타원 + 판(동심원) + 위아래 날개 소용돌이
  const cx = CW / 2, cy = CH / 2;
  g.fillStyle = BACKC; g.beginPath(); g.ellipse(cx, cy, 82, 104, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, 82, 104, 0, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, 74, 96, 0, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 78, cy + Math.sin(a) * 100, 1.8, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = BACKC; g.beginPath(); g.arc(cx, cy, 49, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
  for (let r = 18; r < 47; r += 3.4) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = BACKC; g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
  for (const sg of [1, -1]) { // 날개
    g.strokeStyle = '#fff'; g.lineWidth = 1.6;
    for (const sx of [1, -1]) { g.beginPath(); for (let i = 0; i <= 50; i++) { const a = i / 50 * Math.PI * 2.4, r = 3 + a * 4.2; const px = cx + sx * (16 + Math.cos(a) * r), py = cy + sg * (70 + Math.sin(a) * r * 0.55); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
    pip(Object.assign(g, { fillStyle: '#fff' }), 0, cx, cy + sg * 72, 18, sg < 0);
  }
  return c;
}

export function createDigTable({ deck, scene, cam, renderer, lights, onState }) {
  const K3 = 3.0, P0 = new V3(0.12, -0.196, 1.07); // 덱(HOME)이 재떨이 왼쪽 앞 (0.72, 0.86)에 오게
  const G = new THREE.Group(); G.position.copy(P0); G.scale.setScalar(K3); deck.add(G);
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const BACK = tex(backCanvas());
  let FACES = null; // 처음 펼칠 때 만든다(52장 중 36장)
  const blankT = tex(blank()[0]);
  const HH = (HC / 2).toFixed(5);
  function bendMat(map, u) {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.42, alphaTest: 0.5 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uBend = u; sh.vertexShader = 'uniform float uBend;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat yy = position.y / ${HH};\ntransformed.z += uBend * (1.0 - yy * yy);`); };
    m.customProgramCacheKey = () => 'digbend';
    return m;
  }
  const geo = new THREE.PlaneGeometry(W, HC, 2, 16);
  const cards = [], hits = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(), uf = { value: 0 }, ub = { value: 0 };
    const f = new THREE.Mesh(geo, bendMat(blankT, uf)), b = new THREE.Mesh(geo, bendMat(BACK, ub));
    b.rotation.y = Math.PI; f.castShadow = b.castShadow = true; f.receiveShadow = b.receiveShadow = true;
    f.userData.i = b.userData.i = i; g.add(f, b); G.add(g); hits.push(f, b);
    cards.push({ g, f, uf, ub, hov: 0, face: blankT });
  }
  // 덱을 누르는 자리(보이지 않는 상자). deck3d의 clickables에 들어가 act 'dig'
  const pileHit = new THREE.Mesh(new THREE.BoxGeometry(W * 1.3, 0.03, HC * 1.3), new THREE.MeshBasicMaterial({ visible: false }));
  pileHit.position.set(HOME.x, 0.012, HOME.z); pileHit.rotation.y = 0.3; pileHit.userData.act = 'dig'; pileHit.userData.ns = true; G.add(pileHit);
  const JIT = Array.from({ length: N }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
  let picks = [0, 0, 0];
  const setMap = (c, t) => { if (c.f.material.map !== t) { c.f.material.map = t; c.f.material.needsUpdate = true; } };
  function shuffleFaces() {
    if (!FACES) FACES = PAL.map((p, i) => tex(colorFace(faceOf(p, RANKS[(i * 7 + 3) % 13], (i * 3 + Math.floor(i / 13)) % 4))));
    const perm = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    cards.forEach((c, i) => { c.face = FACES[perm[i] % FACES.length]; setMap(c, c.face); });
    picks = [3 + Math.floor(Math.random() * 6), 11 + Math.floor(Math.random() * 6), 19 + Math.floor(Math.random() * 6), 27 + Math.floor(Math.random() * 6)];
  }

  // ── 자세(시안 그대로, 덱 자리만 살짝 돌림)
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
  const qAx = (a, t) => new Q().setFromAxisAngle(a, t);
  const qDown = qAx(AY, Math.PI).multiply(qAx(AX, Math.PI / 2));
  const qHome = qAx(AY, 0.3).multiply(qDown);
  const qStream = qAx(AY, Math.PI + 0.96);
  const nL = new V3(0, 0, 1).applyQuaternion(qStream);
  const mk = () => ({ p: new V3(), q: new Q(), b: 0 });
  const A = mk(), B = mk(), qT = new Q(), qT2 = new Q(), vT = new V3();
  const homeP = (i, o) => { o.p.set(HOME.x + JIT[i][0] * 0.0006, HOME.y + (N - 1 - i) * TH, HOME.z + JIT[i][1] * 0.0006); o.q.copy(qHome); o.b = 0; return o; };
  const srcP = (i, o) => { o.p.copy(S).addScaledVector(nL, ((N - 1) / 2 - i) * TH * 1.8); o.q.copy(qStream); o.b = BOW; return o; };
  const tgtP = (i, o) => { o.p.copy(TG).addScaledVector(nL, ((N - 1) / 2 - i) * TH * 1.8); o.q.copy(qStream); o.b = 0; return o; };
  const flatP = (i, o) => { o.p.set(X0, YB + i * TH, ZS); o.q.copy(qDown); o.b = 0; return o; };
  function mix(a, b, u, o, arc) { o.p.lerpVectors(a.p, b.p, u); o.p.y += arc * Math.sin(Math.PI * u); o.q.slerpQuaternions(a.q, b.q, u); o.b = a.b + (b.b - a.b) * u; return o; }
  function waveP(j, phi, o) {
    const r = X0 + j * STEP + W / 2, q = sm(phi / Math.PI);
    o.p.set(r - (W / 2) * Math.cos(phi), YB + (W / 2) * Math.sin(phi) + TH * (j * (1 - q) + (N - 1 - j) * q), ZS);
    qT.setFromAxisAngle(AZ, -phi); o.q.copy(qT).multiply(qDown); o.b = 0; return o;
  }
  const chR = (p) => p - Math.asin(KK * Math.sin(p));
  const chL = (p) => { let x = p; for (let k = 0; k < 5; k++) x = p + Math.asin(KK * Math.sin(x)); return x; };
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
  // 디깅 카메라(G 안 좌표): 시안의 fit() 그대로
  const BP = new V3(), BQ = new Q(), BR = new V3(), BU = new V3(), BF = new V3();
  let narrow = false;
  function camPt(x, y, d, o) { return o.copy(BP).addScaledVector(BR, x).addScaledVector(BU, y).addScaledVector(BF, d); }
  function slotP(k, o, bob) {
    const d = Math.max(0.5, 0.152 / (Math.tan(Math.PI / 12) * cam.aspect)), th = Math.tan(Math.PI / 12) * d, m = k - (NP - 1) / 2;
    camPt(m * 0.071, -th * 0.08 - Math.abs(m) * 0.004 + (bob || 0), d, o.p);
    o.q.copy(BQ).multiply(qT.setFromAxisAngle(AX, -0.12)).multiply(qT2.setFromAxisAngle(AZ, m * -0.05)); o.b = 0; return o;
  }
  function revP(o) {
    const d = narrow ? 0.27 : 0.3, th = Math.tan(Math.PI / 12) * d;
    camPt(narrow ? 0 : -th * cam.aspect * 0.42, narrow ? th * 0.06 : th * 0.02, d, o.p);
    o.q.copy(BQ); o.b = 0; return o;
  }
  const _o = new THREE.PerspectiveCamera(); // lookAt은 카메라여야 -Z로 본다
  function fit() {
    const th = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const d = Math.max(0.29 / th, 0.33 / (th * cam.aspect)) * 0.96, el = THREE.MathUtils.degToRad(50);
    BP.set(LOOK.x, LOOK.y + d * Math.sin(el), LOOK.z + d * Math.cos(el));
    _o.position.copy(BP); _o.lookAt(LOOK.x, LOOK.y - 0.025, LOOK.z); BQ.copy(_o.quaternion);
    BR.set(1, 0, 0).applyQuaternion(BQ); BU.set(0, 1, 0).applyQuaternion(BQ); BF.set(0, 0, -1).applyQuaternion(BQ);
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

  // ── 소리(설정 효과음을 따름)
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
  for (let k = 0; k < NP; k++) EV.push([FL0 + k * FG + 0.01, 'flick'], [FL0 + k * FG + FD - 0.02, 'tick']);
  EV.sort((a, b) => a[0] - b[0]);

  // ── 화면 글자(2026-11-26 정리: 위 도구줄 하나 + 고르기 창 하나 + 정보 창). 캔버스 위에 겹치는 Shadow DOM
  const IC = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    re: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    nope: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M10 6l-6 6 6 6M4 12h16"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/></svg>',
  };
  const ui = (() => {
    const h = document.createElement('div'); h.id = 'digUi'; h.hidden = true; document.body.append(h);
    const sh = h.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>
:host{all:initial}
.L{position:fixed;inset:0;pointer-events:none;z-index:60;font:15px/1.5 "Noto Sans KR",system-ui,sans-serif;color:#efe7da;--line:rgba(239,231,218,.14);--dim:#a99d8d;--brass:#d9bb7e;--acc:#d9bb7e;--accInk:#14100c;--glass:rgba(15,11,9,.82);-webkit-tap-highlight-color:transparent}
*{box-sizing:border-box;min-width:0}
button,input{font:inherit;color:inherit}
button{background:none;border:0;cursor:pointer;pointer-events:auto}
button:focus-visible,input:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.hide{opacity:0!important;pointer-events:none!important}
/* 도구줄 */
.tb{position:fixed;display:flex;align-items:center;gap:2px;padding:4px;background:var(--glass);border:1px solid var(--line);border-radius:14px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:opacity .3s;pointer-events:auto}
.tb>button{height:40px;min-width:40px;border-radius:10px;display:grid;place-items:center;color:#d8cfc2}
.tb>button:hover{background:rgba(255,255,255,.06)}
.seg{display:flex;background:rgba(255,255,255,.06);border-radius:10px;padding:2px;margin:0 2px}
.seg button{height:36px;padding:0 12px;border-radius:8px;font-size:14px;color:#cfc5b7;white-space:nowrap}
.seg button[aria-pressed=true]{background:#efe7da;color:#14100c;font-weight:700}
.tb .opt{display:flex;align-items:center;gap:6px;padding:0 10px;font-size:14px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb .opt img{width:24px;height:24px;border-radius:4px;object-fit:cover}
.tb .opt span{overflow:hidden;text-overflow:ellipsis}
.cap{position:fixed;margin:0;font-size:12.5px;color:#cfc5b7;background:rgba(15,11,9,.66);border-radius:999px;padding:3px 10px;width:max-content;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .3s}
.cap b{color:#efe7da;font-weight:600}
.tip{position:fixed;left:0;top:0;transform:translate(-50%,-100%);background:var(--glass);border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:13px;white-space:nowrap;transition:opacity .25s}
.tip.slot{color:var(--brass)}
.tip.slot.out{color:#9fd3ff}
.tip.slot small{color:var(--dim);margin-left:6px;font-size:12px}
/* 창 공통 */
.pan{position:fixed;overflow:auto;overscroll-behavior:contain;opacity:0;transform:translateX(20px);pointer-events:none;background:var(--glass);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line);border-radius:18px;padding:18px;transition:opacity .3s,transform .4s cubic-bezier(.2,.9,.2,1.1)}
.pan.on{opacity:1;transform:none;pointer-events:auto}
.pan.sheet{left:8px;right:8px;bottom:8px;max-height:62vh;transform:translateY(20px);border-radius:18px 18px 14px 14px}
.pan.sheet.on{transform:none}
.pan h3{margin:0;font-size:17px;font-weight:700}
.pan .hint{margin:2px 0 12px;color:var(--dim);font-size:13px;word-break:keep-all}
.pan h4{margin:14px 0 6px;font-size:12px;letter-spacing:.04em;color:var(--dim);font-weight:500}
.field{display:flex;gap:6px;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:12px;padding:4px 4px 4px 12px}
.field input{flex:1;background:none;border:0;outline:none;height:38px;font-size:15px}
.field button{padding:0 12px;border-radius:9px;background:rgba(255,255,255,.08);font-size:14px}
.chs{display:flex;flex-wrap:wrap;gap:6px}
.chs button{height:32px;padding:0 11px;border-radius:999px;font-size:13.5px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:#ddd3c6}
.chs button[aria-pressed=true]{background:#efe7da;color:#14100c;border-color:#efe7da;font-weight:700}
.chs.sel button{background:var(--brass);color:#14100c;border-color:var(--brass);font-weight:700}
.chs.sel button::after{content:"×";margin-left:6px;opacity:.6}
.chs .more{border-style:dashed}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px}
.grid button{display:grid;gap:4px;text-align:left;font-size:11.5px;color:#cfc5b7;padding:0;border-radius:10px}
.grid img,.grid i{width:100%;aspect-ratio:1;border-radius:8px;object-fit:cover;background:#2a221c;display:block;outline:2px solid transparent;outline-offset:2px}
.grid button[aria-pressed=true] img,.grid button[aria-pressed=true] i{outline-color:var(--brass)}
.grid span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.warn{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:rgba(255,190,120,.1);color:#f1c48f;font-size:13px;word-break:keep-all}
.go{display:flex;gap:8px;margin-top:16px}
.go button{height:44px;border-radius:12px;padding:0 16px;background:rgba(255,255,255,.08);font-size:15px}
.go .main{flex:1;background:#efe7da;color:#14100c;font-weight:700}
.go .main:disabled{opacity:.4;cursor:default}
/* 정보 창 */
#info{border-top:3px solid var(--acc)}
.ih{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.slotc{font-size:12px;color:var(--dim);letter-spacing:.03em}
.chip{background:var(--acc);color:var(--accInk);font-size:12.5px;font-weight:700;padding:2px 9px;border-radius:999px}
h2{font-size:clamp(21px,2.3vw,28px);line-height:1.18;margin:8px 0 2px;font-weight:700;word-break:keep-all}
.meta{margin:0;color:#d8cfc2;font-size:14.5px}
.why{margin:10px 0 0;font-size:14px;color:#cfc5b7;word-break:keep-all}
.why small{display:block;color:var(--dim);font-size:12.5px;margin-top:2px}
.play{margin-top:14px;width:100%;height:46px;border-radius:12px;background:var(--acc);color:var(--accInk);font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px}
.acts{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px}
.acts button{display:grid;justify-items:center;gap:2px;padding:8px 0 6px;border-radius:10px;font-size:11.5px;color:#cfc5b7}
.acts button:hover{background:rgba(255,255,255,.06)}
.acts button[aria-pressed=true]{color:var(--acc)}
.acts button[aria-pressed=true] svg{fill:currentColor;fill-opacity:.25}
details{margin-top:10px;border-top:1px solid var(--line)}
summary{cursor:pointer;list-style:none;padding:10px 0 4px;font-size:13px;color:var(--dim);pointer-events:auto}
summary::after{content:" ▾"}
details[open] summary::after{content:" ▴"}
ol{list-style:none;margin:0;padding:0;counter-reset:n}
li{counter-increment:n;display:grid;grid-template-columns:1.8em minmax(0,1fr) auto;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;cursor:pointer}
li::before{content:counter(n);color:var(--dim);font-variant-numeric:tabular-nums}
li span:nth-child(1){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
li span:last-child{color:var(--dim);font-variant-numeric:tabular-nums}
li:hover span:nth-child(1){color:var(--acc)}
@media (prefers-reduced-motion:reduce){.pan{transition:none}}
</style>
<div class="L">
<div class="tb" id="tb">
  <button id="x" aria-label="디깅 닫기" title="닫기">${IC.x}</button>
  <div class="seg" role="group" aria-label="고르는 방식"><button data-m="taste" aria-pressed="true">취향</button><button data-m="tag" aria-pressed="false">태그</button><button data-m="seed" aria-pressed="false">씨앗</button></div>
  <button class="opt" id="opt" title="이 방식의 설정"></button>
</div>
<p class="cap" id="sub"></p>
<div class="tip hide" id="wait">판 고르는 중</div>
<div class="tip slot hide" id="s0"></div><div class="tip slot hide" id="s1"></div><div class="tip slot hide" id="s2"></div><div class="tip slot hide" id="s3"></div>
<aside class="pan" id="pan" aria-label="디깅 설정"></aside>
<aside class="pan" id="info" aria-live="polite">
  <div class="ih"><span class="chip" id="iG"></span><span class="slotc" id="iSl"></span></div>
  <h2 id="iT"></h2><p class="meta" id="iA"></p>
  <p class="why" id="iW"></p>
  <button class="play" id="play">${IC.play}턴테이블에 올리기</button>
  <div class="acts">
    <button id="like" aria-pressed="false">${IC.heart}좋아요</button><button id="nope" aria-pressed="false">${IC.nope}별로</button>
    <button id="keep" aria-pressed="false">${IC.plus}<span id="keepL">담기</span></button><button id="again">${IC.re}다시 섞기</button><button id="other">${IC.back}다른 카드</button>
  </div>
  <details id="tk"><summary id="iS"></summary><ol id="iL"></ol></details>
</aside>
</div>`;
    const $ = (s) => sh.querySelector(s);
    return { h, $, L: $('.L') };
  })();
  const $ = ui.$;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── 데이터(data.js는 처음 쓸 때 불러옴)
  let gen = 0, D = null, P = null, prepP = null, next = null, hand = null, waitErr = null, reading = false;
  const data = () => (D ? Promise.resolve(D) : import('./data.js').then((m) => (D = m)));
  const C = () => window.MusicCore;
  const say = (h) => { $('#sub').innerHTML = h; };
  // 고르는 방식(기기마다): taste 취향 · tag 태그 · seed 씨앗
  const cfg = Object.assign({ mode: 'taste', tags: [], dec: [], seed: null }, LSG('dig.cfg', {}));
  const saveCfg = () => { try { localStorage.setItem('dig.cfg', JSON.stringify(cfg)); } catch {} };
  async function ensureTaste(force) {
    const m = await data();
    if (P && !force) return P;
    reading = true;
    try { P = await m.readTaste(force, (s) => say(s)); } catch { P = m.buildProfile([]); }
    reading = false; paintMode();
    return P;
  }
  function paintMode() {
    ui.h.shadowRoot.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === cfg.mode));
    const opt = $('#opt');
    if (cfg.mode === 'taste') { opt.innerHTML = `${IC.re}`; opt.title = '최근 듣는 아티스트로 취향 다시 읽기'; opt.setAttribute('aria-label', opt.title); }
    else if (cfg.mode === 'tag') { opt.innerHTML = `<span>${cfg.tags.length ? esc(cfg.tags.slice(0, 2).join(', ')) + (cfg.tags.length > 2 ? ` 외 ${cfg.tags.length - 2}` : '') : '태그 고르기'}</span>`; opt.title = '태그 고르기'; opt.setAttribute('aria-label', '태그 고르기'); }
    else { opt.innerHTML = cfg.seed ? `${cfg.seed.img ? `<img src="${esc(cfg.seed.img)}" alt="">` : ''}<span>${esc(cfg.seed.artist)}</span>` : '<span>씨앗 고르기</span>'; opt.title = '씨앗 고르기'; opt.setAttribute('aria-label', '씨앗 고르기'); }
    const dec = cfg.dec.length ? ' · ' + cfg.dec.map((d) => `${String(d).slice(2)}년대`).join('·') : '';
    if (reading) return;
    if (cfg.mode === 'taste') { const H = P && D ? D.homeNames(P, 3) : []; say(H.length ? `내 동네 <b>${esc(H.join(' · '))}</b> 근처 세 장 + 아주 먼 한 장` : '취향 근처 세 장 + 아주 먼 한 장'); }
    else if (cfg.mode === 'tag') say(cfg.tags.length ? `<b>${esc(cfg.tags.join(' · '))}</b>${dec} 인기 판 세 장 + 아주 먼 한 장` : '태그를 골라 주세요');
    else say(cfg.seed ? `<b>${esc(cfg.seed.artist)}</b>에서 한두 다리 건너간 세 장 + 아주 먼 한 장` : '씨앗(출발 판)을 골라 주세요');
  }
  const ready = () => (cfg.mode === 'tag' ? cfg.tags.length > 0 : cfg.mode === 'seed' ? !!cfg.seed : true);
  function invalidate() { next = null; prepP = null; gen++; waitErr = null; }
  function reshuffle() {
    invalidate(); paintMode();
    if (!active) return;
    if (!ready()) { openPan(); return; }
    if (mode === 'reveal') { mode = 'tl'; t = T_END; }
    if (mode === 'tl' && t === 0 && !playing) { playing = true; prep().catch((e) => { waitErr = e; }); } else gather(true);
  }
  ui.h.shadowRoot.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => { if (cfg.mode === b.dataset.m) { openPan(); return; } cfg.mode = b.dataset.m; saveCfg(); closePan(); reshuffle(); }; });
  $('#opt').onclick = () => { if (cfg.mode === 'taste') reread(); else panOpen() ? closePan() : openPan(); };
  async function reread() { if (reading) return; invalidate(); await ensureTaste(true); C().toast && C().toast('취향을 다시 읽었습니다'); reshuffle(); }

  // ── 고르기 창(태그 · 씨앗)
  const panOpen = () => $('#pan').classList.contains('on');
  function closePan() { $('#pan').classList.remove('on'); }
  async function openPan() {
    await data(); hideInfo();
    if (cfg.mode === 'tag') await drawTagPan(); else if (cfg.mode === 'seed') drawSeedPan(); else return;
    $('#pan').classList.add('on');
  }
  let draftT = [], draftD = [], sugg = null;
  async function drawTagPan() {
    draftT = [...cfg.tags]; draftD = [...cfg.dec];
    const lfOk = await D.hasLf();
    if (!sugg) sugg = D.SUGGEST();
    const pan = $('#pan');
    pan.innerHTML = `<h3>태그로 디깅</h3><p class="hint">고른 태그의 실제 인기 판에서 세 장, 전혀 다른 갈래에서 한 장. 여러 개 고르면 섞어서 나와요.</p>
      <div class="field"><input id="tIn" type="search" placeholder="태그 입력 (예: ethio-jazz, city pop)" enterkeyhint="done" autocomplete="off"><button id="tAdd">더하기</button></div>
      <h4>고른 태그</h4><div class="chs sel" id="tSel"></div>
      <h4>추천</h4><div class="chs" id="tSug"></div>
      <h4>시대(발매 연도)</h4><div class="chs" id="tDec"></div>
      ${lfOk ? '' : '<p class="warn">Last.fm 키가 아직 없어 태그 디깅을 쓸 수 없어요. Cloudflare의 tll Worker에 LASTFM_KEY를 넣으면 켜집니다.</p>'}
      <div class="go"><button class="main" id="tGo">이 태그로 섞기</button><button id="pX">닫기</button></div>`;
    const add = (t) => { t = String(t || '').toLowerCase().trim().replace(/\s+/g, ' '); if (t && !draftT.includes(t) && draftT.length < 6) draftT.push(t); paintT(); };
    const paintT = () => {
      const sel = $('#tSel'); sel.innerHTML = draftT.length ? '' : '<span class="slotc">아직 없음</span>';
      for (const t of draftT) { const b = document.createElement('button'); b.textContent = t; b.title = '빼기'; b.onclick = () => { draftT = draftT.filter((x) => x !== t); paintT(); }; sel.append(b); }
      const sg = $('#tSug'); sg.innerHTML = '';
      const pool = sugg.filter((x) => !draftT.includes(x)).slice(0, 14);
      for (const t of pool) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => add(t); sg.append(b); }
      const m = document.createElement('button'); m.className = 'more'; m.textContent = '다른 추천'; m.onclick = () => { sugg = [...sugg.slice(14), ...sugg.slice(0, 14)].sort(() => Math.random() - 0.5); paintT(); }; sg.append(m);
      $('#tGo').disabled = !draftT.length || !lfOk;
    };
    const dz = $('#tDec');
    for (const d of D.DECADES) { const b = document.createElement('button'); b.textContent = `${String(d).slice(2)}년대`; const on = () => draftD.includes(d); b.setAttribute('aria-pressed', on()); b.onclick = () => { draftD = on() ? draftD.filter((x) => x !== d) : [...draftD, d]; b.setAttribute('aria-pressed', on()); }; dz.append(b); }
    $('#tIn').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(e.target.value); e.target.value = ''; } };
    $('#tAdd').onclick = () => { add($('#tIn').value); $('#tIn').value = ''; };
    $('#pX').onclick = closePan;
    $('#tGo').onclick = () => { if (!draftT.length) return; cfg.tags = draftT; cfg.dec = draftD.sort(); saveCfg(); closePan(); reshuffle(); };
    paintT();
  }
  function drawSeedPan() {
    const L = [], seenA = new Set();
    const push = (artist, name, img, label) => { const k = String(artist || '').toLowerCase(); if (!artist || seenA.has(k)) return; seenA.add(k); L.push({ artist, name, img, label }); };
    try { const it = C().state && C().state() && C().state().item; if (it && it.album) push((it.artists || it.album.artists || [])[0] && (it.artists || it.album.artists)[0].name, it.album.name, (it.album.images || [])[0] && it.album.images[0].url, '지금 듣는 판'); } catch {}
    try { for (const a of (C().crateAlbums ? C().crateAlbums() : [])) if (!a.k) push(String(a.artist || '').split(/\s*,\s*/)[0], a.name, a.img); } catch {}
    let pickS = cfg.seed;
    const pan = $('#pan');
    pan.innerHTML = `<h3>씨앗에서 디깅</h3><p class="hint">고른 판의 아티스트에서 비슷한 아티스트로 한 다리, 두 다리 건너간 곳의 판 세 장 + 전혀 다른 곳 한 장.</p>
      <div class="field"><input id="sIn" type="search" placeholder="아티스트 이름으로 시작" enterkeyhint="go" autocomplete="off"><button id="sAdd">이걸로</button></div>
      <h4>지금 듣는 판 · 크레이트</h4><div class="grid" id="sGrid"></div>
      <div class="go"><button class="main" id="sGo">이 씨앗으로 섞기</button><button id="pX">닫기</button></div>`;
    const grid = $('#sGrid');
    const paint = () => grid.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', !!pickS && L[i] && pickS.artist === L[i].artist));
    L.slice(0, 24).forEach((s) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `${s.img ? `<img src="${esc(s.img)}" alt="" loading="lazy">` : '<i></i>'}<span>${esc(s.label || s.artist)}</span>`;
      b.title = `${s.artist} · ${s.name || ''}`;
      b.onclick = () => { pickS = s; paint(); };
      grid.append(b);
    });
    if (!L.length) grid.innerHTML = '<span class="slotc">크레이트가 비어 있어요. 위에 아티스트 이름을 넣어 주세요</span>';
    paint();
    const go = () => { if (!pickS) return; cfg.seed = { artist: pickS.artist, name: pickS.name || '', img: pickS.img || '' }; saveCfg(); closePan(); reshuffle(); };
    $('#sIn').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) { pickS = { artist: v }; go(); } } };
    $('#sAdd').onclick = () => { const v = $('#sIn').value.trim(); if (v) { pickS = { artist: v }; go(); } };
    $('#sGo').onclick = go; $('#pX').onclick = closePan;
  }

  function prep() {
    if (prepP) return prepP;
    const my = ++gen, step2 = (s) => { if (my === gen && !hand) say(esc(s)); };
    const make = () => (cfg.mode === 'tag' ? D.tagHand(P, cfg.tags, cfg.dec, step2) : cfg.mode === 'seed' ? D.seedHand(P, cfg.seed.artist, step2) : D.tasteHand(P, step2));
    prepP = ensureTaste().then(() => { if (!ready()) throw Object.assign(new Error(cfg.mode === 'tag' ? '태그를 골라 주세요' : '씨앗을 골라 주세요'), { need: 1 }); return make(); })
      .then((h) => { if (my === gen) { next = h; paintMode(); } return h; }).catch((e) => { if (my === gen) prepP = null; throw e; });
    return prepP;
  }
  function takeHand() {
    if (!next) return false; hand = next; next = null; prepP = null; gen++;
    hand.forEach((h, k) => {
      if (!h.trump) h.trump = tex(colorFace(faceOf(h.pal, RANKS[Math.floor(Math.random() * 13)], Math.floor(Math.random() * 4)), h.g.name));
      cards[picks[k]].face = h.trump; setMap(cards[picks[k]], h.trump);
    });
    return true;
  }

  // ── 상태
  let active = false, camW = 0, camTarget = 0, t = 0, playing = false, mode = 'tl', gk = 0, autoPlay = false, hover = -1, startWhenReady = false, afterExit = null;
  let rv = { k: -1, j: -1, t: 0, swapped: false, half: 0, info: false, slap: false };
  const snap = Array.from({ length: N }, mk), O = mk();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loggedIn = () => C() && C().loggedIn && C().loggedIn();
  const idle0 = () => mode === 'tl' && t === 0 && !playing, ready3 = () => mode === 'tl' && t >= T_END && !playing;
  function snapAll() { cards.forEach((c, i) => { snap[i].p.copy(c.g.position); snap[i].q.copy(c.g.quaternion); snap[i].b = 0; }); }
  function gather(then, exit) {
    if (mode === 'gather') { if (exit) autoPlay = false, afterExit = afterExit || (() => {}); return; }
    hideInfo(); playing = false; autoPlay = !!then; snapAll();
    mode = 'gather'; gk = 0; SFX.shh();
    if (exit) afterExit = afterExit || (() => {});
    if (then) prep().catch((e) => { waitErr = e; });
  }
  function enter() {
    if (active) return;
    audio();
    if (!loggedIn()) { C() && C().toast && C().toast('Spotify에 로그인하면 카드를 섞을 수 있어요'); C() && C().openDlg && C().openDlg(); return; }
    active = true; camTarget = 1; waitErr = null; afterExit = null;
    fit(); shuffleFaces(); hand = null;
    ui.h.hidden = false; $('#tb').classList.remove('hide'); $('#sub').classList.remove('hide'); addEventListener('keydown', onKey);
    say('취향 읽는 중'); data().then(paintMode);
    if (!ready()) { data().then(openPan); startWhenReady = false; }
    else { prep().catch((e) => { waitErr = e; }); startWhenReady = true; } // 카메라가 거의 다 오면 시작
    onState && onState(true);
  }
  function exit(then) {
    if (!active) return;
    afterExit = then || (() => {});
    startWhenReady = false;
    if (mode === 'tl' && t === 0 && !playing) { finishExit(); return; }
    gather(false, true);
  }
  function finishExit() { camTarget = 0; hideInfo(); closePan(); slotTips.forEach((e) => e.classList.add('hide')); wait.classList.add('hide'); $('#tb').classList.add('hide'); $('#sub').classList.add('hide'); }
  const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function coverTex(h) {
    const a = h.alb, c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    rr(g, 0, 0, CW, CH, 26); g.fillStyle = '#fbfaf6'; g.fill();
    const m = 24, s = CW - m * 2;
    g.save(); g.beginPath(); g.rect(m, m, s, s); g.clip();
    if (h.im) g.drawImage(h.im, m, m, s, s); else { g.fillStyle = h.pal[0]; g.fillRect(m, m, s, s); }
    g.restore();
    const fit1 = (str, w) => { let x = str; while (g.measureText(x).width > w && x.length > 2) x = x.slice(0, -2) + '…'; return x; };
    g.fillStyle = INK; g.font = `700 30px "Noto Sans KR", ${SERIF}`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillText(fit1(a.name, s), m, m + s + 18);
    g.fillStyle = '#5d5349'; g.font = '500 21px "Noto Sans KR", sans-serif';
    g.fillText(fit1(a.artist, s - 70), m, m + s + 60);
    g.textAlign = 'right'; g.fillText(String(a.year || ''), CW - m, m + s + 60);
    g.textAlign = 'left'; h.pal.forEach((p, i) => { g.fillStyle = p; g.fillRect(m + i * 36, CH - 58, 36, 7); });
    g.fillStyle = '#857869'; g.font = '500 17px "Noto Sans KR", sans-serif'; g.textAlign = 'right';
    g.fillText(fit1(`${h.g.name} · ${a.n || a.tracks.length}곡`, s - 130), CW - m, CH - 66);
    pip(Object.assign(g, { fillStyle: RED }), 1, m + 8, CH - 30, 12); // 트럼프였던 흔적
    return tex(c);
  }
  function reveal(k) {
    const h = hand && hand[k]; if (!h) return;
    mode = 'reveal'; rv = { k, j: picks[k], t: 0, swapped: false, half: 0, info: false, slap: false };
    if (!h.cover) h.cover = coverTex(h);
    const a = h.alb;
    const acc = [...h.pal].sort((x, y) => D.con(y, '#100c09') - D.con(x, '#100c09')).find((x) => D.con(x, '#100c09') >= 3.2) || '#d9bb7e';
    ui.L.style.setProperty('--acc', acc); ui.L.style.setProperty('--accInk', D.lum(acc) > 0.3 ? '#14100c' : '#f6f1e7');
    $('#iG').textContent = h.g.name; $('#iSl').textContent = h.slotName;
    $('#iT').textContent = a.name;
    const tot = a.tracks.reduce((s, x) => s + x.ms, 0);
    $('#iA').textContent = [a.artist, a.year, `${a.tracks.length}곡 · ${Math.floor(tot / 60000)}분`].filter(Boolean).join(' · ');
    $('#iS').textContent = `곡 목록${a.label ? ' · ' + a.label : ''}`;
    $('#iW').innerHTML = esc(h.why.text) + (h.g.desc ? `<small>${esc(h.g.desc)}</small>` : '');
    $('#tk').open = !narrow;
    const ol = $('#iL'); ol.innerHTML = '';
    a.tracks.slice(0, 40).forEach((x, i) => {
      const li = document.createElement('li');
      const s1 = document.createElement('span'), s2 = document.createElement('span'); s1.textContent = x.name; s2.textContent = mmss(x.ms);
      li.append(s1, s2); li.title = '이 곡부터 듣기'; li.onclick = () => playIt(h, x.uri); ol.append(li);
    });
    $('#keepL').textContent = '담기'; $('#keep').setAttribute('aria-pressed', 'false');
    paintFb(h);
    const st = D.digState(); st.seen[D.seedKey(h.seed)] = { t: Date.now(), g: h.g.id }; D.saveState(st);
    if (reduce) rv.t = 3;
    setTimeout(() => prep().catch(() => {}), 2500);
  }
  function paintFb(h) { const v = ((D.digState().fb || {})[h.g.id] || {}).v || 0; $('#like').setAttribute('aria-pressed', v > 0); $('#nope').setAttribute('aria-pressed', v < 0); }
  function setFb(v) {
    const h = hand && hand[rv.k]; if (!h) return;
    const st = D.digState(), cur = (st.fb[h.g.id] || {}).v || 0;
    st.fb[h.g.id] = { v: cur === v ? 0 : v, u: Date.now() }; D.saveState(st);
    paintFb(h); invalidate();
  }
  const albumOf = (h) => (C().toAlbum ? C().toAlbum(h.alb.raw) : { id: h.alb.id, uri: h.alb.uri, name: h.alb.name, artist: h.alb.artist, img: h.alb.img, year: h.alb.year, n: h.alb.n });
  function playIt(h, uri) { const a = albumOf(h); exit(() => C().playAlbum(a, uri)); }
  function keep() {
    const h = hand && hand[rv.k]; if (!h || !C().addToCrate) return;
    C().addToCrate('c-dig', 'DIG', 998, albumOf(h)); C().toast && C().toast('DIG 크레이트에 담았습니다'); $('#keepL').textContent = '담음'; $('#keep').setAttribute('aria-pressed', 'true');
  }
  function hideInfo() { $('#info').classList.remove('on'); }
  function unreveal() { if (mode !== 'reveal') return; hideInfo(); snapAll(); mode = 'unreveal'; gk = 0; SFX.flick(); }
  $('#play').onclick = () => { const h = hand && hand[rv.k]; if (h) playIt(h); };
  $('#keep').onclick = keep;
  $('#like').onclick = () => setFb(1);
  $('#nope').onclick = () => setFb(-1);
  $('#again').onclick = () => { audio(); gather(true); };
  $('#other').onclick = () => { audio(); unreveal(); };
  $('#x').onclick = () => exit();
  function onKey(e) {
    if (!active) return;
    const tg = e.composedPath && e.composedPath()[0];
    if (e.key === 'Escape') { e.preventDefault(); if (panOpen()) closePan(); else if (mode === 'reveal') unreveal(); else exit(); return; }
    if (tg && (tg.tagName === 'BUTTON' || tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (ready3() && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); audio(); SFX.flick(); reveal(+e.key - 1); }
    else if (ready3() && e.code === 'Space') { e.preventDefault(); gather(true); }
  }

  // 공개: 앞으로 와서 커짐 → 탁 → 네 바퀴 돌며 앨범 표지로 → 정보
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

  // ── 누르기(디깅 중이면 deck3d가 먼저 넘겨줌)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function cardAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hits, false)[0];
    return h ? h.object.userData.i : -1;
  }
  function pointerdown(e) {
    audio(); const i = cardAt(e);
    if (ready3() && picks.includes(i)) { hover = -1; SFX.flick(); reveal(picks.indexOf(i)); return true; }
    if (idle0() && i >= 0 && camW > 0.9) { if (!ready()) { openPan(); return true; } waitErr = null; playing = true; prep().catch((er) => { waitErr = er; }); return true; } // 덱에 모인 채면 눌러서 다시 섞기
    return true; // 디깅 중엔 턴테이블 조작을 막는다
  }
  function pointermove(e) {
    const i = cardAt(e); hover = ready3() && picks.includes(i) ? i : -1;
    renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : '';
  }

  // ── 화면 글자 자리
  const wait = $('#wait'), slotTips = [$('#s0'), $('#s1'), $('#s2'), $('#s3')], hv = new V3();
  function place(el, local, dy, r) {
    hv.copy(local).multiplyScalar(K3).add(P0); deck.localToWorld(hv); hv.project(cam);
    const hw = (el.offsetWidth || 0) / 2 + 6, x = r.left + (hv.x + 1) / 2 * r.width;
    el.style.left = Math.min(r.right - hw, Math.max(r.left + hw, x)) + 'px'; el.style.top = (r.top + (1 - hv.y) / 2 * r.height - dy) + 'px';
  }
  function layoutUi(r) {
    const tb = $('#tb'); tb.style.left = (r.left + 12) + 'px'; tb.style.top = (r.top + 12) + 'px';
    const cap = $('#sub'); cap.style.left = (r.left + 16) + 'px'; cap.style.top = (r.top + 66) + 'px'; cap.style.maxWidth = (r.width - 32) + 'px';
    const sheet = innerWidth < 700 || r.width < 520;
    for (const el of [$('#info'), $('#pan')]) {
      el.classList.toggle('sheet', sheet);
      if (!sheet) { const w = Math.min(400, r.width * 0.46); Object.assign(el.style, { left: (r.right - w - 12) + 'px', top: (r.top + 12) + 'px', width: w + 'px', maxHeight: (r.height - 24) + 'px' }); }
      else Object.assign(el.style, { left: '', top: '', width: '', maxHeight: '' });
    }
    cap.classList.toggle('hide', mode === 'reveal' || (!sheet && panOpen()));
    narrow = sheet;
  }

  // ── 한 프레임. deck3d loop가 부른다
  const camPos = new V3(), camQ = new Q(), FOC = new V3().addVectors(S, TG).multiplyScalar(0.5), LK = new V3(), tmpO = new THREE.PerspectiveCamera();
  function step(dt, now) {
    if (!active && camW < 0.001) { lights.spot.intensity = 0; lights.front.intensity = 0; return; }
    camW += (camTarget - camW) * Math.min(1, dt * 2.6);
    if (camTarget === 0 && camW < 0.004) { camW = 0; active = false; ui.h.hidden = true; removeEventListener('keydown', onKey); renderer.domElement.style.cursor = ''; const f = afterExit; afterExit = null; onState && onState(false); if (f) f(); }
    if (startWhenReady && camW > 0.85 && mode === 'tl' && t === 0) { startWhenReady = false; if (reduce) { t = HOLD; playing = true; } else playing = true; }
    if (mode === 'tl' && playing) {
      const prev = t; let nt = Math.min(T_END, t + dt);
      if (!hand && nt >= HOLD && !takeHand()) nt = Math.max(t, Math.min(nt, HOLD));
      t = nt;
      for (const [et, k] of EV) if (et > prev && et <= t) SFX[k]();
      if (t >= T_END) playing = false;
    }
    if (mode === 'tl' && t >= W0) waveAt(Math.min(t, W0 + WD));
    if (mode === 'reveal') rv.t += dt;
    if (mode === 'gather' || mode === 'unreveal') gk += dt;
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
      mode = 'tl'; t = 0; hand = null;
      if (afterExit) finishExit();
      else { shuffleFaces(); if (autoPlay) { autoPlay = false; playing = true; } }
    }
    if (mode === 'unreveal' && gk > 0.62) { mode = 'tl'; t = T_END; }
    // 불빛: 디깅 자리 위 따뜻한 조명, 공개 땐 앞에서 살짝
    lights.spot.intensity = 3.2 * camW;
    const fT = mode === 'reveal' ? 0.6 + 0.4 * sm(rv.t / 0.6) : (mode === 'tl' && t > FL0) || mode === 'unreveal' ? 0.75 : 0;
    lights.front.intensity += (fT * camW - lights.front.intensity) * Math.min(1, dt * 4);
    // 화면 글자
    if (!ui.h.hidden) {
      const r = renderer.domElement.getBoundingClientRect();
      layoutUi(r);
      const holding = mode === 'tl' && playing && t >= HOLD - 0.001 && !hand;
      wait.textContent = waitErr ? (waitErr.message || '판을 찾지 못했어요') : '판 고르는 중';
      const showW = camW > 0.9 && (holding || (waitErr && mode === 'tl' && t < T_END));
      wait.classList.toggle('hide', !showW);
      if (waitErr && playing) { playing = false; gather(false); if (waitErr.need) openPan(); }
      if (showW) place(wait, hv.set(0, 0.06, ZS), 0, r);
      const show3 = ready3() && hand && camTarget === 1 && !panOpen();
      slotTips.forEach((el, k) => {
        el.classList.toggle('hide', !show3);
        if (show3) { const hk = hand[k]; el.innerHTML = narrow && hk.slot === 'in' ? `${k + 1}` : narrow ? `다른 곳<small>${k + 1}</small>` : `${hk.slotName}<small>${k + 1}</small>`; el.classList.toggle('out', hand[k].slot === 'out'); slotP(k, O, 0); place(el, O.p.addScaledVector(BU, HC * 0.6), 4, r); }
      });
    }
  }
  // 카메라: deck3d가 평소 자리를 정한 뒤 부른다. 디깅 자리(시안의 카메라, 섞는 동안은 공중의 카드 쪽으로 다가감)와 camW만큼 섞음
  function blendCam() {
    if (camW < 0.0005) return;
    const k = mode === 'tl' ? sm((t - 0.3) / 0.35) * (1 - sm((t - 2.35) / 0.45)) : 0;
    tmpO.position.copy(BP).lerp(FOC, 0.24 * k);
    LK.set(LOOK.x, LOOK.y - 0.025, LOOK.z).lerp(FOC, 0.6 * k);
    tmpO.lookAt(LK);
    camPos.copy(tmpO.position).multiplyScalar(K3).add(P0); deck.localToWorld(camPos);
    camQ.copy(tmpO.quaternion);
    const w = eio(camW);
    cam.position.lerp(camPos, w); cam.quaternion.slerp(camQ, w);
  }
  // 처음엔 덱 자리에 쌓아 둔다
  for (let i = 0; i < N; i++) { homeP(i, O); cards[i].g.position.copy(O.p); cards[i].g.quaternion.copy(O.q); }
  // 불빛 자리(장면 좌표)
  const spotAt = new V3(0.06, 0.62, 0.2).multiplyScalar(K3).add(P0), spotTo = new V3(0, 0, -0.01).multiplyScalar(K3).add(P0);
  lights.spot.position.copy(spotAt); lights.spot.target.position.copy(spotTo);
  return {
    g: G, hits: [pileHit], enter, exit, step, blendCam, pointerdown, pointermove, resize: () => { if (active) fit(); },
    active: () => active || camW > 0.001,
    lively: () => (active || camW > 0.001) && (Math.abs(camTarget - camW) > 0.002 || playing || mode !== 'tl' || hover >= 0 || cards.some((c) => c.hov > 0.01) || ready3()),
    _st: () => ({ active, camW, t, mode, playing, hand: !!hand, T_END, picks, err: waitErr && waitErr.message, cards: hand ? hand.map((h) => h.slotName + ':' + h.g.name + ':' + h.alb.artist + '/' + h.alb.name + ':' + h.alb.year) : [] }),
  };
}
