// 잼 모드 카세트 라디오(3D). three r170(../3d), 앞면 그림은 tapes/*.webp(Stitch 시안 "Cassette Front Cover Designs"에서 잘라냄, 2026-11-12)
// createBoombox(canvas, base) → { setTape(key), insert(), eject(), setDoor(open), setPlaying(on), setProgress(0~1), press(key, down), onKey, keys, resize(), dispose() }
// 좌표: +Y 위 +Z 앞. 본체 2.3 x 1.7 x 0.72. 카세트 칸 중심 (-0.47, 0), 문은 아래 경첩으로 열림(0.46 rad)
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../3d/geometries/RoundedBoxGeometry.js';
import { buildSea } from './sea.js';

export const TAPES = ['mondrian', 'enso', 'jack', 'prism', 'wave', 'target', 'bauhaus', 'pastel', 'popart', 'holo', 'galaxy', 'stripes70', 'sunburst', 'marble', 'brutal', 'checker', 'memphis', 'acrylic'];
// 잼마다 다른 카세트: 잼 id로 고르고 바로 앞 잼과 겹치지 않게
export function tapeFor(id, prev) {
  let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let k = TAPES[(h >>> 0) % TAPES.length]; if (k === prev) k = TAPES[(TAPES.indexOf(k) + 1) % TAPES.length]; return k;
}

export async function createBoombox(canvas, base) {
await Promise.race([Promise.all(['700 64px "Space Grotesk"', '600 30px "JetBrains Mono"', '700 18px "JetBrains Mono"'].map((f) => document.fonts.load(f))), new Promise((r2) => setTimeout(r2, 3000))]);
const SHELLS = await (await fetch(base + 'tapes/shell.json')).json();
const IMGS = {}; await Promise.all(Object.keys(SHELLS).map((k) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = base + 'tapes/' + k + '.webp'; IMGS[k] = im; })));
const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false; // 그림자는 frame()에서 2번에 한 번
const scene = new THREE.Scene(); 
// 반사 환경: 밝은 스튜디오(위 소프트박스 + 옆 스트립)
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x9a9ca0, side: THREE.BackSide })));
  const box = (w, h, x, y, z, rx, ry, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
  box(10, 3, 0, 6, 2, Math.PI / 2, 0, 4); box(1.5, 6, -6, 2, 2, 0, Math.PI / 2, 2.5); box(1.5, 6, 6, 2, 1, 0, -Math.PI / 2, 2); box(14, 4, 0, -4, 6, -0.3, 0, 1.4);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(env, 0.02).texture;
}
const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-2, 4, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); // 화면을 세로 340px로 그리니 1024면 충분(2048은 그림자만 4배 무거움)
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); key.shadow.radius = 6; scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.87; floor.receiveShadow = true; scene.add(floor);

