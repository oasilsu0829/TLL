// 잼 모드 카세트 라디오 — 두들(손 낙서) 2D (2026-11-22, 3D boombox.js·sea.js를 대신함)
// 캔버스 2D 하나에 다 그린다: 낚싯배 갑판 위 생선 상자(No.7)에 올린 라디오, 등불, 밧줄 사리, 뒤로 밤바다·달·별, 펭귄 p
// 낙서 느낌: 선은 펜 굵기가 화면에서 늘 같고(약 2.3px), 손으로 그은 듯 살짝 휜다(그림마다 고정, 떨리지 않음). 색은 선에서 조금 어긋난 마커 칠. 글꼴 Gaegu
// 종이 두 가지: 'paper'(흰 스케치북 + 검은 펜) · 'night'(검은 종이 + 흰 젤펜). 달을 누르면 바뀜, LS music.jamLook
// createBoombox(canvas, base) → 3D 때와 같은 모양:
//   { setTape(key), insert(key, snd), eject(snd), setDoor(open), setPlaying(on), setProgress(0~1), press(k, down), tap(k), latch(k, on),
//     setFrame(x, y, w, h 화면 비율), resize(), penguinAct('add'|'peck'|'poke'|'angry'|'cheer'), penguinState, onSfx(소리 이름), penguinAt() → {x, y, on}, tapeKey, onKey, onDoor, onPenguin, dispose() }
// 장면 좌표(단위): 무대(#jamStage) 가운데가 (0,0), 720 x 540 상자가 무대에 들어가게 S배. 라디오 중심 (-70, 20), 갑판 바닥 y 230

export const TAPES = ['mondrian', 'enso', 'jack', 'prism', 'wave', 'target', 'bauhaus', 'pastel', 'popart', 'holo', 'galaxy', 'stripes70', 'sunburst', 'marble', 'brutal', 'checker', 'memphis', 'acrylic'];
// 잼마다 다른 카세트: 잼 id로 고르고 바로 앞 잼과 겹치지 않게
export function tapeFor(id, prev) {
  let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let k = TAPES[(h >>> 0) % TAPES.length]; if (k === prev) k = TAPES[(TAPES.indexOf(k) + 1) % TAPES.length]; return k;
}

const LOOKS = {
  paper: { bg: '#f4f0e6', grain: 'rgba(90,70,40,.05)', ink: '#23211e', soft: 'rgba(35,33,30,.45)', sea: 'rgba(110,170,205,.32)', wave: '#3d73a0', sky: 'rgba(120,150,200,.10)',
    moon: '#f3d35a', star: '#23211e', deck: 'rgba(196,146,92,.42)', rail: 'rgba(160,110,70,.55)', body: 'rgba(170,182,196,.55)', dark: '#2c2b2a', key: '#fbfaf6',
    glow: 'rgba(255,214,90,.42)', red: '#d8432f', crate: 'rgba(206,168,112,.55)', back: '#25272c', belly: '#fbf8f0', note: '#d8432f', z: '#3d73a0', label: '#fffdf6', hatch: 'rgba(35,33,30,.5)' },
  night: { bg: '#16181d', grain: 'rgba(255,255,255,.035)', ink: '#ece6d8', soft: 'rgba(236,230,216,.45)', sea: 'rgba(40,96,126,.42)', wave: '#86bcd6', sky: 'rgba(60,80,140,.16)',
    moon: '#f3e3a6', star: '#f3e3a6', deck: 'rgba(120,84,52,.55)', rail: 'rgba(150,108,70,.6)', body: 'rgba(80,88,100,.6)', dark: '#0d0e11', key: '#3a3e45',
    glow: 'rgba(255,170,70,.30)', red: '#ff6a55', crate: 'rgba(130,98,62,.6)', back: '#0b0c0f', belly: '#ece6d8', note: '#ffd36a', z: '#a9d4ea', label: '#ece6d8', hatch: 'rgba(236,230,216,.35)' },
};