const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const std = (o) => new THREE.MeshStandardMaterial(o);
const brushed = tex(1024, 1024, (g, w, h) => { g.fillStyle = '#c3c6ca'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = 170 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.1 + Math.random() * 0.2})`; g.fillRect(Math.random() * w - 300, Math.random() * h, 200 + Math.random() * 800, 0.7 + Math.random()); } });
const silver = new THREE.MeshPhysicalMaterial({ color: 0xd6d8dc, map: brushed, metalness: 0.75, roughness: 0.38, clearcoat: 0.15 });
const silverDark = std({ color: 0xa9adb2, metalness: 0.8, roughness: 0.35 });
const chrome = std({ color: 0xffffff, metalness: 1, roughness: 0.1 });
const black = std({ color: 0x1b1c1f, metalness: 0.2, roughness: 0.55 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false });

const R = new THREE.Group(); scene.add(R);
const BW = 2.3, BH = 1.7, BD = 0.72, FZ = BD / 2; // 본체 폭·높이·깊이, 앞면 z
const add = (m, x, y, z, p = R) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
// 본체
add(new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 6, 0.07), silver), 0, 0, 0);
// 앞 테두리 홈(본체 둘레 가는 선)
const seam = std({ color: 0x6f7378, metalness: 0.6, roughness: 0.5 });
add(new THREE.Mesh(new THREE.BoxGeometry(BW - 0.02, 0.008, 0.02), seam), 0, 0.5, FZ - 0.004);

// ---- 위 띠: 투명 플라스틱 아래 다이얼 창 + 오른쪽 밴드 스위치 ----
const dial = tex(2048, 220, (g, w, h) => {
  g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d9dbe0'; g.font = '600 30px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
  g.fillText('FM', 30, 60); g.fillText('AM', 30, 160);
  const fm = [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108], am = [530, 600, 700, 800, 1000, 1200, 1400, 1600];
  fm.forEach((f, i) => { const x = 150 + i * 180; g.fillRect(x, 82, 3, 20); g.fillText(String(f), x - 18, 50); });
  am.forEach((f, i) => { const x = 150 + i * 255; g.fillRect(x, 120, 3, 20); g.fillText(String(f), x - 26, 170); });
  for (let x = 150; x < 1980; x += 18) g.fillRect(x, 92, 1.5, 10);
  g.fillStyle = '#7d8086'; g.fillRect(140, 104, 1850, 2);
  g.fillStyle = '#e8332a'; g.fillRect(820, 18, 6, 186); // 바늘
  g.fillStyle = '#9ea2a8'; g.font = '600 24px "JetBrains Mono", monospace'; g.fillText('MHz', 1990 - 60, 40); g.fillText('kHz', 1990 - 60, 190);
});
add(new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.2), std({ map: dial, roughness: 0.3, metalness: 0.1 })), -0.12, 0.68, FZ + 0.004);
add(new THREE.Mesh(new RoundedBoxGeometry(2.05, 0.32, 0.08, 3, 0.03), glass), -0.03, 0.66, FZ + 0.015); // 투명 덮개
// 밴드 스위치(오른쪽 위)
add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.01), black), 1.0, 0.66, FZ + 0.006);
add(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.06, 0.05, 2, 0.01), silverDark), 1.0, 0.71, FZ + 0.03);
// ---- 피아노 건반 6개(REC는 빨간 점) ----
const keyLab = ['REC', 'PLAY', 'REW', 'FF', 'STOP/EJ', 'PAUSE'];
const keyM = {};
keyLab.forEach((t, i) => {
  const k = keyM[t] = add(new THREE.Mesh(new RoundedBoxGeometry(0.105, 0.07, 0.11, 2, 0.012), std({ color: 0xe9eaec, metalness: 0.5, roughness: 0.3 })), -0.83 + i * 0.112, 0.47, FZ + 0.025);
  const lab = tex(128, 64, (g) => { g.fillStyle = '#e9eaec'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#2a2c30'; g.font = '700 18px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText(t, 64, 40); if (i === 0) { g.fillStyle = '#d4232a'; g.beginPath(); g.arc(64, 14, 7, 0, 7); g.fill(); } });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.045), std({ map: lab, roughness: 0.4 })), 0, -0.005, 0.0565, k);
});
add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.02), black), -0.55, 0.43, FZ + 0.002); // 건반 아래 그림자 홈

// ---- 상표 자리: T/L/L ----
const badge = tex(512, 96, (g) => { g.clearRect(0, 0, 512, 96); g.fillStyle = '#2b2d31'; g.font = '700 64px "Space Grotesk", sans-serif'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = '8px'; g.fillText('T/L/L', 4, 50); });
add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), std({ map: badge, transparent: true, metalness: 0.6, roughness: 0.3 })), -0.73, 0.32, FZ + 0.002);

// ---- 카세트 테이프(진짜 3D): 속이 빈 껍데기(앞뒤 면은 창·릴 구멍이 뚫린 텍스처) + 감긴 테이프 + 릴 + 나사 ----
const CW = 0.62, CH = 0.394, CD = 0.058, PX = 1024 / CW;
const STY = {
  classic: { shell: '#2a2b2f', label: '#f3f1ea', band: '#f07a2a', ink: '#2b2d31', reel: '#ecebe6', name: 'JAM · 11.12' },
  clear: { shell: 'rgba(170,180,190,0.22)', clear: true, label: '#f5f4ef', band: '#f07a2a', ink: '#f07a2a', reel: '#f07a2a', name: 'JAM 11.12' },
  white: { shell: '#ecebe7', label: '#ffffff', band: '#1f3a6b', band2: '#c8402e', band3: '#e0a92a', ink: '#1f3a6b', reel: '#2a2b2f', name: 'JAM  11·12' },
  kraft: { shell: '#1c1d20', label: '#c9a679', ink: '#2a1f17', reel: '#ecebe6', name: 'jam — 11.12', hand: true },
};
for (const k in STY) delete STY[k];
for (const k in SHELLS) STY[k] = { img: k, shell: SHELLS[k], reel: '#e9e8e3', iri: k === 'holo', metal: k === 'chrome' };
STY.acrylic = { shell: 'rgba(200,205,210,0.18)', clear: true, reel: '#c9a24a', brass: true, art: null };
const HUB0 = [[-0.135, 0.02], [0.135, 0.02]], HUBI = [[-205 / PX, 24 / PX], [205 / PX, 24 / PX]];
let HUB = HUB0;
function cassette(st) {
  const S = STY[st], G = new THREE.Group(); G.userData.key = st; HUB = S.img ? HUBI : HUB0;
  const hx = (i) => 512 + HUB[i][0] * PX, hy = (i) => 326 - HUB[i][1] * PX;
  const face = (back) => tex(1024, 652, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (S.img) {
      g.save(); g.beginPath(); g.roundRect(0, 0, w, h, 34); g.clip();
      if (back) { g.fillStyle = S.shell; g.fillRect(0, 0, w, h); } else g.drawImage(IMGS[S.img], 0, 0, w, h);
      g.restore(); g.globalCompositeOperation = 'destination-out';
      for (const i of [0, 1]) { g.beginPath(); g.arc(hx(i), hy(i), back ? 46 : 56, 0, 7); g.fill(); }
      if (!back) { g.beginPath(); g.rect(408, 254, 204, 98); g.fill(); }
      g.globalCompositeOperation = 'source-over'; return;
    }
    g.fillStyle = S.shell; g.beginPath(); g.roundRect(0, 0, w, h, 30); g.fill();
    if (!S.clear) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 3; g.beginPath(); g.roundRect(16, 16, w - 32, h - 32, 24); g.stroke(); }
    if (!back) {
      if ('art' in S) {
        const L = { x: 40, y: 36, w: w - 80, h: 440 };
        if (S.art) { g.save(); g.beginPath(); g.roundRect(L.x, L.y, L.w, L.h, 12); g.clip(); S.art(g, L); g.restore(); }
        // 손글씨 띠(잼 날짜)
        if (S.art) { g.save(); g.translate(L.x + 30, L.y + 22); g.rotate(-0.025); g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 250, 50); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 50, 250, 3);
        g.fillStyle = '#2a1f17'; g.font = '600 42px "Caveat", cursive'; g.fillText('jam 11.12', 16, 39); g.restore(); }
      }
      else if (S.clear) { g.fillStyle = S.label; g.beginPath(); g.roundRect(80, 52, w - 160, 120, 10); g.fill(); g.fillStyle = S.ink; g.font = '700 46px "Space Grotesk", sans-serif'; g.fillText(S.name, 110, 128); g.font = '700 26px "JetBrains Mono", monospace'; g.fillText('A', w - 130, 100); }
      else {
        g.fillStyle = S.label; g.beginPath(); g.roundRect(70, 50, w - 140, 400, 12); g.fill();
        if (S.hand) { g.strokeStyle = 'rgba(80,55,30,.35)'; g.lineWidth = 2; for (let y = 120; y < 440; y += 46) { if (y > 220 && y < 360) continue; g.beginPath(); g.moveTo(100, y); g.lineTo(w - 100, y); g.stroke(); } g.fillStyle = S.ink; g.font = '600 64px "Caveat", cursive'; g.fillText(S.name, 110, 425); g.font = '600 44px "Caveat", cursive'; g.fillText('side A', 110, 108); }
        else if (S.band2) { g.fillStyle = S.band; g.fillRect(70, 360, w - 140, 26); g.fillStyle = S.band2; g.fillRect(70, 388, w - 140, 26); g.fillStyle = S.band3; g.fillRect(70, 416, w - 140, 26); g.fillStyle = S.ink; g.font = '700 54px "Space Grotesk", sans-serif'; g.fillText(S.name, 100, 125); g.font = '700 26px "JetBrains Mono", monospace'; g.fillText('C·60  A', w - 220, 120); }
        else { g.fillStyle = S.band; g.fillRect(70, 222, w - 140, 112); g.fillStyle = '#5a5c62'; g.font = '700 30px "JetBrains Mono", monospace'; g.fillText('A', 100, 104); g.fillText('C-60', w - 190, 104); g.strokeStyle = '#cfccc2'; g.lineWidth = 2; for (const y of [150, 190]) { g.beginPath(); g.moveTo(100, y); g.lineTo(w - 100, y); g.stroke(); } g.fillStyle = S.ink; g.font = '600 38px "JetBrains Mono", monospace'; g.fillText(S.name, 100, 412); }
      }
    }
    // 릴 띠(어두운 캡슐) — 시안처럼 창·릴을 감싸는 테
    if (!back && !S.clear) { g.fillStyle = '#1c1c1f'; g.beginPath(); g.roundRect(170, 232, 684, 146, 73); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 3; g.stroke(); }
    // 창(뚫림) · 릴 구멍(뚫림)
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.roundRect(390, 262, 244, 84, 12); g.fill();
    for (const i of [0, 1]) { g.beginPath(); g.arc(hx(i), hy(i), 54, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    // 창 테두리
    g.strokeStyle = S.clear ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.45)'; g.lineWidth = 6; g.beginPath(); g.roundRect(390, 262, 244, 84, 12); g.stroke();
    // 아래 사다리꼴 쪽 구멍 5개
    g.fillStyle = S.clear ? 'rgba(20,20,22,.6)' : '#0d0d0f'; for (const x of [300, 420, 512, 604, 724]) { g.beginPath(); g.arc(x, h - 54, x === 512 ? 9 : 13, 0, 7); g.fill(); }
  });
  const shellM = S.iri ? new THREE.MeshPhysicalMaterial({ color: 0xe6e8ee, metalness: 0.55, roughness: 0.18, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 800], clearcoat: 1 }) : S.clear ? new THREE.MeshPhysicalMaterial({ color: 0xaab4be, transparent: true, opacity: 0.3, roughness: 0.08, clearcoat: 1, depthWrite: false }) : std({ color: new THREE.Color(S.shell), roughness: 0.45, metalness: 0.05 });
  const fm = (back) => S.clear ? new THREE.MeshPhysicalMaterial({ map: face(back), transparent: true, roughness: 0.1, clearcoat: 1, depthWrite: false }) : std({ map: face(back), alphaTest: 0.5, roughness: S.metal ? 0.15 : 0.5, metalness: S.metal ? 0.6 : 0, envMapIntensity: S.metal ? 1.2 : 0.35 });
  const shell = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, CD, 3, 0.012), [shellM, shellM, shellM, shellM, fm(false), fm(true)]);
  shell.castShadow = true; G.add(shell);
  // 아래 사다리꼴(헤드 쪽) 돋움
  const tz = new THREE.Shape(); tz.moveTo(-0.2, -CH / 2 + 0.004); tz.lineTo(-0.168, -CH / 2 + 0.075); tz.lineTo(0.168, -CH / 2 + 0.075); tz.lineTo(0.2, -CH / 2 + 0.004);
  const tm = new THREE.Mesh(new THREE.ExtrudeGeometry(tz, { depth: 0.004, bevelEnabled: false }), S.clear ? shellM : std({ color: new THREE.Color(S.shell).multiplyScalar(0.8), roughness: 0.5 }));
  tm.position.z = CD / 2; if (!S.img) G.add(tm);
  // 안: 감긴 테이프 · 릴 · 창 플라스틱
  const brown = new THREE.MeshPhysicalMaterial({ color: 0x3a281d, roughness: 0.35, sheen: 0.6, sheenColor: 0x6b4a33 });
  const reelM = S.brass ? std({ color: 0xc9a24a, metalness: 1, roughness: 0.28 }) : std({ color: new THREE.Color(S.reel), roughness: 0.4 });
  [[0, 0.1], [1, 0.066]].forEach(([i, rr]) => {
    const pk = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, CD * 0.7, 48), brown); pk.scale.set(rr / 0.105, 1, rr / 0.105); G.userData['pk' + i] = pk; pk.rotation.x = Math.PI / 2; pk.position.set(HUB[i][0], HUB[i][1], 0); G.add(pk);
    const hb = new THREE.Group(); hb.position.set(HUB[i][0], HUB[i][1], 0); if (S.img) hb.scale.set(1.12, 1.12, 1); G.add(hb);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, CD * 0.92, 32, 1, true), reelM); ring.rotation.x = Math.PI / 2; hb.add(ring);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.03, 32), reelM); hb.add(disc);
    for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, CD * 0.9), reelM); const an = k * Math.PI / 3; t.position.set(Math.cos(an) * 0.025, Math.sin(an) * 0.025, 0); t.rotation.z = an; hb.add(t); }
    const sr = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.033, 40), std({ color: 0x8a8d93, metalness: 0.5, roughness: 0.4 })); sr.position.z = CD / 2 - 0.006; hb.add(sr);
    G.userData['hub' + i] = hb;
  });
  if (!S.clear) { const bk = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.04, CH - 0.04), std({ color: new THREE.Color(S.shell).multiplyScalar(0.55), roughness: 0.6 })); bk.position.z = -CD / 2 + 0.004; G.add(bk); }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(244 / PX, 84 / PX), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false }));
  win.position.set(0, (326 - (S.img ? 303 : 304)) / PX, CD / 2 - 0.004); if (S.img) win.scale.set(204 / 244, 98 / 84, 1); G.add(win);
  // 나사 5개
  if (!S.img) for (const [x, y] of [[-0.283, 0.17], [0.283, 0.17], [-0.283, -0.17], [0.283, -0.17], [0, -0.172]]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), chrome); sc.rotation.x = Math.PI / 2; sc.position.set(x, y, CD / 2 + (y === -0.172 ? 0.006 : 0.001)); G.add(sc); }
  return G;
}

// ---- 카세트 칸(왼쪽): 은색 테 + 어두운 칸(헤드·캡스턴·릴 축) + 아래 경첩으로 열리는 유리 문 ----
const DX = -0.47, DY = 0.0, DW = 0.84, DH = 0.52, WD = 0.1; // 칸 폭·높이·깊이(앞으로 돋움)
const dark = std({ color: 0x16171a, roughness: 0.75 });
for (const [w, h, x, y] of [[DW, 0.03, 0, DH / 2 - 0.015], [DW, 0.03, 0, -DH / 2 + 0.015], [0.03, DH, -DW / 2 + 0.015, 0], [0.03, DH, DW / 2 - 0.015, 0]])
  add(new THREE.Mesh(new RoundedBoxGeometry(w, h, WD, 2, 0.008), silverDark), DX + x, DY + y, FZ + WD / 2 - 0.004);
for (const [w, h, x, y] of [[DW - 0.06, 0.004, 0, DH / 2 - 0.032], [DW - 0.06, 0.004, 0, -DH / 2 + 0.032], [0.004, DH - 0.06, -DW / 2 + 0.032, 0], [0.004, DH - 0.06, DW / 2 - 0.032, 0]]) add(new THREE.Mesh(new THREE.BoxGeometry(w, h, WD - 0.012), dark), DX + x, DY + y, FZ + WD / 2 - 0.004);
add(new THREE.Mesh(new THREE.BoxGeometry(DW - 0.06, DH - 0.06, 0.004), dark), DX, DY, FZ + 0.002);
// 안쪽 기계: 헤드 · 지움 헤드 · 캡스턴 · 핀치롤러 · 릴 축
add(new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.045, 0.05, 2, 0.008), chrome), DX, DY - 0.2, FZ + 0.03);
add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.04), silverDark), DX - 0.1, DY - 0.205, FZ + 0.025);
for (const sx of [-1, 1]) {
  const cp = add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 12), chrome), DX + sx * 0.17, DY - 0.2, FZ + 0.04); cp.rotation.x = Math.PI / 2;
  const pr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 24), black), DX + sx * 0.17, DY - 0.17, FZ + 0.03); pr.rotation.x = Math.PI / 2;
}
const spindles = [];
for (const i of [0, 1]) {
  const sp = new THREE.Group(); sp.position.set(DX + HUBI[i][0], DY + 0.01 + HUBI[i][1], FZ + 0.004); R.add(sp);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 20), std({ color: 0xe9e8e3, roughness: 0.4 })); c.rotation.x = Math.PI / 2; c.position.z = 0.03; sp.add(c);
  for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.03), std({ color: 0xe9e8e3, roughness: 0.4 })); t.rotation.z = k * Math.PI / 3; t.position.z = 0.045; sp.add(t); }
  spindles.push(sp);
}
// 문: 아래 경첩(칸 앞 아래 모서리)을 축으로 위가 앞으로 기울며 열림. 카세트는 문 안쪽 받침에 끼워져 같이 나온다
const door = new THREE.Group(); door.position.set(DX, DY - DH / 2 + 0.03, FZ + WD - 0.01); R.add(door);
const dIn = new THREE.Group(); dIn.position.y = DH / 2 - 0.03; door.add(dIn); // 문 가운데 기준
const GW = DW - 0.07, GH = DH - 0.07;
for (const [w, h, x, y] of [[GW + 0.02, 0.022, 0, GH / 2], [GW + 0.02, 0.03, 0, -GH / 2 - 0.004], [0.022, GH, -GW / 2, 0], [0.022, GH, GW / 2, 0]])
  add(new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.022, 2, 0.006), silver), x, y, 0, dIn);
add(new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.018, 0.016, 2, 0.006), silverDark), 0, -GH / 2 - 0.004, 0.016, dIn); // 손톱 걸이
const glassFace = new THREE.MeshPhysicalMaterial({ color: 0xe6edf2, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2.4, specularIntensity: 1, depthWrite: false });
const glassEdge = new THREE.MeshPhysicalMaterial({ color: 0x8fb3a8, transparent: true, opacity: 0.7, roughness: 0.05, envMapIntensity: 1.5 });
const pane = add(new THREE.Mesh(new RoundedBoxGeometry(GW, GH, 0.014, 3, 0.004), [glassEdge, glassEdge, glassEdge, glassEdge, glassFace, glassFace]), 0, 0, 0.002, dIn);
pane.castShadow = false; pane.renderOrder = 2;
for (const [x, w, o] of [[-0.16, 0.05, 0.13], [-0.09, 0.016, 0.1]]) { const st = add(new THREE.Mesh(new THREE.PlaneGeometry(w, GH * 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthWrite: false })), x, 0, 0.0095, dIn); st.rotation.z = -0.45; st.castShadow = false; st.renderOrder = 3; }
// 문 안쪽 카세트 받침(위 집게 2개)
for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), silverDark), sx * 0.2, CH / 2 + 0.006 + 0.01, -0.02, dIn);
let tape = null;

// 문 아래 작은 슬라이드 스위치 · 파란 배지 · 작은 글씨
add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.008), black), -0.27, -0.33, FZ + 0.004);
add(new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.03, 0.03, 2, 0.006), silverDark), -0.29, -0.33, FZ + 0.015);
const blue = tex(160, 80, (g) => { g.fillStyle = '#2c5aa8'; g.fillRect(0, 0, 160, 80); g.fillStyle = '#fff'; g.font = '700 34px "Space Grotesk", sans-serif'; g.fillText('JAM', 26, 52); });
add(new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), std({ map: blue, roughness: 0.4 })), -0.79, -0.4, FZ + 0.002);
const fine = tex(1024, 120, (g) => { g.clearRect(0, 0, 1024, 120); g.fillStyle = '#3d4045'; g.font = '600 30px "JetBrains Mono", monospace'; g.fillText('STEREO RADIO CASSETTE-CORDER  SD-02', 8, 44); g.font = '500 24px "JetBrains Mono", monospace'; g.fillStyle = '#62666c'; g.fillText('AUTOMATIC SHUT-OFF · BUILT-IN CONDENSER MIC', 8, 92); });
add(new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.096), std({ map: fine, transparent: true, roughness: 0.4 })), -0.47, -0.62, FZ + 0.002);
// 작은 마이크 구멍
add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 20), black), -0.06, -0.4, FZ + 0.002).rotation.x = Math.PI / 2;

// ---- 스피커(오른쪽): 점 타공 그릴 · 동심원 · 가운데 3갈래 엠블럼 ----
const SX = 0.56, SY = -0.12, SW = 0.98;
const grill = tex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#26272b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#121315';
  for (let y = 10; y < h; y += 15) for (let x = 10 + ((y / 15) % 2) * 7; x < w; x += 15) { g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(200,202,206,.45)'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, 390, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(200,202,206,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 372, 0, 7); g.stroke();
});
add(new THREE.Mesh(new RoundedBoxGeometry(SW + 0.04, SW + 0.04, 0.02, 3, 0.05), silverDark), SX, SY, FZ + 0.004);
add(new THREE.Mesh(new RoundedBoxGeometry(SW, SW, 0.02, 3, 0.045), [black, black, black, black, std({ map: grill, roughness: 0.75, metalness: 0.2 }), black]), SX, SY, FZ + 0.012);
// 가운데 엠블럼: 은색 고리 · 검은 원 · 흰 3갈래
const hub = new THREE.Group(); hub.position.set(SX, SY, FZ + 0.03); R.add(hub);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 16, 64), chrome); hub.add(ring);
hub.add(new THREE.Mesh(new THREE.CircleGeometry(0.118, 48), black));
for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.01), std({ color: 0xf4f4f2, roughness: 0.4 })); sp.geometry.translate(0, 0.055, 0); sp.rotation.z = i * Math.PI * 2 / 3; sp.position.z = 0.006; hub.add(sp); }
{ const cap = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), std({ color: 0xf4f4f2, roughness: 0.4 })); cap.position.z = 0.012; hub.add(cap); }

// ---- 손잡이: 검은 막대 + 양끝 은색 받침 ----
const hY = BH / 2 + 0.2;
const bar = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 2.06, 8, 24), black), 0, hY, -0.05); bar.rotation.z = Math.PI / 2;
for (const sx of [-1.1, 1.1]) {
  add(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.26, 0.09, 2, 0.02), silverDark), sx, BH / 2 + 0.09, -0.05);
  const pv = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 20), chrome), sx, BH / 2 + 0.03, -0.05); pv.rotation.z = Math.PI / 2;
}
// 옆 노브(오른쪽 옆면: 볼륨 · 튜닝)
for (const y of [0.42, 0.1]) { const kn = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 32), black), BW / 2 + 0.03, y, 0.05); kn.rotation.z = Math.PI / 2; }
// 발
for (const x of [-0.95, 0.95]) add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.03, 0.5, 2, 0.01), black), x, -BH / 2 - 0.015, 0);


// ---------- 배경: 어둑한 바다 위 낚싯배, 생선 상자 위의 라디오 (sea.js) ----------
const seaW = buildSea(THREE, { scene, r, R, key, floor, hub, FZ, tex });

// ---------- 카메라 · 그리기 ----------
// 캔버스는 화면 전체(바다가 J카드 뒤까지). 라디오는 setFrame으로 받은 칸(비율) 가운데에 오도록 setViewOffset으로 민다
const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 500);
let aspect = 1, dirty = true, playing = false, prog = 0, last = 0, alive = true, cw = 1, ch = 1;
const look = new THREE.Vector3(0.1, -0.62, 0), ptr = { x: 0, y: 0, tx: 0, ty: 0 }, frameR = { x: 0, y: 0, w: 1, h: 1 };
const LOWRES = 340;
const dir = new THREE.Vector3(-0.27, 0.12, 1).normalize(), TAN = Math.tan(THREE.MathUtils.degToRad(12));
function place() {
  const d = Math.max(6, 3.9 / (2 * TAN * frameR.h), 5.2 / (2 * TAN * aspect * frameR.w)); // 라디오 + 상자 + 등불 + 펭귄이 칸에 들어오게
  cam.position.copy(dir).multiplyScalar(d).add(look); cam.position.x += ptr.x * 0.45; cam.position.y += ptr.y * 0.25; cam.lookAt(look);
  const ox = cw / 2 - (frameR.x + frameR.w / 2) * cw, oy = ch / 2 - (frameR.y + frameR.h / 2) * ch;
  cam.setViewOffset(cw, ch, ox, oy, cw, ch);
}
function setFrame(x, y, w, h) { Object.assign(frameR, { x, y, w: Math.max(0.1, w), h: Math.max(0.1, h) }); dirty = true; }
function resize() {
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
  r.setPixelRatio(Math.max(0.2, Math.min(1, LOWRES / h))); r.setSize(w, h, false); // 세로 LOWRES 픽셀로 그리고 CSS로 키운다(image-rendering: pixelated)
  cw = w; ch = h; aspect = w / h; cam.aspect = aspect; cam.updateProjectionMatrix(); dirty = true;
}
const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

// 트윈: 0→1을 ms 동안. fn(t)
const tweens = new Set();
const tween = (ms, fn) => new Promise((ok) => { tweens.add({ t0: performance.now(), ms, fn, ok }); dirty = true; });
const ease = (t) => 1 - Math.pow(1 - t, 3);
const back = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// 문
const OPEN = 0.46;
let doorA = 0;
const setDoorA = (a) => { doorA = a; door.rotation.x = a; dirty = true; };
async function setDoor(open) {
  const a0 = doorA, a1 = open ? OPEN : 0;
  if (a0 === a1) return;
  await tween(open ? 520 : 360, (t) => setDoorA(a0 + (a1 - a0) * (open ? back(t) : t * t)));
}
// 카세트 바꾸기(문 안쪽 받침에)
const TAPE_AT = new THREE.Vector3(0, 0.01, -0.012 - CD / 2);
function setTape(key) {
  if (tape) dIn.remove(tape);
  tape = key ? cassette(STY[key] ? key : 'mondrian') : null;
  if (tape) { tape.position.copy(TAPE_AT); dIn.add(tape); setProgress(prog); }
  dirty = true;
}
// 넣기: 문 열림 → 카세트가 앞에서 날아와 받침에 꽂힘 → 문 닫힘
async function insert(key, snd) {
  setTape(key); tape.visible = false;
  await setDoor(true); snd && snd('door');
  tape.visible = true;
  const from = new THREE.Vector3(0.1, 0.55, 0.9);
  await tween(620, (t) => { const e = ease(t); tape.position.lerpVectors(from, TAPE_AT, e); tape.rotation.set(-0.5 * (1 - e), 0.35 * (1 - e), 0.12 * (1 - e)); });
  snd && snd('seat');
  await new Promise((ok) => setTimeout(ok, 160));
  await setDoor(false); snd && snd('close');
}
// 꺼내기: 문이 튀어 열리고 카세트가 위로 빠져나감
async function eject(snd) {
  snd && snd('eject');
  await setDoor(true);
  if (tape) {
    const p0 = tape.position.clone(), to = new THREE.Vector3(0.05, 0.95, 1.1);
    await tween(560, (t) => { const e = t * t; tape.position.lerpVectors(p0, to, e); tape.rotation.set(-0.6 * e, -0.3 * e, -0.2 * e); });
    setTape(null);
  }
}
// 건반: 눌림(z 0.022 들어감). PLAY·REC·PAUSE는 걸려 있을 수 있다
const keyZ = {}; for (const k in keyM) keyZ[k] = keyM[k].position.z;
function press(k, down) { const m = keyM[k]; if (!m) return; m.position.z = keyZ[k] - (down ? 0.022 : 0); m.position.y = 0.47 - (down ? 0.006 : 0); dirty = true; }
function tap(k) { press(k, true); setTimeout(() => { if (!latched.has(k)) press(k, false); }, 160); }
const latched = new Set();
function latch(k, on) { on = !!on; if (on === latched.has(k)) return; if (on) latched.add(k); else latched.delete(k); press(k, on); }

// 릴: 감긴 양(진행)에 따라 테이프 덩어리 크기, 재생 중엔 테이프 속도가 일정하게(작은 쪽이 빨리) 돈다
const RMIN = 0.045, RMAX = 0.105;
const rad = (f) => Math.sqrt(RMIN * RMIN + (RMAX * RMAX - RMIN * RMIN) * Math.max(0, Math.min(1, f)));
function setProgress(f) {
  prog = Math.max(0, Math.min(1, f || 0));
  if (tape) { const a = rad(1 - prog) / RMAX, b = rad(prog) / RMAX; tape.userData.pk0.scale.set(a, 1, a); tape.userData.pk1.scale.set(b, 1, b); }
  dirty = true;
}
function setPlaying(on) { playing = !!on; dirty = true; }

// 누르기: 건반 · 문
const ray = new THREE.Raycaster(), pv = new THREE.Vector2();
const api = { onKey: null, onDoor: null, onPenguin: null };
const hitList = () => [...Object.values(keyM), door, seaW.peng.group];
function hit(ev) {
  const b = canvas.getBoundingClientRect();
  pv.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
  ray.setFromCamera(pv, cam);
  const h = ray.intersectObjects(hitList(), true)[0]; if (!h) return null;
  for (let o = h.object; o; o = o.parent) { for (const k in keyM) if (keyM[k] === o) return k; if (o === door) return 'door'; if (o === seaW.peng.group) return 'p'; }
  return null;
}
canvas.addEventListener('pointerdown', (ev) => { const k = hit(ev); if (!k) return; ev.preventDefault(); if (k === 'door') api.onDoor && api.onDoor(); else if (k === 'p') api.onPenguin && api.onPenguin(); else api.onKey && api.onKey(k); });
canvas.addEventListener('pointermove', (ev) => {
  const b = canvas.getBoundingClientRect(); ptr.tx = ((ev.clientX - b.left) / b.width - 0.5) * 2; ptr.ty = ((ev.clientY - b.top) / b.height - 0.5) * -2;
  canvas.style.cursor = hit(ev) ? 'pointer' : ''; dirty = true;
});
canvas.addEventListener('pointerleave', () => { ptr.tx = 0; ptr.ty = 0; dirty = true; });

const still = matchMedia('(prefers-reduced-motion: reduce)');
let frameN = 0;
function frame(now) {
  if (!alive) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  if (document.hidden || !window.MusicJamOn) return; // 잼이 끝나 겹이 숨으면 그리지 않는다(예전엔 끝난 뒤에도 뒤에서 계속 그렸다)
  for (const tw of [...tweens]) { const t = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(t); if (t >= 1) { tweens.delete(tw); tw.ok(); } }
  const busy = tweens.size > 0;
  if (Math.abs(ptr.tx - ptr.x) + Math.abs(ptr.ty - ptr.y) > 0.002 && !still.matches) { ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08; dirty = true; }
  if (now - last < (playing || busy ? 33 : 42)) return; // 바다가 늘 움직이니 계속 그린다: 재생 중 30fps, 아니면 24fps
  seaW.update(now, dt, playing && !!tape);
  if (playing && tape) {
    const v = 0.11 * dt;
    tape.userData.hub0.rotation.z -= v / rad(1 - prog); tape.userData.hub1.rotation.z -= v / rad(prog);
    spindles[0].rotation.z = tape.userData.hub0.rotation.z; spindles[1].rotation.z = tape.userData.hub1.rotation.z;
    if (!still.matches) { const k = 1 + 0.025 * Math.max(0, Math.sin(now / 230)) ** 6; hub.scale.set(k, k, 1); } // 스피커가 박자처럼 살짝 떨림
    dirty = true;
  }
  last = now; dirty = false;
  if (busy || (frameN = (frameN || 0) + 1) % 2 === 0) r.shadowMap.needsUpdate = true;
  place(); r.render(scene, cam);
}
requestAnimationFrame(frame);

return Object.assign(api, {
  setTape, insert, eject, setDoor, setPlaying, setProgress, press, tap, latch, resize, setFrame,
  penguinAct(kind = 'add') { return seaW.peng.act(kind); },
  get penguinState() { return seaW.peng.state; },
  penguinAt() { const v = seaW.peng.head().clone().project(cam); return { x: (v.x + 1) / 2 * cw, y: (1 - v.y) / 2 * ch, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 }; },
  get tapeKey() { return tape ? tape.userData.key : ''; },
  dispose() { alive = false; ro.disconnect(); r.dispose(); },
});
}