export async function createBoombox(canvas, base) {
  await Promise.race([Promise.all([document.fonts.load('30px "Gaegu"'), document.fonts.load('700 30px "Gaegu"')]), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
  let SHELLS = {}; try { SHELLS = await (await fetch(base + 'tapes/shell.json')).json(); } catch {}
  const g = canvas.getContext('2d');
  const FONT = '"Gaegu", "Nanum Pen Script", cursive';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  let look = LOOKS[LS.get('music.jamLook')] ? LS.get('music.jamLook') : 'paper', K = LOOKS[look];
  const setLook = (l) => { look = LOOKS[l] ? l : 'paper'; K = LOOKS[look]; LS.set('music.jamLook', look); canvas.dataset.look = look; canvas.dispatchEvent(new CustomEvent('look', { detail: look })); dirty = true; };
  canvas.dataset.look = look;

  // ---- 크기 · 무대 ----
  let cw = 1, ch = 1, dpr = 1, S = 1, ox = 0, oy = 0, U = 1; // U = 화면 1px이 몇 단위인지
  const frameF = { x: 0, y: 0, w: 1, h: 1 };
  function resize() {
    cw = innerWidth; ch = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const sx = frameF.x * cw, sy = frameF.y * ch, sw = frameF.w * cw, sh = frameF.h * ch;
    S = Math.max(0.2, Math.min(sw / 720, sh / 540)); U = 1 / S;
    ox = sx + sw / 2; oy = sy + sh / 2 + Math.min(0, (sh - 540 * S) * 0.0);
    dirty = true;
  }
  function setFrame(x, y, w, h) { Object.assign(frameF, { x, y, w, h }); resize(); }
  addEventListener('resize', resize);

  // ---- 낙서 붓 ----
  let boil = 0;
  const hn = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return ((h & 0xffff) / 32768) - 1; };
  const JA = 0.75; // 손 떨림(px). 2026-11-22 '더 안정되게': 줄였고 선이 계속 떨리던 boil도 끔(그림마다 고정)
  function jit(x, y, amp = 1) { const qx = Math.round(x * S / 4), qy = Math.round(y * S / 4); return [x + hn(qx, qy, boil) * JA * U * amp, y + hn(qy + 911, qx, boil + 7) * JA * U * amp]; }
  // 점 목록을 따라 촘촘히 나눠 떨리게 그린다
  function dense(pts, closed) {
    const out = [], step = 13 * U, n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], d = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(d / step));
      for (let j = 0; j < k; j++) out.push([x0 + (x1 - x0) * j / k, y0 + (y1 - y0) * j / k]);
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function trace(pts, closed, amp = 1) {
    const P = dense(pts, closed).map(([x, y]) => jit(x, y, amp));
    if (closed) { const a = P[0]; P.push([a[0] + (P[1][0] - a[0]) * 0.8, a[1] + (P[1][1] - a[1]) * 0.8]); } // 끝이 살짝 넘침
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; g.quadraticCurveTo(P[i][0], P[i][1], mx, my); }
    const L = P[P.length - 1]; g.lineTo(L[0], L[1]);
  }
  function stroke(pts, closed, o = {}) { trace(pts, closed, o.amp ?? 1); g.strokeStyle = o.c || K.ink; g.lineWidth = (o.w || 2.3) * U; g.lineCap = g.lineJoin = 'round'; g.stroke(); }
  function fill(pts, color, off = true) { // 마커 칠: 선에서 살짝 어긋남
    if (!color) return; const dx = off ? 1.2 * U : 0, dy = off ? 0.9 * U : 0;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.closePath(); g.fillStyle = color; g.fill();
  }
  function hatch(pts, color, gap = 7, ang = -0.8) { // 빗금 칠
    g.save(); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4, c = Math.cos(ang), s = Math.sin(ang);
    g.strokeStyle = color; g.lineWidth = 1.4 * U; g.lineCap = 'round';
    for (let t = -R; t <= R; t += gap * U * 1.0 + gap * 0.3) { const a = jit(cx + c * -R - s * t, cy + s * -R + c * t, 1.6), b = jit(cx + c * R - s * t, cy + s * R + c * t, 1.6); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    g.restore();
  }
  const rr = (x, y, w, h, r) => { const P = [], q = 5; r = Math.min(r, w / 2, h / 2); const C = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]; for (const [cx, cy, a0] of C) for (let i = 0; i <= q; i++) { const a = a0 + (i / q) * Math.PI / 2; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return P; };
  const ell = (cx, cy, rx, ry = rx, n = 0) => { n = n || Math.max(14, Math.min(48, Math.round(Math.max(rx, ry) * S / 3))); const P = []; const w = hn(Math.round(cx), Math.round(cy), 3) * 0.04; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + w * Math.sin(a * 2 + 1); P.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return P; };
  function text(t, x, y, size, o = {}) { g.save(); g.translate(x, y); g.rotate((o.r || 0) + hn(Math.round(x), Math.round(y), boil) * 0.015); g.font = `${o.b ? 700 : 400} ${size * 0.82}px ${o.f || FONT}`; g.fillStyle = o.c || K.ink; g.textAlign = o.a || 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); g.restore(); }

  // 종이 결
  const grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'); for (let i = 0; i < 1400; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)'; x.globalAlpha = Math.random() * 0.5; x.fillRect(Math.random() * 160, Math.random() * 160, 1 + Math.random(), 1 + Math.random()); } return c; })();

  // ---- 상태 ----
  let playing = false, prog = 0, tapeKey = '', doorA = 0, alive = true, dirty = true, last = 0;
  const reel = [0, 0];
  const pressed = new Set(), latched = new Set();
  const notes = []; let noteT = 0;
  const fly = { on: false, x: 0, y: 0, r: 0, s: 1, a: 1 };
  const tweens = new Set();
  const tween = (ms, fn) => new Promise((ok) => { tweens.add({ t0: performance.now(), ms: still.matches ? 1 : ms, fn, ok }); dirty = true; });
  const ease = (t) => 1 - Math.pow(1 - t, 3), back = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

  // 라디오 치수
  const RX = -70, RY = 20, BW = 440, BH = 280, BT = RY - BH / 2, BB = RY + BH / 2; // 위 -120, 아래 160
  const DOOR = { x: RX - 62, y: RY - 52, w: 124, h: 92 };
  const KEYS = ['REC', 'PLAY', 'REW', 'FF', 'STOP/EJ', 'PAUSE'], KW = 46, KH = 26, KX0 = RX - (KW * 6 + 5 * 4) / 2;
  const DECK = 230;
  let hits = [];

  // ---- 카세트 그림 ----
  const TCOL = { mondrian: ['#d8432f', '#f1c232', '#2f5fa8'], enso: ['#23211e'], jack: ['#1f3a6b', '#d8432f'], prism: ['#e85d75', '#f1c232', '#4aa3d8'], wave: ['#3d73a0', '#86bcd6'], target: ['#d8432f', '#2f5fa8'],
    bauhaus: ['#d8432f', '#f1c232', '#2f5fa8'], pastel: ['#f4b6c2', '#b8e0d2', '#c9c0ee'], popart: ['#f1c232', '#e85d75', '#2f5fa8'], holo: ['#f4b6c2', '#86bcd6', '#c9e7a6', '#c9c0ee'], galaxy: ['#5a3f99', '#f3e3a6'],
    stripes70: ['#e07b39', '#f1c232', '#8a5a2b'], sunburst: ['#e0632e', '#f1c232'], marble: ['#2f5fa8', '#86bcd6'], brutal: ['#23211e', '#9aa0a6'], checker: ['#23211e'], memphis: ['#e85d75', '#f1c232', '#4aa3d8', '#23211e'], acrylic: ['#c9a24a'] };
  function labelArt(k, x, y, w, h) {
    const C = TCOL[k] || ['#d8432f'], c0 = C[0], c1 = C[1] || C[0], c2 = C[2] || c1;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const box = (a, b, c, d, col) => fill(rr(a, b, c, d, 1), col + 'cc', false);
    switch (k) {
      case 'mondrian': box(x, y, w * 0.3, h * 0.6, c0); box(x + w * 0.72, y + h * 0.45, w * 0.28, h * 0.55, c2); box(x + w * 0.34, y + h * 0.66, w * 0.2, h * 0.34, c1); for (const v of [0.31, 0.7]) stroke([[x + w * v, y], [x + w * v, y + h]], false, { w: 2.6 }); stroke([[x, y + h * 0.62], [x + w, y + h * 0.62]], false, { w: 2.6 }); break;
      case 'enso': stroke(ell(x + w * 0.78, y + h * 0.5, h * 0.36).slice(0, -4), false, { w: 4.2 }); break;
      case 'target': case 'marble': for (let i = 3; i > 0; i--) fill(ell(x + w * 0.78, y + h * 0.5, h * 0.14 * i), (i % 2 ? c0 : c1) + 'bb', false); break;
      case 'stripes70': case 'brutal': C.forEach((c, i) => box(x, y + h * (0.25 + i * 0.22), w, h * 0.16, c)); break;
      case 'checker': for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) box(x + i * w / 12, y + h * 0.4 + j * h * 0.15, w / 12, h * 0.15, c0); break;
      case 'wave': for (let j = 0; j < 3; j++) stroke(Array.from({ length: 9 }, (_, i) => [x + i * w / 8, y + h * (0.45 + j * 0.17) + Math.sin(i * 1.6) * 4]), false, { c: j % 2 ? c1 : c0, w: 3 }); break;
      case 'sunburst': for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; stroke([[x + w * 0.5, y + h], [x + w * 0.5 + Math.cos(a) * w, y + h + Math.sin(a) * w]], false, { c: i % 2 ? c0 : c1, w: 4 }); } break;
      case 'galaxy': box(x, y, w, h, c0); for (let i = 0; i < 9; i++) text('*', x + ((i * 37) % w), y + 6 + ((i * 23) % (h - 8)), 12, { c: c1 }); break;
      case 'bauhaus': fill(ell(x + w * 0.2, y + h * 0.6, h * 0.25), c0 + 'cc', false); fill([[x + w * 0.45, y + h], [x + w * 0.6, y + h * 0.35], [x + w * 0.75, y + h]], c1 + 'cc', false); box(x + w * 0.8, y + h * 0.4, w * 0.15, h * 0.5, c2); break;
      case 'popart': case 'memphis': for (let i = 0; i < 14; i++) fill(ell(x + 6 + ((i * 29) % (w - 8)), y + 8 + ((i * 17) % (h - 10)), 3.2), C[i % C.length] + 'dd', false); if (k === 'memphis') stroke(Array.from({ length: 7 }, (_, i) => [x + w * 0.1 + i * w * 0.13, y + h * (i % 2 ? 0.55 : 0.8)]), false, { c: c2, w: 2.4 }); break;
      case 'prism': fill([[x + w * 0.5, y + h * 0.15], [x + w * 0.72, y + h], [x + w * 0.28, y + h]], c2 + '99', false); stroke([[x, y + h * 0.6], [x + w * 0.45, y + h * 0.6]], false, { w: 2 }); C.forEach((c, i) => stroke([[x + w * 0.6, y + h * 0.6], [x + w, y + h * (0.4 + i * 0.12)]], false, { c, w: 3 })); break;
      case 'jack': box(x, y + h * 0.42, w, h * 0.22, c1); box(x + w * 0.44, y, w * 0.12, h, c1); break;
      case 'holo': case 'pastel': C.forEach((c, i) => box(x + i * w / C.length, y, w / C.length + 1, h, c)); break;
      default: break;
    }
    g.restore();
  }
  // 카세트(가운데 0,0, 112 x 72)
  function drawTape(k) {
    const W = 112, H = 72, x = -W / 2, y = -H / 2, clear = k === 'acrylic';
    const shell = rr(x, y, W, H, 6);
    fill(shell, clear ? 'rgba(200,210,220,.25)' : (SHELLS[k] || '#555') + (look === 'night' ? 'ee' : 'dd'));
    stroke(shell, true);
    if (!clear) { const L = rr(x + 7, y + 6, W - 14, 38, 3); fill(L, K.label, false); labelArt(k, x + 7, y + 6, W - 14, 38); stroke(L, true, { w: 1.6 }); text('A', x + 14, y + 14, 17, { b: true, c: '#23211e' }); }
    // 릴 창
    const cap = rr(x + 20, y + 24, W - 40, 22, 11); fill(cap, look === 'night' ? '#0d0e11' : '#2c2b2a', false); stroke(cap, true, { w: 1.6 });
    for (const i of [0, 1]) {
      const cx = i ? 22 : -22, cy = y + 35, f = i ? prog : 1 - prog, pr = 4.5 + 6.5 * Math.sqrt(Math.max(0, Math.min(1, f)));
      fill(ell(cx, cy, pr + 2), 'rgba(110,72,44,.95)', false);
      fill(ell(cx, cy, 5.2), clear ? '#c9a24a' : '#f2efe6', false); stroke(ell(cx, cy, 5.2), true, { w: 1.3, c: '#23211e' });
      for (let s = 0; s < 3; s++) { const a = reel[i] + s * Math.PI * 2 / 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * 2, cy + Math.sin(a) * 2); g.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); g.strokeStyle = '#23211e'; g.lineWidth = 1.5 * U; g.stroke(); }
    }
    const tz = [[x + 24, y + H], [x + 30, y + H - 11], [x + W - 30, y + H - 11], [x + W - 24, y + H]]; stroke(tz, false, { w: 1.6 });
    for (const hx of [-14, 0, 14]) fill(ell(hx, y + H - 5, 2), K.ink, false);
  }

  // ---- 라디오 ----
  function drawRadio(t) {
    // 손잡이 · 안테나
    stroke([[RX - 160, BT], [RX - 160, BT - 44], [RX - 120, BT - 62], [RX + 120, BT - 62], [RX + 160, BT - 44], [RX + 160, BT]], false, { w: 3 });
    stroke([[RX - 150, BT], [RX - 150, BT - 38], [RX - 116, BT - 52], [RX + 116, BT - 52], [RX + 150, BT - 38], [RX + 150, BT]], false, { w: 1.6 });
    const aw = Math.sin(t * 1.3) * 3;
    stroke([[RX + 196, BT + 4], [RX + 222 + aw, BT - 90], [RX + 246 + aw * 2, BT - 176]], false, { w: 2 }); fill(ell(RX + 246 + aw * 2, BT - 178, 4), K.ink, false);
    // 건반(위에 꽂힘)
    hits = hits.filter((h) => !KEYS.includes(h.k));
    KEYS.forEach((k, i) => {
      const down = pressed.has(k) || latched.has(k), x = KX0 + i * (KW + 4), y = BT - KH + (down ? 9 : 0);
      const p = rr(x, y, KW, KH + 8, 4); fill(p, down ? (k === 'REC' ? K.red + '88' : K.soft) : K.key); stroke(p, true, { w: 2 });
      const cx = x + KW / 2, cy = y + KH / 2 + 1, ic = k === 'REC' ? K.red : K.ink;
      if (k === 'REC') fill(ell(cx, cy, 6), ic, false);
      else if (k === 'PLAY') fill([[cx - 5, cy - 7], [cx + 7, cy], [cx - 5, cy + 7]], ic, false);
      else if (k === 'REW' || k === 'FF') { const d = k === 'FF' ? 1 : -1; for (const o of [-6, 2]) fill([[cx + d * (o - 0), cy - 6], [cx + d * (o + 8), cy], [cx + d * (o - 0), cy + 6]].map(([a, b]) => [a - d * 2, b]), ic, false); }
      else if (k === 'STOP/EJ') { fill([[cx - 7, cy + 1], [cx, cy - 7], [cx + 7, cy + 1]], ic, false); fill(rr(cx - 7, cy + 4, 14, 3, 1), ic, false); }
      else if (k === 'PAUSE') { fill(rr(cx - 6, cy - 6, 4, 12, 1), ic, false); fill(rr(cx + 2, cy - 6, 4, 12, 1), ic, false); }
      text(k === 'STOP/EJ' ? 'STOP' : k, cx, BT - KH - 13, 20, { c: K.soft });
      hits.push({ k, x, y: BT - KH - 24, w: KW, h: KH + 34 });
    });
    // 본체
    const body = rr(RX - BW / 2, BT, BW, BH, 26);
    fill(body, K.bg, false); fill(body, K.body); stroke(body, true, { w: 3 }); stroke(rr(RX - BW / 2 + 9, BT + 9, BW - 18, BH - 18, 20), true, { w: 1.2, c: K.soft });
    // 다이얼 창
    const dl = rr(RX - 150, BT + 20, 300, 34, 6); fill(dl, look === 'night' ? '#0d0e11' : '#fffdf6'); stroke(dl, true, { w: 2 });
    for (let i = 0; i <= 20; i++) { const x = RX - 136 + i * 13.6; stroke([[x, BT + 44], [x, BT + (i % 5 ? 49 : 41)]], false, { w: 1.2, amp: 0.4 }); }
    ['88', '96', '104'].forEach((s, i) => text(s, RX - 136 + i * 136, BT + 30, 17, { c: K.soft }));
    const nx = RX - 60 + Math.sin(t * 0.07) * 8; stroke([[nx, BT + 22], [nx, BT + 52]], false, { c: K.red, w: 2.6 });
    text('FM', RX - 180, BT + 37, 20, { c: K.soft }); text('T/L/L', RX + 186, BT + 36, 24, { b: true });
    // 스피커
    const beat = playing && !still.matches ? Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)) ** 6 : 0;
    for (const sx of [-1, 1]) {
      const cx = RX + sx * 140, cy = RY + 34, R = 70 * (1 + beat * 0.035);
      const o = ell(cx, cy, 76); fill(o, look === 'night' ? 'rgba(0,0,0,.35)' : 'rgba(60,60,60,.12)', false); stroke(o, true, { w: 2.6 });
      stroke(ell(cx, cy, R - 10), true, { w: 1.2, c: K.soft }); stroke(ell(cx, cy, R * 0.8), true, { w: 1.2, c: K.soft });
      stroke(ell(cx, cy, R * 0.62), true, { w: 1.8 }); stroke(ell(cx, cy, R * 0.25), true, { w: 2.2 }); fill(ell(cx, cy, R * 0.25), K.body, false);
      if (beat > 0.25) for (const s of [1, 1.18]) { const a0 = sx > 0 ? -0.6 : Math.PI - 0.6; stroke(Array.from({ length: 6 }, (_, i) => { const a = a0 + i * 0.24; return [cx + Math.cos(a) * 88 * s, cy + Math.sin(a) * 88 * s]; }), false, { w: 1.6, c: K.soft }); }
    }
    // 카세트 칸 + 문(아래 경첩)
    const D = DOOR;
    const slot = rr(D.x + 4, D.y + 4, D.w - 8, D.h - 8, 4); fill(slot, K.dark, false);
    g.save(); g.translate(0, D.y + D.h); g.scale(1, 1 - doorA * 0.55); g.translate(0, -(D.y + D.h));
    const door = rr(D.x - doorA * 6, D.y, D.w + doorA * 12, D.h, 6);
    fill(door, look === 'night' ? 'rgba(20,22,26,.85)' : 'rgba(235,238,242,.9)'); stroke(door, true, { w: 2.4 });
    if (tapeKey && !fly.on) { g.save(); g.translate(D.x + D.w / 2, D.y + D.h / 2 + 2); g.scale(0.98, 0.98); drawTape(tapeKey); g.restore(); }
    stroke(rr(D.x + 3, D.y + 3, D.w - 6, D.h - 6, 5), true, { w: 1, c: K.soft });
    g.restore();
    hits = hits.filter((h) => h.k !== 'door'); hits.push({ k: 'door', x: D.x, y: D.y, w: D.w, h: D.h });
    text(playing ? 'PLAY ▶' : 'STEREO', RX, BB - 28, 22, { c: playing ? K.red : K.soft });
    if (latched.has('REC')) { fill(ell(RX + 56, BB - 28, 4), Math.floor(t * 1.4) % 2 ? K.red : K.red + '44', false); }
  }

  // ---- 배경: 하늘 · 바다 · 뱃전 · 갑판 ----
  const stars = Array.from({ length: 28 }, (_, i) => [hn(i, 1, 99), hn(i, 2, 99), hn(i, 3, 99)]);
  function drawWorld(t) {
    const L = -ox * U, R = (cw - ox) * U, T = -oy * U, B = (ch - oy) * U; // 화면 끝(단위)
    const rock = still.matches ? 0 : Math.sin(t * 0.55) * 0.012, bob = still.matches ? 0 : Math.sin(t * 0.8) * 4;
    const HZ = -40;
    g.save(); g.translate(0, bob); g.rotate(rock);
    const pad = 200;
    fill([[L - pad, T - pad], [R + pad, T - pad], [R + pad, HZ], [L - pad, HZ]], K.sky, false);
    // 별
    for (const [a, b, c] of stars) {
      const x = L + (a + 1) / 2 * (R - L), y = T + (b + 1) / 2 * (HZ - 30 - T); if (y > HZ - 20) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + c) + a * 9), s = 3 + 2.5 * (c + 1) / 2;
      g.globalAlpha = 0.35 + tw * 0.6; stroke([[x - s, y], [x + s, y]], false, { c: K.star, w: 1.4 }); stroke([[x, y - s], [x, y + s]], false, { c: K.star, w: 1.4 }); g.globalAlpha = 1;
    }
    // 달
    const mx = Math.min(R - 70, 290), my = Math.max(T + 70, -230);
    fill(ell(mx, my, 34), K.moon + (look === 'night' ? 'ee' : 'cc')); stroke(ell(mx, my, 34), true, { w: 2.4 });
    fill(ell(mx + 12, my - 6, 26), look === 'night' ? K.bg : K.bg, false);
    stroke(ell(mx + 12, my - 6, 26).slice(9, 25), false, { w: 1.4, c: K.soft });
    hits = hits.filter((h) => h.k !== 'moon'); hits.push({ k: 'moon', x: mx - 44, y: my - 44 + bob, w: 88, h: 88 });
    // 바다
    fill([[L - pad, HZ], [R + pad, HZ], [R + pad, 160], [L - pad, 160]], K.sea, false);
    stroke([[L - pad, HZ], [R + pad, HZ]], false, { w: 2 });
    // 달빛 길
    for (let i = 0; i < 7; i++) { const y = HZ + 12 + i * 16, w = 10 + i * 7, x = mx + Math.sin(t * 1.5 + i) * 6; stroke([[x - w, y], [x + w, y]], false, { c: K.moon, w: 2.2 }); }
    // 물결(앞으로 올수록 크고 빠름)
    for (let r = 0; r < 6; r++) {
      const y = HZ + 14 + r * r * 4.2 + r * 10, amp = 2 + r * 1.3, wl = 46 + r * 16, sp = (8 + r * 5) * (r % 2 ? 1 : -1), off = (t * sp) % (wl * 2);
      for (let x = L - wl * 2 + off + (r * 37) % wl; x < R + wl; x += wl * 2.3) {
        stroke([[x, y], [x + wl * 0.25, y - amp], [x + wl * 0.5, y], [x + wl * 0.75, y - amp * 0.6], [x + wl, y]], false, { c: K.wave, w: 1.5 + r * 0.15 });
      }
    }
    g.restore();
    // 뱃전(난간) — 배와 함께라 기울지 않음
    const RT = 112, RB = 156;
    fill([[L - 20, RT], [R + 20, RT], [R + 20, RB], [L - 20, RB]], K.rail);
    stroke([[L - 20, RT], [R + 20, RT]], false, { w: 3 }); stroke([[L - 20, RT + 10], [R + 20, RT + 10]], false, { w: 1.4 }); stroke([[L - 20, RB], [R + 20, RB]], false, { w: 2.4 });
    for (let x = Math.ceil((L + 40) / 120) * 120 - 20; x < R; x += 120) stroke([[x, RT + 10], [x, RB]], false, { w: 1.6 });
    // 갑판
    fill([[L - 20, RB], [R + 20, RB], [R + 20, B + 20], [L - 20, B + 20]], K.deck);
    for (let i = 1; i < 9; i++) { const y = RB + i * i * 6 + i * 6; if (y > B) break; stroke([[L - 20, y], [R + 20, y]], false, { w: 1.1, c: K.soft }); }
    for (let x = Math.ceil(L / 90) * 90; x < R; x += 90) stroke([[x, RB + 6 + (x % 7)], [x, RB + 16 + (x % 7)]], false, { w: 1, c: K.soft });
  }
  // 생선 상자 · 등불 · 밧줄
  function drawProps(t) {
    // 상자 No.7
    const cx0 = RX - 205, cw0 = 410, ct = BB, cb = DECK + 8;
    fill([[cx0, ct], [cx0 + cw0, ct], [cx0 + cw0, cb], [cx0, cb]], K.bg, false); fill([[cx0, ct], [cx0 + cw0, ct], [cx0 + cw0, cb], [cx0, cb]], K.crate); stroke([[cx0, ct], [cx0 + cw0, ct], [cx0 + cw0, cb], [cx0, cb]], true, { w: 2.6 });
    stroke([[cx0, ct + 26], [cx0 + cw0, ct + 26]], false, { w: 1.4 }); stroke([[cx0, ct + 50], [cx0 + cw0, ct + 50]], false, { w: 1.4 });
    text('No.7', cx0 + cw0 / 2, ct + 38, 40, { b: true, r: -0.03 }); text('><(((°>', cx0 + 70, ct + 14, 18, { c: K.soft, r: 0.02 }); text('FRESH', cx0 + cw0 - 64, ct + 60, 22, { c: K.soft });
    fill([[cx0 - 10, cb], [cx0 + cw0 + 30, cb], [cx0 + cw0 + 14, cb + 8], [cx0 - 2, cb + 8]], K.hatch, false);
    // 등불(왼쪽 장대에 매달림)
    const px = RX - 268, top = BT - 40, fl = still.matches ? 1 : 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7);
    stroke([[px, DECK], [px, top - 40]], false, { w: 3 }); stroke([[px, top - 40], [px + 34, top - 40]], false, { w: 2.4 });
    const sw = still.matches ? 0 : Math.sin(t * 0.9) * 0.08;
    g.save(); g.translate(px + 30, top - 40); g.rotate(sw);
    g.globalAlpha = fl; const gl = g.createRadialGradient(0, 64, 4, 0, 64, 120); gl.addColorStop(0, K.glow); gl.addColorStop(1, 'rgba(255,190,80,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 64, 120, 0, 7); g.fill(); g.globalAlpha = 1;
    stroke([[0, 0], [0, 24]], false, { w: 1.6 });
    const lb = rr(-16, 24, 32, 46, 8); fill(lb, 'rgba(255,214,110,.75)'); stroke(lb, true, { w: 2.2 });
    stroke([[-20, 24], [20, 24]], false, { w: 2.6 }); stroke([[-18, 70], [18, 70]], false, { w: 2.6 }); stroke([[-16, 47], [16, 47]], false, { w: 1, c: K.soft });
    fill(ell(0, 52, 5, 8 * fl), '#ff9d2e', false);
    g.restore();
    // 밧줄 사리
    const rx0 = 352, ry0 = DECK + 2;
    for (let i = 0; i < 4; i++) stroke(ell(rx0, ry0 - i * 7, 40 - i * 5, 11 - i), true, { w: 2, c: K.ink });
    stroke([[rx0 - 22, ry0 - 26], [rx0 - 40, ry0 - 60], [rx0 - 30, ry0 - 92]], false, { w: 2 });
  }

  // ---- 음표 ----
  function stepNotes(dt, t) {
    if (playing && tapeKey && !still.matches && (noteT -= dt) < 0) {
      noteT = 0.45 + Math.random() * 0.5; const sx = Math.random() < 0.5 ? -1 : 1;
      notes.push({ x: RX + sx * 140 + (Math.random() - 0.5) * 50, y: RY - 20, vx: sx * (8 + Math.random() * 14), life: 0, ch: '♪♫♬♩'[(Math.random() * 4) | 0], s: 20 + Math.random() * 14, ph: Math.random() * 6 });
    }
    for (const n of notes) { n.life += dt; n.y -= dt * 46; n.x += n.vx * dt + Math.sin(t * 3 + n.ph) * 0.6; }
    while (notes.length && notes[0].life > 3.2) notes.shift();
  }
  function drawNotes() { for (const n of notes) { g.globalAlpha = Math.max(0, Math.min(1, n.life * 3) * (1 - n.life / 3.2)); text(n.ch, n.x, n.y, n.s, { c: K.note, b: true }); } g.globalAlpha = 1; }

  // ---- p: 통통한 황제펭귄 (2026-11-22 사용자 요청: 몰랑이의 삐약이처럼 동글동글·뚱뚱, 흰 눈, 대사 없이 몸짓으로) ----
  // 몸 = 공 하나(검은 머리·등, 흰 얼굴·배, 노란 볼 무늬), 짧은 지느러미 둘, 작은 부리, 흰 눈(뜸·깜빡·웃음·감음·찡그림·화남·어질어질)
  // 움직임: 상태가 목표 자세(T)만 정하고 실제 자세는 매 프레임 지수 감쇠로 따라감 → 상태가 바뀌어도 툭 끊기지 않음
  // 소리는 api.onSfx('call'|'peep'|'honk'|'bray'|'snore')로 jam.js에 맡김(효과음 설정을 따름)
  const AREA = { x0: 224, x1: 312 };
  const P = { x: 262, face: -0.3, rot: 0, lift: 0, sqx: 1, sqy: 1, wl: 0.2, wr: 0.2, lie: 0, spin: 0, blush: 0, puff: 1, fl: 0, fr: 0, ph: 0,
    st: 'stand', prev: '', t0: 0, dur: 3000, tx: 262, back: 262, dir: 1, real: null, eye: 'open', look: 0, beak: 0, z: 0,
    blinkAt: 0, blinkTo: 0, callAt: performance.now() + 12000, callK: -1e9, hopN: -1, fired: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const snd = (k) => { try { api.onSfx && api.onSfx(k); } catch (e) { console.warn('jam sfx', e); } };
  const go = (st, now, dur) => { P.prev = P.st; P.st = st; P.t0 = now; P.dur = dur; P.fired = 0; P.hopN = -1; };
  const DUR = { dance: [6000, 11000], bop: [4000, 7000], hop: [2600, 4000], spin: [1700, 1700], clap: [3000, 5000], moon: [4000, 7000], sit: [5000, 9000], stand: [2500, 5500],
    sleep: [9000, 16000], preen: [3000, 5000], shiver: [1800, 1800], yawn: [2400, 2400] };
  function pick(now) {
    const W = playing ? [['dance', 30], ['bop', 14], ['hop', 10], ['spin', 8], ['clap', 10], ['wander', 10], ['slide', 6], ['moon', 4], ['sit', 4], ['preen', 4]]
      : [['stand', 18], ['sleep', 15], ['wander', 18], ['moon', 12], ['preen', 10], ['sit', 10], ['slide', 7], ['shiver', 4], ['yawn', 6]];
    let st = P.st;
    for (let i = 0; i < 4 && st === P.st; i++) { let r = Math.random() * W.reduce((a, x) => a + x[1], 0); for (const [k, w] of W) { if ((r -= w) <= 0) { st = k; break; } } }
    if (st === 'wander') { P.tx = rnd(AREA.x0, AREA.x1); go('wander', now, 9000); }
    else if (st === 'slide') { P.tx = rnd(RX - 150, RX + 40); P.back = rnd(AREA.x0, AREA.x1); go('slide', now, 9000); }
    else { const [a, b] = DUR[st] || [3000, 5000]; go(st, now, rnd(a, b)); }
  }
  function walkTo(T, dt, speed) {
    const d = P.tx - P.x; if (Math.abs(d) < 2) return true;
    P.dir = Math.sign(d); T.face = P.dir * 0.85; P.x += P.dir * Math.min(Math.abs(d), speed * dt); P.ph += dt * 8.5;
    const s1 = Math.sin(P.ph); T.rot = s1 * 0.12; T.lift = Math.abs(s1) * 4; T.sqy = 1 - Math.abs(s1) * 0.03; T.sqx = 1 + Math.abs(s1) * 0.02;
    T.wl = 0.6 + s1 * 0.22; T.wr = 0.6 - s1 * 0.22; P.fl = Math.max(0, s1) * 5; P.fr = Math.max(0, -s1) * 5; return false;
  }
  const RATE = { face: 6, rot: 9, lift: 16, sqx: 14, sqy: 14, wl: 11, wr: 11, lie: 6, blush: 4, puff: 8, look: 5, beak: 18 };
  function stepPeng(now, dt, t) {
    const k = (now - P.t0) / P.dur, e1 = Math.min(1, Math.max(0, k)), D = {};
    const T = { face: P.face, rot: 0, lift: 0, sqx: 1, sqy: 1 + 0.016 * Math.sin(t * 2.2), wl: 0.18, wr: 0.18, lie: 0, blush: 0, puff: 1, look: 0, beak: 0 };
    P.eye = 'open'; P.z = 0; P.fl = 0; P.fr = 0;
    const once = (bit, fn) => { if (!(P.fired & bit)) { P.fired |= bit; fn(); } };
    switch (P.st) {
      case 'stand': T.face = Math.sin(t * 0.45 + 1) * 0.6; T.rot = Math.sin(t * 0.7) * 0.03; break;
      case 'wander': if (walkTo(T, dt, 30) || k > 1) go('stand', now, rnd(1500, 3000)); break;
      case 'moon': T.face = 0.45; T.look = 1; T.rot = -0.09 + Math.sin(t * 1.2) * 0.03; T.wl = T.wr = 0.35 + Math.sin(t * 2) * 0.12; P.eye = 'wide'; break;
      case 'preen': T.face = 0.15; T.rot = Math.sin(t * 3) * 0.05; T.wl = -0.55 + Math.sin(t * 8) * 0.25; T.wr = 0.2; P.eye = 'happy'; T.blush = 0.4; break; // 지느러미로 배 쓰담쓰담
      case 'sit': T.sqy = 0.86; T.sqx = 1.1; T.face = Math.sin(t * 0.4) * 0.4; P.fl = Math.max(0, Math.sin(t * 3)) * 4; P.fr = Math.max(0, Math.sin(t * 3 + 1.5)) * 4; T.wl = T.wr = 0.5; break; // 철퍼덕 앉아 발 까딱
      case 'sleep':
        T.sqy = 0.9 + 0.03 * Math.sin(t * 1.4); T.sqx = 1.07 - 0.015 * Math.sin(t * 1.4); T.rot = 0.07 + Math.sin(t * 0.7) * 0.02; T.wl = T.wr = 0.05; P.eye = 'closed'; P.z = k > 0.08 ? 1 : 0;
        if (Math.floor(k * 5) !== P.hopN) { P.hopN = Math.floor(k * 5); if (P.hopN > 0) snd('snore'); }
        if (playing && k > 0.3 && Math.random() < dt * 0.35) { go('boing', now, 900); }
        break;
      case 'shiver': T.rot = Math.sin(t * 55) * 0.035; T.sqx = 1 + Math.sin(t * 55) * 0.025; T.wl = T.wr = -0.15; P.eye = 'squeeze'; break;
      case 'yawn': { const e = Math.sin(e1 * Math.PI); T.sqy = 1 + 0.14 * e; T.sqx = 1 - 0.06 * e; T.wl = T.wr = 0.2 + 2.1 * e; T.beak = e; P.eye = e > 0.3 ? 'closed' : 'open'; break; }
      case 'dance': {
        const ph = t * Math.PI * 1.6, b = Math.abs(Math.sin(ph));
        T.lift = b * 12; T.sqy = 0.92 + b * 0.1; T.sqx = 1.08 - b * 0.08; T.rot = Math.sin(ph / 2) * 0.15;
        T.wl = 0.5 + Math.max(0, Math.sin(ph)) * 1.5; T.wr = 0.5 + Math.max(0, -Math.sin(ph)) * 1.5; T.face = Math.sin(t * 0.9) * 0.7; P.eye = 'happy'; T.blush = 0.35; break;
      }
      case 'bop': { const b = Math.abs(Math.sin(t * Math.PI * 1.6)); T.sqy = 1 - b * 0.08; T.sqx = 1 + b * 0.05; T.rot = Math.sin(t * Math.PI * 0.8) * 0.06; T.wl = T.wr = 0.3 + b * 0.2; P.eye = 'happy'; break; }
      case 'hop': {
        const q = t * 2.1, n = Math.floor(q), p = q - n;
        D.lift = Math.sin(p * Math.PI) * 24; T.sqy = p < 0.12 || p > 0.92 ? 0.84 : 1.07; T.sqx = 2 - T.sqy; T.wl = T.wr = 0.4 + Math.sin(p * Math.PI) * 1.3; P.eye = 'happy';
        if (n !== P.hopN) { if (P.hopN >= 0 && Math.random() < 0.5) snd('peep'); P.hopN = n; }
        break;
      }
      case 'spin': { T.face = Math.cos(e1 * Math.PI * 4); D.face = T.face; T.sqx = 0.9 + 0.1 * Math.abs(T.face); T.wl = T.wr = 1.3; T.lift = Math.sin(e1 * Math.PI) * 10; P.eye = 'happy'; if (k > 1) go('dance', now, rnd(4000, 7000)); break; }
      case 'clap': { const c = 0.5 + 0.5 * Math.sin(t * Math.PI * 5); T.wl = T.wr = -0.95 + c * 0.9; T.lift = Math.abs(Math.sin(t * Math.PI * 2.5)) * 5; T.face = 0; P.eye = 'happy'; T.blush = 0.5; break; }
      case 'slide': {
        T.lie = 1; T.wl = T.wr = 1.5; T.face = P.dir; P.eye = 'happy';
        const d = P.tx - P.x; P.dir = Math.sign(d) || P.dir;
        if (P.lie > 0.85) { if (Math.abs(d) > 3) P.x += P.dir * Math.min(Math.abs(d), 110 * dt); else { P.tx = P.back; go('getup', now, 900); } }
        break;
      }
      case 'getup': T.wl = T.wr = 0.8; if (k > 1) go('wander', now, 9000); break;
      case 'topeck': if (walkTo(T, dt, 44) || k > 1) go('peck', now, 1700); break;
      case 'peck': { // 라디오를 콕콕콕
        T.face = -1; const c = Math.max(0, Math.sin(e1 * Math.PI * 6)); T.rot = -(0.16 + c * 0.3); T.wl = 0.9; T.wr = 0.4; P.eye = c > 0.5 ? 'squeeze' : 'open';
        if (P.real && k > 0.5) { P.real(); P.real = null; }
        if (k > 1) { P.tx = rnd(AREA.x0 + 20, AREA.x1); go('wander', now, 6000); }
        break;
      }
      case 'add': { // 곡을 넣었다: 높이 뛰어 한 바퀴
        once(1, () => snd('peep'));
        D.lift = Math.sin(Math.PI * Math.min(1, e1 * 1.25)) * 80; D.spin = e1 < 0.8 ? (e1 / 0.8) * Math.PI * 2 * P.dir : 0;
        T.wl = T.wr = e1 < 0.85 ? 2.2 : 0.4; P.eye = 'happy'; T.blush = 0.6;
        if (e1 > 0.82) once(2, () => snd('call'));
        if (k > 1) { P.spin = 0; go('hop', now, 2600); }
        break;
      }
      case 'cheer': T.wl = T.wr = 2.0 + Math.sin(t * 12) * 0.3; T.lift = Math.abs(Math.sin(t * Math.PI * 3)) * 10; T.face = 0; P.eye = 'happy'; T.blush = 0.6; once(1, () => snd('peep')); if (k > 1) pick(now); break;
      case 'squish': { // 눌렀더니 찌부 → 말랑하게 튕겨 돌아옴
        once(1, () => snd('honk'));
        const sq = e1 < 0.25 ? 1 - 0.36 * (e1 / 0.25) : 1 - 0.36 * Math.exp(-6 * (e1 - 0.25)) * Math.cos(16 * (e1 - 0.25));
        D.sqy = sq; D.sqx = 2 - sq; T.wl = T.wr = 1 - sq + 0.3; P.eye = e1 < 0.45 ? 'squeeze' : 'happy'; T.blush = 0.7; if (k > 1) go('stand', now, 2000); break;
      }
      case 'shy': T.blush = 1; T.wl = T.wr = -2.3; T.face = 0.9 * (P.dir || 1); T.rot = 0.08; T.sqy = 0.95; P.eye = 'closed'; if (k > 1) pick(now); break; // 지느러미로 얼굴 가림
      case 'boing': { once(1, () => snd('peep')); D.lift = Math.sin(Math.PI * e1) * 42; T.sqy = 1.12; T.sqx = 0.92; T.wl = T.wr = 2.4; P.eye = 'wide'; if (k > 1) go('stand', now, 1800); break; }
      case 'flop': { // 뒤로 벌러덩, 발 버둥
        once(1, () => { snd('honk'); P.dir = P.face >= 0 ? -1 : 1; });
        T.lie = e1 < 0.72 ? 1 : 0; T.wl = T.wr = 1.6 + Math.sin(t * 18) * 0.4; P.fl = Math.abs(Math.sin(t * 20)) * 7; P.fr = Math.abs(Math.cos(t * 20)) * 7; P.eye = 'dizzy';
        if (k > 1) go('stand', now, 2000); break;
      }
      case 'angry': { // 금지곡: 발 구르고 부풀고 지느러미 파닥
        once(1, () => snd('bray'));
        T.puff = 1.13; T.lift = Math.abs(Math.sin(t * Math.PI * 5)) * 6; T.rot = Math.sin(t * Math.PI * 5) * 0.07; T.face = 0;
        T.wl = 1.3 + Math.sin(t * 30) * 0.5; T.wr = 1.3 - Math.sin(t * 30) * 0.5; P.fl = Math.max(0, Math.sin(t * Math.PI * 5)) * 7; P.fr = Math.max(0, -Math.sin(t * Math.PI * 5)) * 7; P.eye = 'angry';
        if (k > 1) go('sulk', now, 4000); break;
      }
      case 'sulk': T.face = 1; T.rot = 0.06; T.sqy = 0.94; T.wl = T.wr = 0.02; P.eye = 'closed'; if (k > 1) pick(now); break;
      default: break;
    }
    if (k > 1 && DUR[P.st] && P.st !== 'spin') pick(now);
    if (!playing && ['dance', 'bop', 'hop', 'clap', 'spin'].includes(P.st)) go('stand', now, 2000);
    if (playing && ['stand', 'moon', 'sit'].includes(P.st) && k > 0.4 && Math.random() < dt * 0.35) go('dance', now, rnd(6000, 10000));
    // 가끔 고개를 들고 운다(실제 황제펭귄처럼 길게 떨리는 소리)
    if (now > P.callAt && !['sleep', 'slide', 'flop', 'peck', 'topeck'].includes(P.st)) { P.callAt = now + rnd(playing ? 50000 : 28000, playing ? 110000 : 70000); P.callK = now; snd('call'); }
    const ck = (now - P.callK) / 1400; if (ck >= 0 && ck < 1) { const e = Math.sin(ck * Math.PI); T.rot += -0.16 * e; T.sqy += 0.06 * e; T.beak = Math.max(T.beak, e * (0.6 + 0.4 * Math.abs(Math.sin(ck * 30)))); T.look = Math.max(T.look, e); T.wl += 0.4 * e; T.wr += 0.4 * e; }
    // 깜빡임
    if (now > P.blinkAt) { P.blinkTo = now + 130; P.blinkAt = now + rnd(2200, 6000); }
    if (P.eye === 'open' && now < P.blinkTo) P.eye = 'blink';
    for (const key in RATE) P[key] += (T[key] - P[key]) * (1 - Math.exp(-dt * RATE[key]));
    Object.assign(P, D);
    if (!('spin' in D)) P.spin += (0 - P.spin) * (1 - Math.exp(-dt * 10));
  }
  function headPos() { return [P.x + Math.sin(P.rot) * 100, DECK - P.lift - 108 * P.sqy * P.puff]; }
  function drawPeng(t) {
    const ink = look === 'night' ? K.ink : '#1b1a18', f = Math.max(-1, Math.min(1, P.face)), white = '#fffdf6';
    // 그림자
    const sh = 1 - Math.min(0.6, Math.max(0, P.lift) / 120); fill(ell(P.x, DECK + 3, 56 * sh * P.sqx, 8 * sh), look === 'night' ? 'rgba(0,0,0,.3)' : 'rgba(60,40,20,.16)', false);
    g.save(); g.translate(P.x, DECK - P.lift - 54); g.rotate(P.rot + P.spin + P.lie * (Math.PI / 2) * P.dir); g.scale(P.sqx * P.puff, P.sqy * P.puff); g.translate(0, 54);
    // 발
    for (const sx of [-1, 1]) { const lf = sx < 0 ? P.fl : P.fr, ft = ell(sx * 21 + f * 5, -3 - lf, 15, 6.5); fill(ft, '#4b4540', false); stroke(ft, true, { w: 1.8, c: ink }); }
    // 몸: 아래가 살짝 퍼진 공
    const body = []; for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2, sy = Math.sin(a); body.push([Math.cos(a) * 63 * (1 + 0.08 * sy), -54 + sy * 53]); }
    fill(body, K.back);
    const bx = f * 13;
    g.save(); g.beginPath(); body.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    const belly = []; for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, sy = Math.sin(a); belly.push([bx + Math.cos(a) * (40 - 6 * Math.max(0, -sy)), -40 + sy * (sy < 0 ? 31 : 36)]); }
    fill(belly, white, false);
    fill(ell(bx, -63, 27, 9), 'rgba(246,204,104,.8)', false); // 목 아래 노란 기
    for (const sx of [-1, 1]) fill(ell(bx + sx * 41, -66, 9, 13), 'rgba(242,170,60,.95)', false); // 볼(귀) 무늬
    if (P.blush > 0.02) { g.globalAlpha = Math.min(1, P.blush); for (const sx of [-1, 1]) fill(ell(bx + sx * 25, -52, 8, 4.5), 'rgba(255,128,140,.75)', false); g.globalAlpha = 1; }
    g.restore();
    stroke(body, true, { w: 2.6, c: ink }); stroke(belly.slice(18, 36), false, { w: 1.1, c: 'rgba(0,0,0,.18)' });
    // 눈(흰색)
    const ey = -81 - P.look * 4, ex0 = bx + f * 3;
    for (const sx of [-1, 1]) {
      const ex = ex0 + sx * 15 * (1 - Math.abs(f) * 0.15), W2 = { c: white, w: 2.6 };
      switch (P.eye) {
        case 'blink': stroke([[ex - 5, ey], [ex + 5, ey]], false, W2); break;
        case 'happy': stroke([[ex - 5.5, ey + 2], [ex, ey - 3.5], [ex + 5.5, ey + 2]], false, W2); break;
        case 'closed': stroke([[ex - 5.5, ey - 1], [ex, ey + 3], [ex + 5.5, ey - 1]], false, W2); break;
        case 'squeeze': stroke([[ex - 4 * sx, ey - 4], [ex + 4 * sx, ey], [ex - 4 * sx, ey + 4]], false, W2); break;
        case 'dizzy': stroke(ell(ex, ey, 5).slice(0, 12), false, { c: white, w: 2 }); stroke(ell(ex, ey, 2.2).slice(0, 10), false, { c: white, w: 1.6 }); break;
        case 'angry': fill([[ex - 6, ey - 3 + sx * 3], [ex + 6, ey - 3 - sx * 3], [ex + 5, ey + 4], [ex - 5, ey + 4]], white, false); stroke([[ex - 8 * -sx, ey - 13], [ex + 7 * -sx, ey - 7]], false, { c: white, w: 3 }); break;
        case 'wide': fill(ell(ex, ey, 6.6, 8), white, false); break;
        default: fill(ell(ex, ey, 5.3, 6.6), white, false);
      }
    }
    // 부리(작게). 울 때·하품할 때 벌어짐
    const bkx = bx + f * 7, bky = -71, op = P.beak * 5;
    const up = [[bkx - 7, bky - 1 - op * 0.3], [bkx + 7, bky - 1 - op * 0.3], [bkx + f * 3, bky + 5 - op * 0.6]];
    if (op > 0.6) { const lo = [[bkx - 5.5, bky + op * 0.5], [bkx + 5.5, bky + op * 0.5], [bkx + f * 3, bky + 6 + op]]; fill(lo, '#e8896b', false); stroke(lo, true, { w: 1.5, c: ink }); }
    fill(up, '#2b2622', false); stroke(up, true, { w: 1.6, c: ink }); if (op <= 0.6) stroke([[bkx - 4, bky + 1.5], [bkx + 4, bky + 1.5]], false, { w: 1.6, c: '#ee9a33' });
    // 지느러미: 0 = 옆구리에 붙음, + = 밖·위로 듦, - = 배·얼굴 쪽으로
    for (const sx of [-1, 1]) {
      const a = sx < 0 ? P.wl : P.wr; g.save(); g.translate(sx * 57, -64); g.rotate(-sx * a);
      const wg = [[-7, 0], [7, 0], [9, 17], [4, 33], [-4, 33], [-9, 17]]; fill(wg, K.back, false); stroke(wg, true, { w: 2.2, c: ink }); g.restore();
    }
    g.restore();
    if (P.z) for (let i = 0; i < 3; i++) { const q = (t * 0.3 + i / 3) % 1, [hx, hy] = headPos(); g.globalAlpha = Math.sin(q * Math.PI) * 0.85; text('z', hx + 30 + q * 30, hy - 4 - q * 54, 16 + q * 16, { c: K.z, b: true }); g.globalAlpha = 1; }
    hits = hits.filter((h) => h.k !== 'p'); hits.push({ k: 'p', x: P.x - 70, y: DECK - P.lift - 130, w: 140, h: 140 + P.lift });
  }

  // ---- 프레임 ----
  function draw(now) {
    const t = now / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = K.bg; g.fillRect(0, 0, canvas.width, canvas.height);
    g.globalAlpha = look === 'night' ? 0.05 : 0.07; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, canvas.width, canvas.height); g.globalAlpha = 1;
    g.setTransform(dpr * S, 0, 0, dpr * S, dpr * ox, dpr * oy);
    drawWorld(t); drawProps(t);
    const slideFront = P.x < RX + BW / 2 + 40; // 라디오 앞(상자 앞)에 있으면 앞에 그림
    if (!slideFront) drawPeng(t);
    drawRadio(t);
    if (slideFront) drawPeng(t);
    drawNotes();
    if (fly.on && tapeKey) { g.save(); g.globalAlpha = fly.a; g.translate(fly.x, fly.y); g.rotate(fly.r); g.scale(fly.s, fly.s); drawTape(tapeKey); g.restore(); g.globalAlpha = 1; }
  }
  function frame(now) {
    if (!alive) return;
    requestAnimationFrame(frame);
    if (document.hidden || !window.MusicJamOn) { last = now; return; }
    for (const tw of [...tweens]) { const t = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(t); if (t >= 1) { tweens.delete(tw); tw.ok(); } }
    const busy = tweens.size > 0, gap = busy || playing || P.st !== 'sleep' ? 1000 / 30 : 1000 / 20; // 펭귄이 부드럽게 움직이도록 30fps
    if (now - last < gap && !dirty) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now; dirty = false;
    boil = 0;
    if (playing && tapeKey) { const v = 0.9 * dt; reel[0] -= v / (0.4 + 0.6 * Math.sqrt(1 - prog)); reel[1] -= v / (0.4 + 0.6 * Math.sqrt(prog)); }
    stepPeng(now, dt, now / 1000); stepNotes(dt, now / 1000);
    draw(now);
  }
  requestAnimationFrame(frame);

  // ---- 조작 ----
  async function setDoor(open) { const a0 = doorA, a1 = open ? 1 : 0; if (a0 === a1) return; await tween(open ? 480 : 340, (t) => { doorA = a0 + (a1 - a0) * (open ? back(t) : t * t); }); }
  function setTape(key) { tapeKey = key ? (TCOL[key] ? key : 'mondrian') : ''; dirty = true; }
  async function insert(key, snd) {
    setTape(key); fly.on = true; fly.a = 1;
    await setDoor(true); snd && snd('door');
    const x1 = DOOR.x + DOOR.w / 2, y1 = DOOR.y + DOOR.h / 2 + 2;
    await tween(620, (t) => { const e = ease(t); fly.x = 260 + (x1 - 260) * e; fly.y = -300 + (y1 + 300) * e - Math.sin(e * Math.PI) * 60; fly.r = 0.9 * (1 - e); fly.s = 1.9 - 0.92 * e; });
    fly.on = false; snd && snd('seat');
    await new Promise((ok) => setTimeout(ok, 160));
    await setDoor(false); snd && snd('close');
  }
  async function eject(snd) {
    snd && snd('eject'); await setDoor(true);
    if (tapeKey) {
      fly.on = true; const x0 = DOOR.x + DOOR.w / 2, y0 = DOOR.y + DOOR.h / 2;
      await tween(560, (t) => { const e = t * t; fly.x = x0 + 60 * e; fly.y = y0 - 420 * e; fly.r = -0.7 * e; fly.s = 1 + 0.8 * e; fly.a = 1 - e * 0.6; });
      fly.on = false; setTape(null);
    }
    await setDoor(false);
  }
  function press(k, down) { if (down) pressed.add(k); else pressed.delete(k); dirty = true; }
  function tap(k) { press(k, true); setTimeout(() => press(k, false), 160); }
  function latch(k, on) { if (!!on === latched.has(k)) return; if (on) latched.add(k); else latched.delete(k); dirty = true; }
  function setProgress(f) { prog = Math.max(0, Math.min(1, f || 0)); }
  function setPlaying(on) { if (playing !== !!on) dirty = true; playing = !!on; }

  const api = { onKey: null, onDoor: null, onPenguin: null, onSfx: null };
  function hit(ev) {
    const b = canvas.getBoundingClientRect(), x = (ev.clientX - b.left - ox) * U, y = (ev.clientY - b.top - oy) * U;
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.k; }
    return null;
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const k = hit(ev); if (!k) return; ev.preventDefault();
    if (k === 'door') api.onDoor && api.onDoor();
    else if (k === 'p') api.onPenguin && api.onPenguin();
    else if (k === 'moon') setLook(look === 'paper' ? 'night' : 'paper');
    else api.onKey && api.onKey(k);
  });
  canvas.addEventListener('pointermove', (ev) => { canvas.style.cursor = hit(ev) ? 'pointer' : ''; });

  Object.defineProperties(api, { // Object.assign은 getter를 그 순간 값으로 복사해 버리므로 따로
    look: { get: () => look }, penguinState: { get: () => P.st }, tapeKey: { get: () => tapeKey },
  });
  return Object.assign(api, {
    setTape, insert, eject, setDoor, setPlaying, setProgress, press, tap, latch, resize, setFrame, setLook,
    // 'add' 곡 넣음 · 'peck' 라디오 쪼기(쪼는 순간 풀림) · 'poke' 눌림(찌부·부끄·깜짝·벌러덩 중 하나) · 'angry' 금지곡 · 'cheer' 새 곡
    penguinAct(kind = 'add') {
      const now = performance.now();
      if (kind === 'add') { go('add', now, 1900); return Promise.resolve(); }
      if (kind === 'peck') return new Promise((ok) => { P.tx = RX + BW / 2 + 64; P.real = ok; go('topeck', now, 9000); });
      if (kind === 'angry') { go('angry', now, 2600); return 'angry'; }
      if (kind === 'cheer') { if (!['peck', 'topeck', 'add', 'angry', 'slide'].includes(P.st)) go(P.st === 'sleep' ? 'boing' : 'cheer', now, P.st === 'sleep' ? 900 : 1500); return 'cheer'; }
      if (['peck', 'topeck', 'add', 'angry'].includes(P.st)) return 'busy';
      const r = ['squish', 'squish', 'shy', 'boing', 'flop'][(Math.random() * 5) | 0]; go(r, now, { squish: 1300, shy: 1800, boing: 900, flop: 2600 }[r]); return r;
    },
    penguinAt() { const [x, y] = headPos(); const px = ox + x * S, py = oy + y * S; return { x: px, y: py, on: px > 0 && px < cw && py > 0 && py < ch }; },
    dispose() { alive = false; removeEventListener('resize', resize); },
  });
}
