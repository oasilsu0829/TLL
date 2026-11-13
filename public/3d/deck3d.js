/* 음악 앱 3D 턴테이블 (MUS-09). 전부 코드로 만든다(예전 AI 모델 deck.glb는 표면이 거칠어 버림, scripts/deck-model.mjs는 기록용)
   본체(헤어라인 알루미늄) · 플래터(옆면 스트로브 점 4줄) · 매트 · 판 · S자 톤암 · 조작부(START/STOP, 33/45, 볼륨 슬라이더, 큐 레버, 안티스케이팅 다이얼)
   · 스트로브 등 · 바늘 조명 · 45 어댑터 · 톤암 클립 · 고무 발 · RCA 케이블 · 먼지 덮개
   연출: 무지개 반사광, 조명 속 먼지, 판 휨, 스트로브 착시(속도가 맞으면 점이 멈춰 보임), 카메라 숨쉬기, 곡이 바뀔 때 무음 홈이 빛남
   좌표: +Y 위, +Z 화면 앞. 본체 1.77 × 1.44
   바깥(index.html)에서 쓰는 것: window.Deck3D = { ok, setPlaying(on, 진행), setLabel, drop(a, slam), shake, setNight, setTint, setVolume, flashGap,
     onScratch, onButton(kind: start·cue), onVolume(0~100), onSound(kind) }
   WebGL이 안 되면 ok = false 로 두고 예전 CSS 턴테이블을 그대로 쓴다 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from './geometries/RoundedBoxGeometry.js';

const host = document.getElementById('deck3d');
const D = (window.Deck3D = { ok: false });
const PLATTER = new THREE.Vector3(-0.18, 0, -0.035);   // 플래터 중심(세계 좌표)
const PLATE = 0.024;                                   // 본체 윗면 높이
const PL_R = 0.645, PL_TOP = 0.066;                    // 플래터 반지름·윗면
const MAT_R = 0.62, MAT_TOP = PL_TOP + 0.004;          // 고무 매트
const REC_R = 0.6, REC_Y = MAT_TOP + 0.004;            // 판(12인치) 반지름·가운데 높이
const LIFT_ON = 0, LIFT_UP = 0.05;                     // 톤암 들림(라디안): 판 위(바늘이 판에 닿음) · 옮길 때
const ARM_H = 0.15;                                   // 톤암 관 높이(축 기준 세계 높이)
const HEAD = new THREE.Vector3(-0.165, 0, 0.92);        // 축에서 바늘까지(톤암 관절 좌표)
let RPS = 33.333 / 60;                                 // 33⅓ rpm (45 버튼을 누르면 45/60)
const PIV = new THREE.Vector3(0.645, 0, -0.4);         // 톤암 축
const GO_PX = 491, GI_PX = 222;                        // 판 그림(1024px)에서 소리 홈 바깥·안쪽 반지름
const GO_R = REC_R * GO_PX / 512, GI_R = REC_R * GI_PX / 512;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
} catch { renderer = null; }

if (renderer && host) start();

function start() {
  // 해상도: 레티나(2배)를 다 쓰면 픽셀이 4배라 패드·폰에서 버벅인다. 1.5배까지만(2026-11-13)
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // 실제 그림자(판·톤암·본체가 책상에 떨어뜨리는 그림자)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; // 그림자는 움직일 때만 다시 그린다(loop)
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // 반사 환경: 어두운 스튜디오에 길쭉한 소프트박스 3개(금속에 줄무늬 반사가 생겨 은색이 살아난다)
  {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x2a2c31, side: THREE.BackSide })); env.add(room);
    const box = (w, h, x, y, z, ry, rx, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    box(9, 1.6, -1.5, 6, 1.5, 0.3, Math.PI / 2, 0xffffff, 6);     // 위 왼쪽 긴 소프트박스
    box(1.2, 6, 6.5, 2.5, -1, -Math.PI / 2, 0, 0xdfe8ff, 3.5);     // 오른쪽 세로 스트립(차가운 빛)
    box(5, 1, 0, 3, -7, 0, 0, 0xffe2c0, 2.5);                       // 뒤쪽 따뜻한 띠
    box(14, 3, 0, -3, 6, 0, -0.4, 0x8a8f99, 1);                     // 앞쪽 바닥 반사
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.02).texture;
  }
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-1.5, 3, 1.5); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.01; key.shadow.radius = 5;
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 7 });
  // 역광: 뒤에서 본체 윤곽을 따라 가는 빛(조명 모드에서 더 세게)
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.5); rim.position.set(0.6, 1.1, -3); scene.add(rim);
  // 밤 조명: 방 불을 끄고 스트로브 등 · 판 위 따뜻한 조명만(night 0→1로 서서히)
  let night = 0, nightT = 0;
  const spot = new THREE.SpotLight(0xffd8a8, 0, 3.2, 0.42, 0.65, 1.4); spot.position.set(-0.35, 1.9, 0.55);
  spot.target.position.set(-0.18, 0, -0.035); scene.add(spot, spot.target);
  const armLamp = new THREE.PointLight(0xfff1d6, 0, 0.45, 2); armLamp.position.set(0.5, 0.2, 0.42); scene.add(armLamp);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  const deck = new THREE.Group(); scene.add(deck);

  // 헤어라인 결(브러시드 알루미늄): 가로로 가는 줄을 촘촘히
  function brushed() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { const y = Math.random() * 512, v = 180 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.12 + Math.random() * 0.2})`; g.fillRect(Math.random() * 512 - 200, y, 120 + Math.random() * 500, 0.6 + Math.random()); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
  }
  const brush = brushed();
  // 받침(본체 밑 두께): AI 모델은 얇은 판이라 상자를 밑에 댄다. 하이엔드 느낌으로 헤어라인 알루미늄
  const BODY_H = PLATE + 0.165;
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.77, BODY_H, 1.44, 5, 0.035), new THREE.MeshPhysicalMaterial({ color: 0xdfe2e6, map: brush, metalness: 0.82, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.4 }));
  plinth.position.set(0, PLATE - BODY_H / 2, 0); plinth.castShadow = true; plinth.receiveShadow = true; deck.add(plinth);
  // 윗판 단차: 한 단 올라온 판 + 둘레를 깎아 낸 반짝이는 테
  {
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.71, 0.006, 1.38, 2, 0.012), new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, map: brush, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }));
    top.position.set(0, PLATE + 0.001, 0); top.receiveShadow = true; deck.add(top);
    const pol = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 });
    for (const [w, d, x, z] of [[1.71, 0.004, 0, 0.69], [1.71, 0.004, 0, -0.69], [0.004, 1.38, 0.855, 0], [0.004, 1.38, -0.855, 0]]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0065, d), pol); e.position.set(x, PLATE + 0.0012, z); deck.add(e);
    }
    // 위쪽 모서리를 깎아 낸 면(빛이 한 줄로 맺힌다)
    const ch = new THREE.Mesh(new RoundedBoxGeometry(1.775, 0.008, 1.445, 3, 0.004), pol); ch.position.set(0, PLATE - 0.006, 0); deck.add(ch);
  }
  // 고무 발 4개(알루미늄 테 + 검은 고무)
  for (const [fx, fz] of [[-0.74, -0.6], [0.74, -0.6], [-0.74, 0.6], [0.74, 0.6]]) {
    const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 }));
    ft.position.set(fx, -0.165 - 0.015, fz); ft.castShadow = true; deck.add(ft);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.008, 32), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 }));
    rim.position.set(fx, -0.165 - 0.004, fz); deck.add(rim);
  }
  // 앞면 각인: 글자가 파인 것처럼(어두운 글자 + 아래 밝은 테)
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 128; const g = c.getContext('2d');
    const eng = (txt, x, align, size, sp) => {
      g.font = `600 ${size}px "Space Grotesk", "JetBrains Mono", sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = sp + 'px';
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(txt, x, 66);
      g.fillStyle = 'rgba(40,42,48,.78)'; g.fillText(txt, x, 63);
    };
    eng('T/L/L', 90, 'left', 54, 14);
    eng('DIRECT DRIVE TURNTABLE', 520, 'left', 26, 8);
    eng('33⅓ · 45 RPM', 1958, 'right', 30, 8);
    g.fillStyle = 'rgba(40,42,48,.35)'; g.fillRect(470, 46, 2, 36);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.106), new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.6, roughness: 0.4 }));
    face.position.set(0, -0.07, 0.7205); deck.add(face);
  }
  // 책상에 떨어지는 그림자만 그리는 바닥(배경은 비친다)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.196; floor.receiveShadow = true; deck.add(floor);
  // 바닥 그림자
  const sh = document.createElement('canvas'); sh.width = sh.height = 128;
  const sg = sh.getContext('2d'), gr = sg.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.197; deck.add(shadow);

  // 판(레코드): 홈 무늬 + 가운데 라벨을 캔버스 하나에 그린다
  function recordTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { c, t };
  }
  function drawRecord(R, L, img) {
    const g = R.c.getContext('2d'), S = 1024, m = S / 2;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0b0b0e'; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();
    // 소리 홈(GO_PX ~ GI_PX). 곡 사이 무음 홈은 실제 곡 길이 비율 자리에 매끈한 띠로
    for (let r = GI_PX; r < GO_PX; r += 2.2) { g.strokeStyle = `rgba(255,255,255,${0.02 + (Math.sin(r * 0.37) + 1) * 0.013})`; g.lineWidth = 1; g.beginPath(); g.arc(m, m, r, 0, 7); g.stroke(); }
    const gaps = (L && L.tracks) || [];
    const gw = Math.max(1.5, Math.min(7, 280 / Math.max(1, gaps.length))); // 곡이 많으면(긴 플레이리스트) 띠를 가늘게
    for (const f of gaps) {
      const r = GO_PX - f * (GO_PX - GI_PX);
      g.strokeStyle = '#050507'; g.lineWidth = gw; g.beginPath(); g.arc(m, m, r, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 2; g.beginPath(); g.arc(m, m, r + 1.5, 0, 7); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 8; g.beginPath(); g.arc(m, m, GO_PX + 7, 0, 7); g.stroke(); // 들어가는 홈
    const LR = 188;
    g.save(); g.beginPath(); g.arc(m, m, LR, 0, 7); g.clip();
    const mg = !!(L && L.m && img); // 잡지 부록 LP: 잡지사 라벨 그림 그대로(글자 얹지 않음)
    if (mg) g.drawImage(img, m - LR, m - LR, LR * 2, LR * 2);
    else if (img) { g.drawImage(img, m - LR, m - LR, LR * 2, LR * 2); g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(0, 0, S, S); }
    else { g.fillStyle = '#f4f4f5'; g.fillRect(0, 0, S, S); }
    g.restore();
    g.strokeStyle = 'rgba(200,200,205,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(m, m, LR, 0, 7); g.stroke();
    if (mg) { g.fillStyle = '#d4d4d8'; g.beginPath(); g.arc(m, m, 13, 0, 7); g.fill(); g.fillStyle = '#27272a'; g.beginPath(); g.arc(m, m, 5, 0, 7); g.fill(); }
    else {
    g.fillStyle = img ? '#fff' : '#111827'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 22px "JetBrains Mono", monospace'; g.fillText('T/L/L', m, m - 92);
    g.font = '700 40px "Space Grotesk", "Noto Sans KR", sans-serif';
    const name = ((L && L.name) || 'NO RECORD').toUpperCase(), lines = wrap(g, name, 300).slice(0, 2);
    lines.forEach((s, i) => g.fillText(s, m, m - 40 + i * 44));
    g.font = '500 24px "JetBrains Mono", "Noto Sans KR", monospace'; g.globalAlpha = 0.8;
    g.fillText(clip(g, (L && L.artist) || '', 300), m, m + 58 + (lines.length - 1) * 20); g.globalAlpha = 1;
    g.fillStyle = '#d4d4d8'; g.beginPath(); g.arc(m, m + 118, 13, 0, 7); g.fill(); g.fillStyle = '#27272a'; g.beginPath(); g.arc(m, m + 118, 5, 0, 7); g.fill();
    }
    // 판 위 먼지 몇 점(판과 같이 돈다)
    let x = [...((L && L.name) || 'x')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 11) || 11; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, r = GI_PX + rnd() * (GO_PX - GI_PX); g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.45})`; g.beginPath(); g.arc(m + Math.cos(a) * r, m + Math.sin(a) * r, 0.8 + rnd() * 1.6, 0, 7); g.fill(); }
    R.t.needsUpdate = true;
  }
  function wrap(g, s, w) { const out = []; let cur = ''; for (const word of s.split(/\s+/)) { const t = cur ? cur + ' ' + word : word; if (g.measureText(t).width > w && cur) { out.push(cur); cur = word; } else cur = t; } if (cur) out.push(cur); return out.map((x) => clip(g, x, w)); }
  function clip(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
  const imgCache = new Map();
  const imgReady = new Map(); // 다 받은 그림(기다림 없이 바로 쓴다)
  function loadImg(url) {
    if (!url) return Promise.resolve(null);
    if (!imgCache.has(url)) imgCache.set(url, new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => { imgReady.set(url, i); res(i); }; i.onerror = () => res(null); i.src = url; }));
    return imgCache.get(url);
  }
  // 판 = 검은 원기둥(옆·밑) + 윗면 원판(일반 UV라 라벨 글자가 똑바로 보인다)
  function makeRecord() {
    const R = recordTexture();
    const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.45 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(REC_R, REC_R, 0.008, 128), black);
    const top = new THREE.Mesh(new THREE.CircleGeometry(REC_R, 128), new THREE.MeshPhysicalMaterial({ map: R.t, roughness: 0.55, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.35 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.0042;
    body.castShadow = true; top.receiveShadow = true;
    // 실제 LP처럼 가장자리가 살짝 두껍게 말려 올라간 테
    const rim = new THREE.Mesh(new THREE.TorusGeometry(REC_R - 0.004, 0.0045, 8, 128), black); rim.rotation.x = Math.PI / 2; rim.position.y = 0.003;
    g.add(body, top, rim);
    g.rotation.x = 0.004; // 판 휨: 살짝 기운 채로 돌아 출렁여 보인다
    g.userData.R = R; g.userData.mats = [black, top.material];
    return g;
  }

  // 슬리브(앨범 표지)와 클립보드(플레이리스트)
  // 낡음 w(0~1, 많이 들을수록): 링 자국 진하게 · 모서리 하얗게 닳음 · 긁힘
  function wearOn(g, W, H, w, seed) {
    if (!w) return;
    let x = seed || 7; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    g.save();
    g.strokeStyle = `rgba(255,252,245,${0.1 + w * 0.45})`; g.lineWidth = 3 + w * 9; g.beginPath(); g.arc(W / 2, H / 2, W * 0.43, 0, 7); g.stroke();
    const eg = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(255,250,240,${w * 0.7})`); gr.addColorStop(1, 'rgba(255,250,240,0)'); return gr; };
    const e = 10 + w * 26;
    g.fillStyle = eg(0, 0, e, 0); g.fillRect(0, 0, e, H); g.fillStyle = eg(W, 0, W - e, 0); g.fillRect(W - e, 0, e, H);
    g.fillStyle = eg(0, 0, 0, e); g.fillRect(0, 0, W, e); g.fillStyle = eg(0, H, 0, H - e); g.fillRect(0, H - e, W, e);
    g.strokeStyle = `rgba(255,255,255,${w * 0.35})`; g.lineWidth = 1.5;
    for (let i = 0; i < w * 40; i++) { const a = rnd() * W, b = rnd() * H, l = 10 + rnd() * 50, t = rnd() * 6.28; g.beginPath(); g.moveTo(a, b); g.lineTo(a + Math.cos(t) * l, b + Math.sin(t) * l); g.stroke(); }
    g.restore();
  }
  // 판 라벨 그림: 잡지 부록 LP는 잡지사 라벨(sleeves/<m>-l.webp), 나머지는 표지
  const lblSrc = (L) => (L && L.m ? `/mag/sleeves/${L.m}-l.webp` : L && L.img);
  const wearOf = (a) => Math.min(1, ((a && a.p) || 0) / 20);
  const seedOf = (a) => [...String((a && a.id) || 'x')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7) || 7;
  function coverMat(img, a) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#2b2b30'; g.fillRect(0, 0, 512, 512); if (img) g.drawImage(img, 0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 220, 0, 7); g.stroke();
    wearOn(g, 512, 512, wearOf(a), seedOf(a));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }
  function clipMat(a, img) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    const bgd = g.createLinearGradient(0, 0, 512, 512); bgd.addColorStop(0, '#a3723f'); bgd.addColorStop(1, '#77502a');
    g.fillStyle = bgd; g.beginPath(); g.roundRect(0, 0, 512, 512, 26); g.fill();
    g.fillStyle = '#fbfaf5'; g.fillRect(40, 36, 432, 450);
    g.strokeStyle = '#d7e1ee'; g.lineWidth = 2; for (let y = 120; y < 480; y += 34) { g.beginPath(); g.moveTo(40, y); g.lineTo(472, y); g.stroke(); }
    g.strokeStyle = 'rgba(230,0,18,.35)'; g.beginPath(); g.moveTo(66, 36); g.lineTo(66, 486); g.stroke();
    if (img) { g.save(); g.translate(400, 120); g.rotate(0.05); g.drawImage(img, -50, -50, 100, 100); g.restore(); }
    g.fillStyle = '#1f2430'; g.font = '700 38px "Space Grotesk", "Noto Sans KR", sans-serif'; g.textBaseline = 'top';
    wrap(g, a.name || '플레이리스트', 290).slice(0, 2).forEach((s, i) => g.fillText(s, 80, 80 + i * 42));
    g.fillStyle = '#6b7280'; g.font = '500 22px "JetBrains Mono", monospace'; g.fillText(clip(g, [a.artist, a.n ? a.n + '곡' : ''].filter(Boolean).join(' · '), 290), 80, 172);
    g.fillStyle = '#b9c0cb'; [0.78, 0.62, 0.84, 0.55, 0.7, 0.48, 0.66].forEach((w, i) => g.fillRect(80, 232 + i * 34, 360 * w, 9));
    const cg = g.createLinearGradient(0, 0, 0, 64); cg.addColorStop(0, '#fafafa'); cg.addColorStop(0.5, '#a1a1aa'); cg.addColorStop(1, '#e4e4e7');
    g.fillStyle = cg; g.beginPath(); g.roundRect(170, 0, 172, 62, 14); g.fill();
    // 많이 튼 플레이리스트: 커피 자국
    const w = wearOf(a);
    if (w > 0.25) { g.strokeStyle = `rgba(120,72,30,${0.15 + w * 0.3})`; g.lineWidth = 8; g.beginPath(); g.arc(360, 380, 62, 0.3, 5.9); g.stroke(); g.fillStyle = `rgba(120,72,30,${w * 0.08})`; g.beginPath(); g.arc(360, 380, 58, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }
  const side = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });

  // 플래터: 알루미늄 원판(옆면에 스트로브 점 4줄) + 고무 매트 + 가운데 축 + 밑 그림자
  // 스트로브 점: 오디오테크니카·테크닉스 플래터 테두리의 땡땡이 4줄(50/60Hz × 33/45). 비스듬한 테두리라 위에서도 보인다
  function strobeTexture() {
    const c = document.createElement('canvas'); c.width = 4096; c.height = 256; const g = c.getContext('2d');
    const al = g.createLinearGradient(0, 0, 0, 256); al.addColorStop(0, '#9da1a8'); al.addColorStop(0.5, '#7d8188'); al.addColorStop(1, '#6a6e75');
    g.fillStyle = al; g.fillRect(0, 0, 4096, 256);
    [[118, 38], [121, 96], [90, 154], [88, 212]].forEach(([n, y]) => {
      const w = 4096 / n, dw = w * 0.5, dh = 34;
      for (let i = 0; i < n; i++) {
        const x = i * w + (w - dw) / 2;
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 2, y - dh / 2 + 3, dw, dh);
        const dg = g.createLinearGradient(0, y - dh / 2, 0, y + dh / 2); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.55, '#e4e6ea'); dg.addColorStop(1, '#b8bcc2');
        g.fillStyle = dg; g.fillRect(x, y - dh / 2, dw, dh);
      }
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function buildPlatter(node) {
    const H = PL_TOP - PLATE - 0.006;
    // 플래터 윗면: 선반으로 깎은 동심원 결
    const lc = document.createElement('canvas'); lc.width = lc.height = 1024; const lg = lc.getContext('2d');
    lg.fillStyle = '#cfd3d8'; lg.fillRect(0, 0, 1024, 1024);
    for (let r = 2; r < 512; r += 1.6) { const v = 190 + Math.random() * 60 | 0; lg.strokeStyle = `rgba(${v},${v + 2},${v + 6},.5)`; lg.lineWidth = 0.9; lg.beginPath(); lg.arc(512, 512, r, 0, 7); lg.stroke(); }
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    const alu = new THREE.MeshStandardMaterial({ color: 0xe1e4e8, map: lt, metalness: 0.9, roughness: 0.22 });
    strobeTex = strobeTexture(); strobeTex.wrapS = THREE.RepeatWrapping;
    const sideM = new THREE.MeshStandardMaterial({ map: strobeTex, metalness: 0.75, roughness: 0.35 });
    // 옆면을 바깥으로 벌려(위 0.645 → 아래 0.69) 땡땡이 테두리가 위에서 보이게
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(PL_R, PL_R + 0.045, H, 160, 1), [sideM, alu, alu]);
    pl.position.y = PL_TOP - H / 2; node.add(pl);
    // 스트로브 등(앞 왼쪽 본체 위, 빨간 불이 땡땡이를 비춘다)
    const lampAt = new THREE.Vector3(-0.726, 0, 0.688).multiplyScalar(0.79).add(PLATTER);
    // 스트로브 등: 크롬 받침 · 홈 파인 몸통 · 위에 빨간 렌즈(플래터 쪽을 본다)
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.043, 0.008, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 }));
    lampBase.position.set(lampAt.x, PLATE + 0.004, lampAt.z); deck.add(lampBase);
    const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0xdcdfe3, metalness: 0.8, roughness: 0.3 }));
    lampBody.position.set(lampAt.x, PLATE + 0.033, lampAt.z); deck.add(lampBody);
    for (const yy of [0.02, 0.03, 0.04]) { const gr2 = new THREE.Mesh(new THREE.TorusGeometry(0.0295, 0.0018, 6, 32), new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: 0.5, roughness: 0.5 })); gr2.rotation.x = Math.PI / 2; gr2.position.set(lampAt.x, PLATE + yy, lampAt.z); deck.add(gr2); }
    const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.008, 32), new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.5 })); cap2.position.set(lampAt.x, PLATE + 0.062, lampAt.z); deck.add(cap2);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff2010, emissiveIntensity: 1.6 }));
    lens.position.set(lampAt.x + 0.02, PLATE + 0.046, lampAt.z - 0.019); deck.add(lens);
    const glow = new THREE.PointLight(0xff3020, 0.35, 0.5, 2); glow.position.set(lampAt.x + 0.03, PLATE + 0.05, lampAt.z - 0.03); deck.add(glow); D._glow = glow;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(PL_R - 0.003, 0.004, 8, 128), alu); lip.rotation.x = Math.PI / 2; lip.position.y = PL_TOP - 0.001; node.add(lip);
    // 고무 매트: 동심원 무늬
    const mc = document.createElement('canvas'); mc.width = mc.height = 512; const mg = mc.getContext('2d');
    mg.fillStyle = '#1c1d21'; mg.fillRect(0, 0, 512, 512);
    for (let r = 30; r < 256; r += 9) { mg.strokeStyle = r % 27 < 9 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.35)'; mg.lineWidth = 3; mg.beginPath(); mg.arc(256, 256, r, 0, 7); mg.stroke(); }
    const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
    const matTop = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.95 }), matSide = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.95 });
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(MAT_R, MAT_R, 0.004, 128), [matSide, matTop, matSide]);
    mat.position.y = PL_TOP + 0.002; node.add(mat);
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06 }));
    spindle.position.y = REC_Y + 0.02; node.add(spindle);
    // 본체 위 접지 그림자(돌지 않게 deck에 붙인다)
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 100, 128, 128, 128); rg.addColorStop(0, 'rgba(0,0,0,.42)'); rg.addColorStop(0.85, 'rgba(0,0,0,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    const shd = new THREE.Mesh(new THREE.PlaneGeometry(PL_R * 2.3, PL_R * 2.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    shd.rotation.x = -Math.PI / 2; shd.position.set(PLATTER.x, PLATE + 0.0055, PLATTER.z); deck.add(shd);
  }

  // 톤암: AI 톤암은 납작한 부조라 비스듬히 보면 휘어 보여서 숨기고 코드로 새로 만든다(S자 관 · 기둥 · 무게추 · 헤드셸 · 카트리지 · 받침대)
  function buildArm(lift, yawNode) {
    // armLift 노드 자체가 AI 톤암 메시라 visible을 끄면 자식(새 톤암)까지 숨는다 → 재질만 안 보이게
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8eaed, metalness: 0.95, roughness: 0.18 });
    const satin = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 0.8, roughness: 0.38 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1d1f24, metalness: 0.2, roughness: 0.55 });
    const add = (m, x, y, z, parent = lift) => { m.position.set(x, y, z); parent.add(m); return m; };
    // ---- 톤암 받침(본체 고정): 2단으로 깎은 받침 · 나사 6개 · 높이 조절 링(톱니 + 눈금) · 고정 레버 · 들림 받침대 ----
    const polish = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.09 });
    const B = (geo, m, x, y, z, parent = deck) => add(new THREE.Mesh(geo, m), PIV.x + x, y, PIV.z + z, parent);
    B(new THREE.CylinderGeometry(0.128, 0.134, 0.012, 72), satin, 0, PLATE + 0.006, 0);
    const e1 = B(new THREE.TorusGeometry(0.129, 0.0022, 8, 96), polish, 0, PLATE + 0.012, 0); e1.rotation.x = Math.PI / 2;
    B(new THREE.CylinderGeometry(0.088, 0.094, 0.012, 64), satin, 0, PLATE + 0.018, 0);
    const e2 = B(new THREE.TorusGeometry(0.089, 0.002, 8, 72), polish, 0, PLATE + 0.024, 0); e2.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      B(new THREE.CylinderGeometry(0.0065, 0.0065, 0.003, 16), polish, Math.cos(a) * 0.111, PLATE + 0.0135, Math.sin(a) * 0.111);
      const sl = B(new THREE.BoxGeometry(0.009, 0.0012, 0.0013), black, Math.cos(a) * 0.111, PLATE + 0.0152, Math.sin(a) * 0.111); sl.rotation.y = a;
    }
    // 높이 조절 링: 톱니 + 숫자 눈금
    const kc = document.createElement('canvas'); kc.width = 1024; kc.height = 128; const kg = kc.getContext('2d');
    kg.fillStyle = '#b9bdc3'; kg.fillRect(0, 0, 1024, 128);
    for (let i = 0; i < 128; i++) { kg.fillStyle = i % 2 ? '#e9ebee' : '#8d9198'; kg.fillRect(i * 8, 0, 4, 60); }
    kg.fillStyle = '#1d1f24'; kg.font = '700 28px "JetBrains Mono", monospace'; kg.textAlign = 'center';
    for (let i = 0; i < 24; i++) { const xx = i * 42.7 + 20; kg.fillRect(xx, 68, 2, i % 2 ? 10 : 18); if (i % 4 === 0) kg.fillText(String(i / 4), xx + 1, 116); }
    const kt = new THREE.CanvasTexture(kc); kt.colorSpace = THREE.SRGBColorSpace; kt.anisotropy = 4;
    B(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 72), [new THREE.MeshStandardMaterial({ map: kt, metalness: 0.8, roughness: 0.3 }), satin, satin], 0, PLATE + 0.039, 0);
    const e3 = B(new THREE.TorusGeometry(0.062, 0.0018, 8, 72), polish, 0, PLATE + 0.054, 0); e3.rotation.x = Math.PI / 2;
    // 고정 레버(링 옆으로 튀어나온 막대 + 공)
    const lockA = 2.4, lk = B(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 10), polish, Math.cos(lockA) * 0.085, PLATE + 0.045, Math.sin(lockA) * 0.085);
    lk.rotation.z = Math.PI / 2; lk.rotation.y = -lockA;
    B(new THREE.SphereGeometry(0.009, 14, 10), black, Math.cos(lockA) * 0.11, PLATE + 0.045, Math.sin(lockA) * 0.11);
    // 들림 받침대(큐 레버가 올리는 가로대, 관 아래)
    B(new THREE.CylinderGeometry(0.009, 0.011, ARM_H - 0.045 - PLATE, 14), chrome, 0.06, PLATE + (ARM_H - 0.045 - PLATE) / 2, 0.15);
    const bar = B(new THREE.BoxGeometry(0.075, 0.008, 0.012), black, 0.035, ARM_H - 0.043, 0.15); void bar;
    // ---- 돌아가는 부분: 기둥 · 짐벌 요크(양쪽 받침 + 베어링 캡) ----
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.016, 40), satin), 0, PLATE + 0.062, 0, yawNode);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, ARM_H - PLATE - 0.09, 28), chrome), 0, PLATE + 0.07 + (ARM_H - PLATE - 0.09) / 2, 0, yawNode);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.05), satin), 0, ARM_H - 0.032, 0, yawNode);
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.05), satin), sx * 0.058, ARM_H - 0.006, 0, yawNode);
      const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 24), polish), sx * 0.071, ARM_H, 0, yawNode); cap.rotation.z = Math.PI / 2;
      const dot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.013, 12), black), sx * 0.072, ARM_H, 0, yawNode); dot.rotation.z = Math.PI / 2;
    }
    // 무게추 눈금(숫자 링)
    const cwc = document.createElement('canvas'); cwc.width = 512; cwc.height = 64; const cg2 = cwc.getContext('2d');
    cg2.fillStyle = '#cfd2d6'; cg2.fillRect(0, 0, 512, 64); cg2.fillStyle = '#1d1f24'; cg2.font = '700 26px "JetBrains Mono", monospace'; cg2.textAlign = 'center';
    for (let i = 0; i < 20; i++) { const xx = i * 25.6 + 12; cg2.fillRect(xx, 0, 2, i % 5 ? 14 : 24); if (i % 5 === 0) cg2.fillText(String((i / 5) % 4), xx + 1, 54); }
    const cwt = new THREE.CanvasTexture(cwc); cwt.colorSpace = THREE.SRGBColorSpace;
    // 짐벌 안쪽(톤암과 같이 들린다): 가로축 + 블록
    const ax = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.13, 12), chrome), 0, ARM_H, 0); ax.rotation.z = Math.PI / 2;
    add(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.05, 0.06, 2, 0.01), satin), 0, ARM_H, 0);
    // 뒤쪽 축대와 무게추
    const stub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.17, 16), chrome), 0, ARM_H, -0.1); stub.rotation.x = Math.PI / 2;
    const cw = add(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.095, 40), satin), 0, ARM_H, -0.165); cw.rotation.x = Math.PI / 2;
    for (const z of [-0.205, -0.125]) { const st = add(new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0025, 8, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 })), 0, ARM_H, z); void st; }
    const cwEnd = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 32), black), 0, ARM_H, -0.218); cwEnd.rotation.x = Math.PI / 2;
    const cwr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.016, 48), [new THREE.MeshStandardMaterial({ map: cwt, metalness: 0.5, roughness: 0.4 }), black, black]), 0, ARM_H, -0.128); cwr.rotation.x = Math.PI / 2;
    // S자 관: 축 → 앞으로 곧게 → 끝에서 안쪽으로 휜다
    const hx = HEAD.x, hz = HEAD.z;
    // S자: 축에서 곧게 나와 → 가운데에서 바깥(+x)으로 살짝 부풀고 → 앞쪽에서 판 안쪽으로 크게 휘었다가 → 끝에서 다시 펴져 헤드셸에 붙는다
    const end = new THREE.Vector3(hx + 0.04, ARM_H - 0.016, hz - 0.125);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, ARM_H, 0.03), new THREE.Vector3(0.004, ARM_H, 0.22), new THREE.Vector3(0.026, ARM_H - 0.002, 0.42),
      new THREE.Vector3(0.022, ARM_H - 0.005, 0.56), new THREE.Vector3(-0.03, ARM_H - 0.009, 0.68), new THREE.Vector3(-0.09, ARM_H - 0.013, 0.74),
      new THREE.Vector3(end.x + 0.012, end.y, end.z - 0.03), end,
    ], false, 'centripetal');
    lift.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.021, 18, false), chrome));
    // 헤드셸(관 끝에서 비스듬히) + 카트리지 + 손잡이
    const hs = new THREE.Group(); hs.position.copy(end); hs.rotation.y = -0.4; lift.add(hs);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.015, 0.155), black), 0, 0, 0.075, hs);
    const cart = add(new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.036, 0.07), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.45 })), 0, -0.025, 0.092, hs);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.028), black), 0, -0.047, 0.108, hs);
    const fl = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.016), chrome), 0.05, 0.006, 0.11, hs); fl.rotation.z = 0.35;
    // 바늘 끝(헤드셸 기준 -0.054)이 판 윗면(REC_Y + 0.004 = 0.078)에 닿도록 ARM_H = 0.078 + 0.016 + 0.054 + 여유
    void cart;
    // 받침대(쉴 때 관이 얹히는 기둥) — 본체에 고정
    const restW = new THREE.Vector3(0.012, 0, 0.45).add(yawNode.position);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, ARM_H - 0.03 - PLATE, 16), satin), restW.x, PLATE + (ARM_H - 0.03 - PLATE) / 2, restW.z, deck);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.012, 0.03), black), restW.x, ARM_H - 0.026, restW.z, deck);
    // 톤암 클립: 쉴 때 관을 잡고, 재생하면 열린다
    for (const sgn of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.022), satin);
      c.geometry.translate(0, 0.015, 0); c.position.set(restW.x + sgn * 0.024, ARM_H - 0.02, restW.z); deck.add(c); clips.push({ m: c, sgn });
    }
  }

  let parts = null, record = null, label = null, labelKey = '';
  let playing = false, progress = 0, spin = 0, vel = 0, yaw = 0, lift = 0;
  let drop = null; // { t0, slam, sleeve, disc, done }
  let grab = null;  // { phi, spin0, t, last, v } 판을 손으로 잡은 상태
  let shakeT = -1;
  let strobeTex = null, strobeAng = 0;
  const clips = [], clickables = [];
  let speed45 = false, volume = 50, cueUp = 1, coverK = 0, coverT = 0, idle = 0, dragCtl = null;
  // 마지막으로 뭔가 바뀐 시각(만짐·라벨·색·볼륨…). 2초 넘게 조용하면 프레임을 낮춘다(배터리)
  let poke = 0, touchAt = 0; // poke: 깨우기(시간창 글자 등), touchAt: 손으로 만진 시각
  // 판을 간 뒤 음악 전 손놀림: cue = 'spin'(플래터만 돎) · 'lead'(톤암을 들어 판 가장자리 위로) · 'down'(큐 레버를 내려 바늘이 천천히 내려감). null이면 재생 상태를 따름
  let cue = null, brushT0 = -1, dustBrush = null;

  // ---------- 조작부 ----------
  const satinM = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 0.8, roughness: 0.38 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1d1f24, metalness: 0.25, roughness: 0.5 });
  function labelTex(lines, w = 256, h = 96, size = 30) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#26282d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e4e6ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${size}px "Space Grotesk", "JetBrains Mono", sans-serif`; lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function engrave(text, x, z, w, size = 34) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
    g.font = `600 ${size}px "Space Grotesk", "JetBrains Mono", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(text, 256, 34); g.fillStyle = 'rgba(40,42,48,.75)'; g.fillText(text, 256, 31);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8), new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.5, roughness: 0.4, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, PLATE + 0.0048, z); deck.add(m); return m;
  }
  const ctl = {};
  function buildControls() {
    // START/STOP: 크고 납작한 사각 버튼
    const sb = new THREE.Group(); sb.position.set(-0.615, PLATE, 0.645); deck.add(sb);
    const bez = new THREE.Mesh(new RoundedBoxGeometry(0.142, 0.006, 0.07, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); bez.position.y = 0.004; sb.add(bez);
    const well = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.008, 0.06), darkM); well.position.y = 0.004; sb.add(well);
    // 전원 LED(재생 중 초록)
    const pled = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1b3a22, emissive: 0x33ff77, emissiveIntensity: 0 })); pled.position.set(-0.058, 0.006, -0.05); sb.add(pled); ctl.pled = pled;
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.05), [satinM, satinM, new THREE.MeshStandardMaterial({ map: labelTex(['START·STOP'], 256, 108, 34), metalness: 0.4, roughness: 0.45 }), satinM, satinM, satinM]);
    btn.position.y = 0.012; btn.userData.act = 'start'; sb.add(btn); clickables.push(btn); ctl.start = btn;
    // 33 / 45: 둥근 버튼 + 불 들어오는 테
    ctl.speed = {};
    for (const [k, x] of [['s33', -0.5], ['s45', -0.44]]) {
      const g = new THREE.Group(); g.position.set(x, PLATE, 0.645); deck.add(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.003, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3a3c42, emissive: 0xff5a2a, emissiveIntensity: 0 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; g.add(ring);
      const bz = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0028, 10, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); bz.rotation.x = Math.PI / 2; bz.position.y = 0.006; g.add(bz);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 32), [satinM, new THREE.MeshStandardMaterial({ map: labelTex([k === 's33' ? '33' : '45'], 128, 128, 56), metalness: 0.4, roughness: 0.45 }), satinM]);
      b.position.y = 0.008; b.userData.act = k; g.add(b); clickables.push(b); ctl.speed[k] = { b, ring };
    }
    engrave('SPEED', -0.47, 0.6, 0.08, 34);
    // 전원 노브(왼쪽 앞 구석): 돌리는 손잡이 + 크롬 테 + ON/OFF 표시. 누르면 딸깍 돌아간다(장식)
    {
      const pk = new THREE.Group(); pk.position.set(-0.77, PLATE, 0.645); deck.add(pk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0028, 10, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; pk.add(ring);
      const kc = document.createElement('canvas'); kc.width = kc.height = 256; const kg = kc.getContext('2d');
      const kgr = kg.createRadialGradient(128, 128, 10, 128, 128, 128); kgr.addColorStop(0, '#e8eaee'); kgr.addColorStop(1, '#a9adb3'); kg.fillStyle = kgr; kg.beginPath(); kg.arc(128, 128, 128, 0, 7); kg.fill();
      for (let r = 20; r < 128; r += 4) { kg.strokeStyle = 'rgba(255,255,255,.18)'; kg.lineWidth = 1; kg.beginPath(); kg.arc(128, 128, r, 0, 7); kg.stroke(); }
      kg.fillStyle = '#c8102e'; kg.fillRect(124, 14, 8, 50);
      const kt = new THREE.CanvasTexture(kc); kt.colorSpace = THREE.SRGBColorSpace;
      const knurl = document.createElement('canvas'); knurl.width = 512; knurl.height = 32; const ng = knurl.getContext('2d'); for (let i = 0; i < 128; i++) { ng.fillStyle = i % 2 ? '#eef0f3' : '#7d8188'; ng.fillRect(i * 4, 0, 2, 32); }
      const nt = new THREE.CanvasTexture(knurl); nt.colorSpace = THREE.SRGBColorSpace;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 48), [new THREE.MeshStandardMaterial({ map: nt, metalness: 0.9, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: kt, metalness: 0.85, roughness: 0.25 }), satinM]);
      knob.position.y = 0.011; knob.rotation.y = -0.6; knob.userData.act = 'power'; pk.add(knob); clickables.push(knob); ctl.power = knob;
      // ON · OFF 표시(본체에 새김)
      const on = engrave('ON', -0.735, 0.6, 0.03, 40), off = engrave('OFF', -0.805, 0.6, 0.036, 40); void on; void off;
    }
    // QUARTZ 표시등(속도가 맞으면 초록)
    {
      const q = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0x1b3a22, emissive: 0x44ff88, emissiveIntensity: 0 }));
      q.position.set(-0.66, PLATE + 0.006, 0.545); deck.add(q); ctl.quartz = q;
      const qb = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); qb.rotation.x = Math.PI / 2; qb.position.set(-0.66, PLATE + 0.006, 0.545); deck.add(qb);
    }
    // 볼륨 슬라이더(피치 슬라이더 자리): 오른쪽 앞, 위(뒤)로 밀수록 크게
    const sl = new THREE.Group(); sl.position.set(0.8, PLATE, 0.3); deck.add(sl);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.52), darkM); slot.position.y = 0.002; sl.add(slot);
    for (let i = 0; i <= 10; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(i % 5 ? 0.02 : 0.035, 0.002, 0.003), darkM); tk.position.set(-0.04, 0.0015, -0.25 + i * 0.05); sl.add(tk); }
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.04), [satinM, satinM, new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 0.9, roughness: 0.25 }), satinM, satinM, satinM]);
    knob.position.y = 0.018; knob.userData.act = 'slider'; sl.add(knob); clickables.push(knob); ctl.knob = knob; ctl.slider = sl;
    const kl = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.002, 0.006), new THREE.MeshStandardMaterial({ color: 0xc8102e })); kl.position.y = 0.034; knob.add(kl); kl.position.set(0, 0.016, 0);
    engrave('VOLUME', 0.8, 0.578, 0.1, 34);
    // 오른쪽 아래: 앰버 시간 표시창 · 템포 범위 버튼(8/16, 장식) · RESET(볼륨 50)
    {
      const dc = document.createElement('canvas'); dc.width = 512; dc.height = 192; const dg = dc.getContext('2d');
      const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
      const win = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.006, 0.05, 2, 0.006), [darkM, darkM, new THREE.MeshStandardMaterial({ map: dt, emissiveMap: dt, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.15, metalness: 0.1 }), darkM, darkM, darkM]);
      win.position.set(0.545, PLATE + 0.004, 0.645); deck.add(win);
      const bz = new THREE.Mesh(new RoundedBoxGeometry(0.142, 0.005, 0.062, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); bz.position.set(0.545, PLATE + 0.002, 0.645); deck.add(bz);
      ctl.lcd = { c: dc, g: dg, t: dt, last: '' };
      engrave('TIME', 0.545, 0.6, 0.06, 34);
      ctl.range = 8;
      for (const [k, x] of [['r8', 0.655], ['r16', 0.715]]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 32), [satinM, new THREE.MeshStandardMaterial({ map: labelTex([k === 'r8' ? '8' : '16'], 128, 128, 56), metalness: 0.4, roughness: 0.45 }), satinM]);
        const bzr = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0028, 10, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); bzr.rotation.x = Math.PI / 2; bzr.position.set(x, PLATE + 0.006, 0.645); deck.add(bzr);
        b.position.set(x, PLATE + 0.009, 0.645); b.userData.act = k; deck.add(b); clickables.push(b);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xffa030, emissiveIntensity: 0 })); led.position.set(x, PLATE + 0.006, 0.605); deck.add(led);
        ctl[k] = { b, led };
      }
      engrave('RANGE ±%', 0.685, 0.686, 0.08, 34);
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 32), [satinM, new THREE.MeshStandardMaterial({ map: labelTex(['R'], 128, 128, 56), metalness: 0.4, roughness: 0.45 }), satinM]);
      rb.position.set(0.795, PLATE + 0.009, 0.645); rb.userData.act = 'reset'; deck.add(rb); clickables.push(rb); ctl.reset = rb;
      const rbz = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0028, 10, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 })); rbz.rotation.x = Math.PI / 2; rbz.position.set(0.795, PLATE + 0.006, 0.645); deck.add(rbz);
      engrave('RESET', 0.795, 0.686, 0.05, 34);
    }
    // 큐 레버: 톤암 받침 앞, 올리면 바늘이 들린다
    const cue = new THREE.Group(); cue.position.set(PIV.x + 0.105, PLATE, PIV.z + 0.16); deck.add(cue);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06), satinM); cb.position.y = 0.015; cue.add(cb);
    const lever = new THREE.Group(); lever.position.set(0, 0.03, 0.02); cue.add(lever);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 0.95, roughness: 0.2 }));
    stick.geometry.translate(0, 0.035, 0); lever.add(stick);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), darkM); tip.position.y = 0.07; lever.add(tip);
    for (const o of [cb, stick, tip]) { o.userData.act = 'cue'; clickables.push(o); }
    ctl.lever = lever;
    // 안티스케이팅 다이얼(손으로 돌아간다)
    const dial = new THREE.Group(); dial.position.set(PIV.x - 0.13, PLATE, PIV.z - 0.11); deck.add(dial);
    const dc = document.createElement('canvas'); dc.width = dc.height = 128; const dg = dc.getContext('2d');
    dg.fillStyle = '#cfd2d6'; dg.beginPath(); dg.arc(64, 64, 64, 0, 7); dg.fill(); dg.fillStyle = '#1d1f24'; dg.font = '700 18px "JetBrains Mono", monospace'; dg.textAlign = 'center'; dg.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + i * Math.PI / 2; dg.fillText(String(i), 64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); }
    dg.fillStyle = '#c8102e'; dg.fillRect(62, 6, 4, 22);
    const dt2 = new THREE.CanvasTexture(dc); dt2.colorSpace = THREE.SRGBColorSpace;
    const dk = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.024, 40), [satinM, new THREE.MeshStandardMaterial({ map: dt2, metalness: 0.5, roughness: 0.4 }), satinM]);
    dk.position.y = 0.012; dk.userData.act = 'dial'; dial.add(dk); clickables.push(dk); ctl.dial = dk;
    engrave('ANTI-SKATE', PIV.x - 0.13, PIV.z - 0.04, 0.13, 30);
    // 명판: 뒤 왼쪽 구석, 나사 4개
    {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
      const bgd = g.createLinearGradient(0, 0, 512, 160); bgd.addColorStop(0, '#2a2c31'); bgd.addColorStop(1, '#1a1b1f'); g.fillStyle = bgd; g.fillRect(0, 0, 512, 160);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.strokeRect(10, 10, 492, 140);
      g.fillStyle = '#e8eaee'; g.textBaseline = 'middle'; g.font = '700 46px "Space Grotesk", sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '10px'; g.fillText('T/L/L', 44, 66);
      g.font = '600 20px "JetBrains Mono", monospace'; if ('letterSpacing' in g) g.letterSpacing = '3px'; g.fillStyle = '#9ca3af'; g.fillText('SD-01 · DIRECT DRIVE · No. 0011', 46, 116);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.005, 0.082, 2, 0.006), [satinM, satinM, new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.35 }), satinM, satinM, satinM]);
      plate.position.set(-0.7, PLATE + 0.0065, -0.6); deck.add(plate);
      for (const [sx, sz] of [[-0.118, -0.03], [0.118, -0.03], [-0.118, 0.03], [0.118, 0.03]]) {
        const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 16), new THREE.MeshStandardMaterial({ color: 0xd9dce1, metalness: 1, roughness: 0.2 })); sc.position.set(-0.7 + sx, PLATE + 0.0095, -0.6 + sz); deck.add(sc);
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0012, 0.0012), darkM); sl.position.set(-0.7 + sx, PLATE + 0.011, -0.6 + sz); sl.rotation.y = sx * 9; deck.add(sl);
      }
    }
    // 바늘 조명(타깃 라이트): 조명 모드에서 솟아올라 바늘 끝을 비춘다
    const tl = new THREE.Group(); tl.position.set(0.44, PLATE, 0.6); deck.add(tl);
    const tlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.008, 24), darkM); tlBase.position.y = 0.004; tl.add(tlBase);
    const tlPop = new THREE.Group(); tl.add(tlPop);
    const tlCol = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.07, 20), satinM); tlCol.position.y = 0.035; tlPop.add(tlCol);
    const tlHead = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0 })); tlHead.position.y = 0.075; tlPop.add(tlHead);
    const tlLight = new THREE.SpotLight(0xffe6c0, 0, 0.9, 0.22, 0.7, 2); tlLight.position.set(0, 0.08, 0); tlPop.add(tlLight); deck.add(tlLight.target);
    ctl.target = { pop: tlPop, head: tlHead, light: tlLight };
    // 45 어댑터(뒤 오른쪽 구석)
    const ad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.014, 40), new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 0.95, roughness: 0.2 }));
    ad.position.set(0.79, PLATE + 0.007, -0.6); ad.castShadow = true; deck.add(ad);
    const adh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 24), darkM); adh.position.set(0.79, PLATE + 0.008, -0.6); deck.add(adh);
    const adw = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.004, 40), darkM); adw.position.set(0.79, PLATE + 0.002, -0.6); deck.add(adw);
    // 뒤쪽 RCA 케이블(빨강·흰색) — 낮은 각도에서 보인다
    for (const [cx, col] of [[0.5, 0xc8102e], [0.58, 0xf1f1f1]]) {
      const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
      plug.rotation.x = Math.PI / 2; plug.position.set(cx, -0.08, -0.745); deck.add(plug);
      const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(cx, -0.08, -0.77), new THREE.Vector3(cx + 0.02, -0.12, -0.95), new THREE.Vector3(cx + 0.08, -0.19, -1.3), new THREE.Vector3(cx + 0.2, -0.19, -2.2)]);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(cv, 32, 0.008, 8, false), darkM); cable.castShadow = true; deck.add(cable);
    }
    // 먼지 덮개(투명 아크릴, 뒤 힌지). 오래 멈춰 두면 닫히고 만지면 열린다
    const cover = new THREE.Group(); cover.position.set(0, PLATE + 0.004, -0.722); deck.add(cover);
    const acr = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    const CW = 1.75, CH = 0.26, CD = 1.43;
    const face = (w, h, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), acr); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); cover.add(m); };
    face(CW, CD, 0, CH, CD / 2, -Math.PI / 2, 0); face(CW, CH, 0, CH / 2, CD, 0, 0); face(CW, CH, 0, CH / 2, 0, 0, 0);
    face(CD, CH, -CW / 2, CH / 2, CD / 2, 0, Math.PI / 2); face(CD, CH, CW / 2, CH / 2, CD / 2, 0, Math.PI / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CW, CH, CD)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    edges.position.set(0, CH / 2, CD / 2); cover.add(edges);
    for (const hx of [-0.6, 0.6]) { const hg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.03), darkM); hg.position.set(hx, PLATE + 0.012, -0.727); deck.add(hg); }
    ctl.cover = cover;
  }

  // 빛 번짐: LED·등 둘레의 은은한 후광(가벼운 스프라이트)
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const halos = [];
  function halo(parent, pos, color, size, fn) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); sp.scale.set(size, size, 1); sp.position.copy(pos); parent.add(sp); halos.push({ sp, fn }); }
  // ---------- 연출: 무지개 반사광 · 조명 속 먼지 · 곡 바뀔 때 홈 빛남 ----------
  const fx = {};
  function buildFx() {
    // 무지개 반사광: 판 홈에 부채꼴로 번지는 빛(판과 같이 돌지 않는다 = 빛은 제자리, 홈만 돈다)
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(512, 512, GO_PX, 0, 7); g.arc(512, 512, GI_PX, 0, 7, true); g.clip();
    const fan = (a0) => {
      const cg = g.createConicGradient ? g.createConicGradient(a0 - 0.35, 512, 512) : null;
      if (!cg) return;
      const stops = ['rgba(255,60,60,0)', 'rgba(255,120,60,.55)', 'rgba(255,230,80,.6)', 'rgba(80,255,140,.55)', 'rgba(70,170,255,.6)', 'rgba(170,90,255,.5)', 'rgba(170,90,255,0)'];
      stops.forEach((st, i) => cg.addColorStop((i / (stops.length - 1)) * 0.11, st)); cg.addColorStop(0.12, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cg; g.fillRect(0, 0, 1024, 1024);
    };
    fan(-2.25); fan(0.9);
    g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const rb = new THREE.Mesh(new THREE.CircleGeometry(REC_R, 96), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
    rb.rotation.x = -Math.PI / 2; rb.position.set(PLATTER.x, REC_Y + 0.0075, PLATTER.z); deck.add(rb); fx.rainbow = rb;
    // 조명 속 먼지
    const N = 180, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = -0.9 + Math.random() * 1.4; pos[i * 3 + 1] = 0.15 + Math.random() * 1.4; pos[i * 3 + 2] = -0.6 + Math.random() * 1.1; seed[i] = Math.random() * 100; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dg = dc.getContext('2d'); const rgd = dg.createRadialGradient(16, 16, 0, 16, 16, 16); rgd.addColorStop(0, 'rgba(255,240,215,1)'); rgd.addColorStop(1, 'rgba(255,240,215,0)'); dg.fillStyle = rgd; dg.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.012, map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts); fx.dust = { pts, seed, base: pos.slice() };
    fx.gaps = [];
  }

  // ---------- 본체 조립(맨 끝에서 부른다: 아래 상수·함수가 다 준비된 뒤) ----------
  function init() {
    const root = new THREE.Group(); deck.add(root);
    const platter = new THREE.Group(); platter.name = 'platter'; platter.position.copy(PLATTER); root.add(platter);
    const yawN = new THREE.Group(); yawN.name = 'armYaw'; yawN.position.copy(PIV); root.add(yawN);
    const liftN = new THREE.Group(); liftN.name = 'armLift'; yawN.add(liftN);
    parts = { platter, yaw: yawN, lift: liftN };
    buildPlatter(platter);
    buildArm(liftN, yawN);
    buildControls();
    buildFx();
    // 후광: 스트로브 등 · 33/45 불 · 전원 LED · 바늘 조명
    halo(deck, D._glow.position.clone().add(new THREE.Vector3(-0.012, -0.01, 0.013)), 0xff4a30, 0.16, () => 0.55 + night * 0.4);
    halo(ctl.speed.s33.ring.parent, new THREE.Vector3(0, 0.01, 0), 0xff7a3a, 0.08, () => (speed45 ? 0 : 0.45));
    halo(ctl.speed.s45.ring.parent, new THREE.Vector3(0, 0.01, 0), 0xff7a3a, 0.08, () => (speed45 ? 0.45 : 0));
    halo(ctl.pled.parent, ctl.pled.position.clone(), 0x44ff88, 0.07, () => (playing ? 0.8 : 0));
    halo(ctl.target.pop, new THREE.Vector3(0, 0.075, 0), 0xffd9a0, 0.06, () => night * 0.45);
    record = makeRecord(); record.position.set(0, REC_Y, 0); platter.add(record);
    // 그림자: 판·플래터·톤암·조작부가 드리우고, 본체·매트가 받는다
    deck.traverse((o) => { if (o.isMesh && o !== floor && !(o.material && o.material.transparent)) { o.castShadow = true; o.receiveShadow = true; } });
    applyLabel();
    D.ok = true;
    document.body.classList.add('d3');
    resize();
    loop.last = performance.now(); requestAnimationFrame(loop);
  }

  function applyLabel(target = record) {
    const L = label, key = L ? [L.name, L.artist, L.img, (L.tracks || []).map((f) => f.toFixed(3)).join(',')].join('|') : '';
    if (target === record && key === labelKey) return;
    poke = performance.now();
    if (target === record) labelKey = key;
    drawRecord(target.userData.R, L, null);
    loadImg(lblSrc(L)).then((img) => { if (img && (target !== record || labelKey === key)) drawRecord(target.userData.R, L, img); });
  }

  // 바늘 끝이 판 중심에서 반지름 r에 오는 톤암 각(이분법). 각이 작아질수록(음수 쪽) 안쪽으로 간다
  function yawFor(r) {
    const piv = parts.yaw.position;
    const rad = (th) => { const c = Math.cos(th), s2 = Math.sin(th); const x = piv.x + HEAD.x * c + HEAD.z * s2, z = piv.z - HEAD.x * s2 + HEAD.z * c; return Math.hypot(x - PLATTER.x, z - PLATTER.z); };
    let lo = -1.2, hi = 0;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (rad(mid) > r) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }

  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, -0.02, 0.02);
  let camZoom = 0;
  function resize() {
    poke = performance.now();
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    // 판 전체(1.8 × 1.5)가 들어오게 거리를 맞춘다. 위에서 비스듬히(약 62도) 내려다본다
    const fitW = 2.12 / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect), fitH = 1.62 / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    const dist = Math.max(fitW, fitH);
    const el = THREE.MathUtils.degToRad(48);
    camBase.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    cam.position.copy(camBase);
    cam.lookAt(camLook);
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);

  // 판 잡기: 판을 누르면 멈추고, 돌리는 만큼 판이 따라 돈다(스크래치 소리). 놓으면 모터가 다시 돌린다
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function recordAngle(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    plane.constant = -(REC_Y + 0.004 + deck.position.y);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const dx = hit.x - PLATTER.x, dz = hit.z - PLATTER.z, d = Math.hypot(dx, dz);
    return { phi: Math.atan2(dz, dx), d };
  }
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  function hitControl(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(clickables, false)[0];
    return h ? h.object.userData.act : null;
  }
  function planeHit(e, y) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam); plane.constant = -y;
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  const press = (m) => { m.position.y -= 0.007; setTimeout(() => { m.position.y += 0.007; }, 140); };
  el.addEventListener('pointerdown', (e) => {
    if (!parts) return;
    idle = 0;
    // 덮개가 닫혀 있으면 먼저 연다
    if (coverK > 0.3) { coverT = 0; D.onSound && D.onSound('cover'); e.preventDefault(); return; }
    const act = hitControl(e);
    if (act) {
      e.preventDefault();
      if (act === 'start') { press(ctl.start); D.onSound && D.onSound('click'); D.onButton && D.onButton('start'); }
      else if (act === 's33' || act === 's45') { press(ctl.speed[act].b); speed45 = act === 's45'; RPS = (speed45 ? 45 : 33.333) / 60; D.onSound && D.onSound('click'); }
      else if (act === 'r8' || act === 'r16') { press(ctl[act].b); ctl.range = act === 'r8' ? 8 : 16; D.onSound && D.onSound('click'); }
      else if (act === 'reset') { press(ctl.reset); D.onSound && D.onSound('click'); D.onButton && D.onButton('reset'); }
      else if (act === 'power') { ctl.power.rotation.y += ctl.power.rotation.y < 0 ? 1.2 : -1.2; D.onSound && D.onSound('click'); }
      else if (act === 'cue') { D.onSound && D.onSound('cue'); D.onButton && D.onButton('cue'); }
      else if (act === 'slider' || act === 'dial') { dragCtl = { act, x: e.clientX, y: e.clientY, rot: ctl.dial.rotation.y }; el.setPointerCapture(e.pointerId); }
      return;
    }
    if (drop || !record) return;
    const a = recordAngle(e); if (!a || a.d > REC_R || a.d < 0.04) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    grab = { phi: a.phi, spin0: spin, t: performance.now(), last: performance.now(), v: 0 };
    el.style.cursor = 'grabbing';
    D.onScratch && D.onScratch('start');
  });
  el.addEventListener('pointermove', (e) => {
    if (dragCtl) {
      if (dragCtl.act === 'slider') {
        const h = planeHit(e, PLATE + 0.03); if (!h) return;
        const zz = Math.max(-0.25, Math.min(0.25, h.z - ctl.slider.position.z));
        volume = Math.round((0.25 - zz) / 0.5 * 100); D.onVolume && D.onVolume(volume);
      } else { ctl.dial.rotation.y = dragCtl.rot - (e.clientX - dragCtl.x) * 0.02; }
      return;
    }
    if (!grab) { const act = parts && hitControl(e); if (act) { el.style.cursor = 'pointer'; return; } const a = parts && recordAngle(e); el.style.cursor = a && a.d < REC_R && a.d > 0.04 && !drop ? 'grab' : ''; return; }
    const a = recordAngle(e); if (!a) return;
    let dphi = a.phi - grab.phi; if (dphi > Math.PI) dphi -= 2 * Math.PI; if (dphi < -Math.PI) dphi += 2 * Math.PI;
    grab.phi = a.phi;
    const now = performance.now(), dts = Math.max(0.008, (now - grab.last) / 1000); grab.last = now;
    spin -= dphi; // 점의 각이 φ면 돌린 뒤 각은 φ - spin 쪽이라 반대로 더한다
    grab.v = grab.v * 0.6 + (-dphi / dts) * 0.4;
    D.onScratch && D.onScratch('move', grab.v / (RPS * Math.PI * 2)); // 1 = 정상 속도, 음수 = 거꾸로
  });
  const release = () => {
    if (dragCtl) { if (dragCtl.act === 'dial') D.onSound && D.onSound('click'); dragCtl = null; return; }
    if (!grab) return;
    // 앞으로 돈 각(시계 방향이 앞) → 초. 한 바퀴 = 1.8초(33⅓ rpm)
    const sec = (-(spin - grab.spin0)) / (Math.PI * 2) * (1 / RPS);
    const held = (performance.now() - grab.t) / 1000;
    vel = Math.max(0, grab.v * 0.5);
    grab = null; el.style.cursor = '';
    D.onScratch && D.onScratch('end', sec, held);
  };
  el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const easeIn = (t) => t * t * t, easeOut = (t) => 1 - (1 - t) ** 3;
  const lerp = THREE.MathUtils.lerp, clamp01 = (t) => Math.min(1, Math.max(0, t));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));

  // 판 먼지 털이(카본 브러시): 오른쪽 앞에서 들어와 도는 판에 대고 있다가 들어서 빠짐. 1.5초
  function makeBrush() {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.06), new THREE.MeshStandardMaterial({ color: 0x8a2230, roughness: 1 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.075), new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.3, metalness: 0.6 }));
    body.position.y = 0.024;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.9 }));
    grip.position.set(0.04, 0.06, 0);
    [pad, body, grip].forEach((m) => { m.castShadow = true; g.add(m); });
    g.visible = false; scene.add(g);
    return g;
  }
  function stepBrush(now) {
    if (brushT0 < 0) return;
    if (!dustBrush) dustBrush = makeBrush();
    const k = D._bk != null ? D._bk : (now - brushT0) / 1500; // D._bk: 화면 확인용으로 시점 고정(0~1)
    if (k >= 1) { dustBrush.visible = false; brushT0 = -1; return; }
    const inK = easeOut(seg(k, 0, 0.25)), downK = ease(seg(k, 0.2, 0.32)), upK = easeIn(seg(k, 0.75, 0.86)), outK = easeIn(seg(k, 0.82, 1));
    const P = PLATTER, touch = REC_Y + 0.012 + 0.002 * Math.sin(now / 40);
    dustBrush.visible = true;
    dustBrush.position.set(P.x + lerp(1.1, 0.3, inK) + outK * 0.9, lerp(0.35, lerp(0.12, touch, downK), inK) + upK * 0.14 + outK * 0.2, P.z + lerp(0.55, 0.06, inK) + outK * 0.3);
    dustBrush.rotation.set(0, lerp(0.5, 0, inK) + Math.sin(k * 12) * 0.02 * downK * (1 - upK), lerp(-0.25, 0, inK) - upK * 0.2);
  }

  // 화면에 안 보이면(잼 모드로 가려짐 · 탭 숨김 · 칸이 화면 밖) 그리지 않는다
  let onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; }).observe(host);
  let frameN = 0;
  function loop(now) {
    if (!parts) return;
    // 잡지처럼 화면 전체를 덮는 것이 떠 있으면 그리지 않는다(아이폰 사파리 메모리)
    if (D._off) { loop.last = now; setTimeout(() => requestAnimationFrame(loop), 500); return; }
    if (document.hidden || window.MusicJamOn || !onScreen) { loop.last = now; requestAnimationFrame(loop); return; }
    // 조용할 때(멈춤 · 움직이는 것 없음 · 2초 넘게 안 만짐)는 초당 10번, 덮개가 닫혔으면 초당 2번만 그린다
    const calm = !(playing || grab || drop || dragCtl || cue || brushT0 >= 0 || shakeT >= 0 || fx.gaps.length) &&
      vel < 0.005 && Math.abs(yaw) < 0.001 && lift < 0.0005 && Math.abs(cueUp - 1) < 0.005 &&
      Math.abs(coverT - coverK) < 0.001 && Math.abs(nightT - night) < 0.001 &&
      Math.abs((0.25 - volume / 100 * 0.5) - ctl.knob.position.z) < 0.0005 && now - poke > 2000;
    if (calm && now - loop.last < (coverK > 0.99 ? 500 : 100)) { requestAnimationFrame(loop); return; }
    // 판만 도는 평소 재생은 초당 30번이면 충분하다(120Hz 화면에서 4배 덜 그림). 판 갈기·잡기·조작 중엔 매 프레임
    const lively = !!(grab || drop || dragCtl || cue || brushT0 >= 0 || shakeT >= 0) || now - touchAt < 1200;
    if (!calm && !lively && now - loop.last < 31) { requestAnimationFrame(loop); return; }
    const dt = Math.min(calm ? 0.6 : 0.05, (now - loop.last) / 1000); loop.last = now;
    const busy = !!drop;
    // 플래터: 재생 중이면 33⅓ rpm까지 0.8초에 올라가고, 멈추면 천천히 선다
    const target = (playing || cue) && !busy ? RPS * Math.PI * 2 : 0;
    if (!grab) { vel += (target - vel) * Math.min(1, dt * (target ? 2.6 : 1.6)); spin -= vel * dt; }
    parts.platter.rotation.y = spin;
    // 톤암: 판을 가는 중엔 쉼 자리, 재생 중이면 곡 진행에 따라 안쪽으로. 움직이는 동안엔 들려 있다
    const cueArm = !playing && !busy && !grab && (cue === 'lead' || cue === 'down');
    const yawT = playing && !busy && !grab ? yawFor(GO_R - clamp01(progress) * (GO_R - GI_R)) : grab ? yaw : cueArm ? yawFor(GO_R) : playing && !busy ? yaw : 0;
    const far = Math.abs(yawT - yaw) > 0.012;
    // 들림: 옮길 땐 LIFT_UP, 판 위에선 LIFT_ON(판 높이만큼), 쉴 땐 0. 큐로 띄워 둔 동안은 들린 채, 내릴 땐 기름 댐퍼처럼 천천히
    const liftT = far ? LIFT_UP : cueArm && cue === 'lead' ? LIFT_UP : yawT !== 0 ? LIFT_ON : 0;
    lift += (liftT - lift) * Math.min(1, dt * (cueArm && cue === 'down' ? 2.6 : 7));
    if (!far || lift > LIFT_UP * 0.85) yaw += (yawT - yaw) * Math.min(1, dt * (far ? 3.2 : 1.5));
    parts.yaw.rotation.y = yaw;
    // 판 휨: 바늘이 판 위에 있으면 휜 판을 따라 톤암이 아주 살짝 오르내린다
    const onRec = playing && !busy && !far && yaw < -0.1;
    parts.lift.rotation.x = -lift - (onRec ? 0.0025 * (1 + Math.sin(spin)) : 0);
    if (drop) stepDrop(now);
    const T = now / 1000;
    // 스트로브 착시: 속도가 맞으면 점이 멈춰 보이고, 잡거나 속도가 오르내리면 흘러간다
    const nominal = RPS * Math.PI * 2, apparent = vel > 0.05 || grab ? (grab ? -(grab.v || 0) : vel) - nominal : 0;
    strobeAng += apparent * dt * 0.25;
    // 스트로브 착시는 껐다(사용자: 재생 중 플래터가 멈춰 보임). 땡땡이는 플래터와 같이 돈다
    if (strobeTex) strobeTex.offset.x = 0;
    // 큐 레버: 바늘이 판 위면 내려가고 아니면 올라간다
    cueUp += ((onRec || grab || (cueArm && cue === 'down') ? 0 : 1) - cueUp) * Math.min(1, dt * 6);
    stepBrush(now);
    ctl.lever.rotation.x = lerp(0.5, -0.35, cueUp);
    // 톤암 클립: 쉴 때 닫힘
    const rest = Math.abs(yaw) < 0.02 && !playing;
    clips.forEach((c) => { c.m.rotation.z += ((rest ? 0 : c.sgn * 0.9) - c.m.rotation.z) * Math.min(1, dt * 5); });
    halos.forEach((h) => { h.sp.material.opacity = h.fn(); });
    ctl.pled.material.emissiveIntensity = playing ? 2 : 0;
    ctl.r8.led.material.emissiveIntensity = ctl.range === 8 ? 2 : 0; ctl.r16.led.material.emissiveIntensity = ctl.range === 16 ? 2 : 0;
    ctl.quartz.material.emissiveIntensity = playing && !grab && Math.abs(vel - RPS * Math.PI * 2) < 0.05 ? 2 : 0;
    // 33/45 불
    ctl.speed.s33.ring.material.emissiveIntensity = speed45 ? 0 : 1.6; ctl.speed.s45.ring.material.emissiveIntensity = speed45 ? 1.6 : 0;
    // 볼륨 슬라이더 손잡이
    ctl.knob.position.z += ((0.25 - volume / 100 * 0.5) - ctl.knob.position.z) * Math.min(1, dt * 10);
    // 먼지 덮개: 멈춘 채 25초 지나면 닫힘, 만지거나 재생하면 열림
    if (playing || grab || drop || dragCtl || cue) idle = 0; else idle += dt;
    if (idle > 25) coverT = 1; else if (playing || drop) coverT = 0;
    const prevK = coverK; coverK += (coverT - coverK) * Math.min(1, dt * 1.8);
    if (prevK < 0.5 && coverK >= 0.5 && D.onSound) D.onSound('cover');
    ctl.cover.rotation.x = lerp(-1.32, 0, easeOut(coverK));
    // 바늘 조명: 조명 모드에서 솟아 바늘 끝을 비춘다
    const tp = ctl.target; tp.pop.position.y = lerp(-0.07, 0, night); tp.head.material.emissiveIntensity = night * 1.1; tp.light.intensity = night * 0.2;
    const headW = new THREE.Vector3(HEAD.x, REC_Y, HEAD.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(PIV); tp.light.target.position.copy(headW);
    // 무지개 반사광 · 먼지
    fx.rainbow.visible = false; // 무지개 반사광은 사용자 요청으로 끔(2026-11-12)
    const dp = fx.dust.pts.geometry.attributes.position, b0 = fx.dust.base;
    for (let i = 0; i < fx.dust.seed.length; i++) { const sd = fx.dust.seed[i]; dp.array[i * 3] = b0[i * 3] + Math.sin(T * 0.13 + sd) * 0.06; dp.array[i * 3 + 1] = b0[i * 3 + 1] + Math.sin(T * 0.09 + sd * 2) * 0.05; dp.array[i * 3 + 2] = b0[i * 3 + 2] + Math.cos(T * 0.11 + sd) * 0.05; }
    dp.needsUpdate = true; fx.dust.pts.material.opacity = night * 0.75;
    // 곡이 바뀔 때 그 무음 홈이 빛났다 사라짐
    fx.gaps = fx.gaps.filter((gp) => { const k = (now - gp.t0) / 1600; if (k >= 1) { scene.remove(gp.m); return false; } gp.m.material.opacity = (1 - k) * 0.9; return true; });
    // 카메라 숨쉬기 + 판 갈 때 플래터 쪽으로 살짝 다가감
    camZoom += ((drop ? 1 : 0) - camZoom) * Math.min(1, dt * 1.5);
    if (!D._camLock) {
      cam.position.set(camBase.x + Math.sin(T * 0.11) * 0.06, camBase.y + Math.sin(T * 0.07) * 0.03, camBase.z + Math.cos(T * 0.09) * 0.04);
      cam.position.lerp(new THREE.Vector3(PLATTER.x, camBase.y * 0.72, camBase.z * 0.72), camZoom * 0.22);
      cam.lookAt(new THREE.Vector3().copy(camLook).lerp(PLATTER, camZoom * 0.35));
    }
    night += (nightT - night) * Math.min(1, dt * 2.2);
    scene.environmentIntensity = lerp(1, 0.1, night);
    key.intensity = lerp(1.1, 0.06, night);
    rim.intensity = lerp(0.5, 1.4, night);
    spot.intensity = lerp(0, 3.2, night); spot.color.lerp(tintC, Math.min(1, dt * 1.5));
    armLamp.intensity = lerp(0, 0.5, night);
    if (D._glow) { D._glow.intensity = lerp(0.35, 1.6, night); D._glow.distance = lerp(0.5, 1.1, night); }
    renderer.toneMappingExposure = lerp(1.05, 1.25, night);
    // 쾅 흔들림
    if (shakeT >= 0) {
      const t = (now - shakeT) / 380;
      if (t >= 1) { deck.position.set(0, 0, 0); deck.rotation.z = 0; shakeT = -1; }
      else { const a = (1 - t) * (1 - t); deck.position.set(Math.sin(t * 60) * 0.018 * a, -Math.abs(Math.sin(t * 30)) * 0.012 * a, Math.cos(t * 47) * 0.012 * a); deck.rotation.z = Math.sin(t * 41) * 0.006 * a; }
    }
    // 그림자: 판·톤암·덮개가 움직이는 동안은 매번, 판만 돌 땐 6번에 한 번(돌아가는 원판 그림자는 거의 안 바뀐다)
    frameN++;
    if (lively || far || Math.abs(coverT - coverK) > 0.001 || frameN % 6 === 0) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  }

  // ---------- 판 갈아 끼우기 ----------
  // 앨범(3초): 옛 판이 들려 사라짐 → 슬리브가 들어와 판을 꺼냄 → 슬리브는 빠지고 판이 플래터 위로 와서 2.52초에 내려앉음
  // 플레이리스트(1.9초): 클립보드가 위에서 날아와 0.646초에 쾅 → 튐 → 옆으로 걷어내면 밑에 새 판
  // 앨범 판 갈기 모션 1~4 (0번은 stepDrop 안의 기본 '옆으로 꺼내기'). 모두 3초, 0.76까지 플래터 위 0.12에 와서 0.84에 내려앉는다(효과음 시각 공통)
  // 1 세로로 뽑기 · 2 프리스비(소용돌이) · 3 공중 한 바퀴 · 4 쏟기
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  const _qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const _n = new THREE.Vector3(), _u = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
  function albumPath(d, t, wp) {
    const s = d.sleeve, disc = d.disc, v = d.v;
    let pull0 = 0.16, pull1, pullDir, pullLen;
    if (v === 1) { // 세로로 뽑기: 슬리브가 위에서 내려와 서 있고, 판을 위로 뽑아 눕히며 내려놓음
      const inK = easeOut(seg(t, 0, 0.14)), outK = easeIn(seg(t, 0.48, 0.68));
      s.position.copy(wp(0.1, lerp(1.3, 0.4, inK) + outK * 1.3, -0.05));
      s.rotation.set(lerp(-0.95, -0.75, inK), 0, lerp(0.15, 0, inK));
      pull1 = 0.46; pullDir = [0, 1, 0]; pullLen = 0.55;
    } else if (v === 2) { // 프리스비: 왼쪽 앞에서 슬리브, 판이 튀어나와 플래터 둘레를 돌며 빙글빙글 내려앉음
      const inK = easeOut(seg(t, 0, 0.12)), outK = easeIn(seg(t, 0.4, 0.58));
      s.position.copy(wp(lerp(-1.2, -0.7, inK) - outK * 1.0, 0.35 + outK * 0.1, lerp(0.35, 0.25, inK)));
      s.rotation.set(-Math.PI / 2 + 0.45, 0, lerp(-0.4, 0.1, inK) - outK * 0.5);
      pull0 = 0.14; pull1 = 0.32; pullDir = [1, 0, 0]; pullLen = 0.6;
    } else if (v === 3) { // 공중 한 바퀴: 앞쪽 아래에서 올라온 슬리브에서 판이 뒤로 빠져 높이 떠서 한 바퀴 뒤집혀 내려앉음
      const inK = easeOut(seg(t, 0, 0.14)), outK = easeIn(seg(t, 0.46, 0.64));
      s.position.copy(wp(0.45, lerp(-0.3, 0.3, inK) - outK * 0.7, lerp(0.8, 0.35, inK) + outK * 0.4));
      s.rotation.set(-Math.PI / 2 + 0.6, 0, lerp(0.35, -0.05, inK));
      pull1 = 0.42; pullDir = [0, 1, 0]; pullLen = 0.7;
    } else { // 쏟기: 오른쪽 위에서 슬리브가 기울고 흔들리며 판이 아래로 미끄러져 나옴
      const wk = seg(t, 0.18, 0.5), inK = easeOut(seg(t, 0, 0.16)), outK = easeIn(seg(t, 0.5, 0.7));
      s.position.copy(wp(lerp(1.1, 0.45, inK) + outK * 1.0, lerp(0.9, 0.6, inK) + outK * 0.5, -0.1));
      s.rotation.set(lerp(-0.4, -0.2, inK), 0, lerp(0.1, -0.55, ease(seg(t, 0.1, 0.3))) + Math.sin(wk * Math.PI * 3) * 0.05 * (1 - wk));
      pull0 = 0.2; pull1 = 0.5; pullDir = [-0.55, -0.83, 0]; pullLen = 0.8;
    }
    s.visible = t < 0.72;
    if (d.handed) return;
    const spin = -Math.PI * (v === 2 ? 6 : 2) * ease(seg(t, pull1, 0.84));
    disc.visible = t >= pull0;
    // 마지막: 플래터 위 0.12에서 똑바로 내려앉음(handed에서 rotation.y를 읽으므로 Euler로 둔다)
    if (t >= 0.76) { disc.position.copy(wp(0, REC_Y + 0.12 - easeIn(seg(t, 0.76, 0.84)) * 0.12, 0)); disc.rotation.set(0, spin, 0); return; }
    // 슬리브 속 자리(슬리브 면 바로 뒤, 같은 방향). 뽑는 동안 슬리브는 멈춰 있으므로 pull1 전의 자세를 기억해 둔다
    if (t < pull1 || !d.sp) { d.sp = s.position.clone(); d.sq = s.quaternion.clone(); }
    _n.copy(_Z).applyQuaternion(d.sq); _u.set(pullDir[0], pullDir[1], pullDir[2]).applyQuaternion(d.sq);
    const out = d.sp.clone().addScaledVector(_n, -0.02).addScaledVector(_u, pullLen * ease(seg(t, pull0, pull1)));
    _q1.copy(d.sq).multiply(_qx);
    if (t < pull1) { disc.position.copy(out); disc.quaternion.copy(_q1); return; }
    const k = ease(seg(t, pull1, 0.76)), dst = wp(0, REC_Y + 0.12, 0);
    if (v === 2) {
      const r0 = Math.hypot(out.x - dst.x, out.z - dst.z), a0 = Math.atan2(out.z - dst.z, out.x - dst.x), r = r0 * (1 - k), a = a0 - k * Math.PI * 1.6;
      disc.position.set(dst.x + Math.cos(a) * r, lerp(out.y, dst.y, k) + Math.sin(k * Math.PI) * 0.12, dst.z + Math.sin(a) * r);
    } else {
      disc.position.lerpVectors(out, dst, k); disc.position.y += Math.sin(k * Math.PI) * (v === 3 ? 0.35 : 0.15);
    }
    _q2.setFromAxisAngle(_Y, spin);
    disc.quaternion.slerpQuaternions(_q1, _q2, k);
    if (v === 3) disc.quaternion.premultiply(_q3.setFromAxisAngle(_X, Math.PI * 2 * k));
    if (v === 2) disc.quaternion.premultiply(_q3.setFromAxisAngle(_Z, Math.sin(k * Math.PI) * 0.35));
  }

  function stepDrop(now) {
    const d = drop, T = d.slam ? 1900 : 3000, t = (D._at != null ? D._at : now - d.t0) / T; // D._at: 화면 확인용으로 시점 고정(ms)
    const P = PLATTER, wp = (x, y, z) => new THREE.Vector3(P.x + x, y, P.z + z);
    if (d.old) { const k = seg(t, 0, d.slam ? 0.3 : 0.12); d.old.position.y = REC_Y + easeIn(k) * (d.slam ? 0 : 0.5); d.old.userData.mats.forEach((m) => { m.transparent = true; m.opacity = 1 - k; }); if (k >= 1) { d.old.parent && d.old.parent.remove(d.old); d.old = null; } }
    if (!d.slam && d.v) albumPath(d, t, wp);
    else if (!d.slam) {
      const s = d.sleeve, disc = d.disc;
      // 0번(기본) 옆으로 꺼내기. 슬리브: 오른쪽 위에서 들어와 플래터 위 높이 0.55에 머물다 오른쪽으로 빠짐
      const inK = easeOut(seg(t, 0, 0.1)), outK = easeIn(seg(t, 0.5, 0.7));
      s.position.copy(wp(lerp(0.95, 0.4, inK) + outK * 1.3, 0.34 + outK * 0.12, lerp(-0.05, 0.02, inK)));
      s.rotation.set(-Math.PI / 2 + 0.25, 0, lerp(0.5, -0.06, inK) + outK * 0.4);
      s.visible = t < 0.72;
      // 판: 슬리브 속에서 왼쪽으로 빠져나옴 → 플래터 위로 → 내려앉음
      const pullK = ease(seg(t, 0.16, 0.44)), toK = ease(seg(t, 0.44, 0.76)), downK = easeIn(seg(t, 0.76, 0.84));
      const sx = s.position.x - P.x, sz = s.position.z - P.z;
      const px = lerp(sx, sx - 0.75, pullK), pz = sz;
      // 판을 플래터에 붙인 뒤(handed)엔 더 건드리지 않는다. 플래터 안 좌표에 세계 좌표를 넣으면 판이 한쪽으로 쏠려 돈다
      if (!d.handed) {
        disc.position.copy(wp(lerp(px, 0, toK), lerp(lerp(0.328, 0.38, pullK), REC_Y + 0.12, toK) - downK * 0.12, lerp(pz, 0, toK)));
        disc.rotation.set(lerp(-Math.PI / 2 + 0.25 + Math.PI / 2, 0, toK), lerp(0, -Math.PI * 2, ease(seg(t, 0.16, 0.84))), 0);
        disc.visible = t >= 0.16;
      }
    } else {
      const c = d.sleeve, disc = d.disc;
      const fall = seg(t, 0.07, 0.34), bounce = seg(t, 0.34, 0.47), flick = easeIn(seg(t, 0.55, 0.72));
      const y = t < 0.34 ? lerp(2.2, 0.14, easeIn(fall)) : 0.14 + Math.sin(bounce * Math.PI) * 0.07;
      c.position.copy(wp(lerp(-0.9, 0, easeIn(fall)) + flick * 2.2, y + flick * 0.25, lerp(-0.6, 0.02, easeIn(fall)) + flick * 0.3));
      c.rotation.set(-Math.PI / 2 + lerp(-0.9, 0, fall), 0, lerp(-0.7, -0.07, fall) - Math.sin(bounce * Math.PI) * 0.04 + flick * 0.9);
      c.visible = t < 0.74 && t > 0.0;
      if (!d.handed) { disc.visible = t >= 0.34; disc.position.copy(wp(0, REC_Y, 0)); disc.rotation.set(0, lerp(0, -Math.PI * 2, ease(seg(t, 0.34, 0.76))), 0); }
    }
    // 내려앉는 순간: 새 판을 플래터에 붙인다(회전은 지금 플래터 각도 기준 0)
    const hand = d.slam ? 0.76 : 0.84;
    if (t >= hand && !d.handed) {
      d.handed = true;
      const disc = d.disc; scene.remove(disc);
      if (record && record.parent) record.parent.remove(record);
      const ry = disc.rotation.y - parts.platter.rotation.y;
      record = disc; record.position.set(0, REC_Y, 0); record.rotation.set(0, ry, 0); parts.platter.add(record);
      labelKey = d.key; vel = 0;
    }
    if (t >= 1) { scene.remove(d.sleeve); drop = null; }
  }

  // 판 갈기 준비 중(표지 그림을 기다리는 동안)에는 플래터 위 옛 판 라벨을 바꾸지 않는다
  let preparing = 0;
  // 판 갈기에 쓸 새 판·슬리브를 미리 만들어 둔다(크레이트에서 고른 판). 누르는 순간엔 그리기 없이 바로 시작
  const preKey = (a, slam) => [a.id, a.img, slam ? 1 : 0, (a.tracks || []).map((f) => f.toFixed(3)).join(','), (a.p || 0) >> 2].join('|');
  let pre = null; // { k, disc, sleeve, L }
  let lastDropV = -1;
  function build(a, slam, img) {
    const disc = makeRecord();
    const L = { name: a.name, artist: a.artist, img: a.img, m: a.m, tracks: a.tracks || null };
    if (a.m) { drawRecord(disc.userData.R, L, null); loadImg(lblSrc(L)).then((im) => im && drawRecord(disc.userData.R, L, im)); }
    else { drawRecord(disc.userData.R, L, img); if (!img && a.img) loadImg(a.img).then((im) => im && drawRecord(disc.userData.R, L, im)); }
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(slam ? 1.24 : 1.26, slam ? 1.3 : 1.26, slam ? 0.03 : 0.012), slam ? [side, side, side, side, clipMat(a, img), side] : [side, side, side, side, coverMat(img, a), side]);
    // 미리 GPU에 올려 둔다(처음 그릴 때 멈칫하지 않게)
    renderer.initTexture && [disc.userData.R.t, sleeve.material[4].map].forEach((t) => t && renderer.initTexture(t));
    return { disc, sleeve, L };
  }
  D.prebuild = (a, slam) => {
    if (!a) return;
    const k = preKey(a, slam); if (pre && pre.k === k) return;
    const go = (img) => { if (pre && pre.k === k) return; pre = { k, ...build(a, slam, img) }; };
    const im = imgReady.get(a.img); if (im || !a.img) go(im || null); else loadImg(a.img).then(go);
  };
  D.drop = (a, slam) => {
    ++preparing; idle = 0; coverT = 0;
    if (drop) { scene.remove(drop.sleeve); if (!drop.handed) scene.remove(drop.disc); drop = null; }
    const k = preKey(a, slam);
    const P = pre && pre.k === k ? pre : build(a, slam, imgReady.get(a.img) || null);
    pre = null;
    const { disc, sleeve, L } = P;
    scene.add(sleeve); scene.add(disc); sleeve.visible = false; disc.visible = false;
    // 옛 판: 플래터에서 떼어 장면에 두고 사라지게
    let old = null;
    if (record) { old = record; const wpos = new THREE.Vector3(); old.getWorldPosition(wpos); old.parent.remove(old); old.position.copy(wpos); scene.add(old); record = null; }
    label = L;
    // 앨범은 판 갈기 모션 0~4 중 바로 전과 다른 하나(D._dropV로 고정 가능: 화면 확인용)
    let v = 0;
    if (!slam) { if (D._dropV != null) v = D._dropV; else { do { v = Math.floor(Math.random() * 5); } while (v === lastDropV); } lastDropV = v; }
    drop = { v, t0: performance.now(), slam: !!slam, sleeve, disc, old, handed: false, key: [L.name, L.artist, L.img, (L.tracks || []).map((f) => f.toFixed(3)).join(',')].join('|') };
    preparing = 0;
  };
  D.setPlaying = (on, prog) => { playing = !!on; if (Number.isFinite(prog)) progress = prog; };
  D.setNight = (on) => { nightT = on ? 1 : 0; };
  // 앨범 대표색: 밤 조명이 그 색을 조금 머금는다
  const warm = new THREE.Color(0xffd8a8), tintC = new THREE.Color(0xffd8a8);
  D.setTint = (hex) => { const h = hex || '#ffd8a8'; if (h === D.setTint.last) return; D.setTint.last = h; poke = performance.now(); tintC.copy(warm).lerp(new THREE.Color(h), 0.45); };
  D.suspend = (on) => { D._off = !!on; renderer.domElement.style.display = on ? 'none' : ''; if (!on) { poke = performance.now(); resize(); } };
  D.grabbing = () => !!grab;
  D.dropping = () => !!drop;
  D.setLabel = (L) => { label = L; if (!drop && !preparing && record) applyLabel(); };
  D.preload = (url) => { if (url) loadImg(url); };
  // 판 갈기 직전에 불러 옛 판 라벨을 잠근다(drop이 조금 늦게 불려도)
  D.prepare = () => { if (!preparing) preparing = 1; };
  // 앰버 7세그먼트 느낌 표시창: 곡 번호 + 지난 시간
  D.setTime = (txt, no) => {
    const L = ctl.lcd; if (!L) return;
    const s2 = `${no > 0 ? String(no).padStart(2, '0') : '--'} ${txt}`; if (s2 === L.last) return; L.last = s2; poke = performance.now();
    const g = L.g; g.fillStyle = '#0b0906'; g.fillRect(0, 0, 512, 192);
    g.font = '700 118px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = 'rgba(255,150,40,.12)'; g.fillText('88 88:88', 256, 100);
    g.shadowColor = 'rgba(255,150,40,.9)'; g.shadowBlur = 18; g.fillStyle = '#ffae42'; g.fillText(s2, 256, 100); g.shadowBlur = 0;
    L.t.needsUpdate = true;
  };
  D.shake = () => { shakeT = performance.now(); };
  D._dbg = () => ({ scene, parts, record, cam });
  D.setVolume = (v) => { if (!dragCtl) volume = v; };
  D.flashGap = (f) => {
    const r = GO_R - Math.min(1, Math.max(0, f)) * (GO_R - GI_R);
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.006, r + 0.006, 160), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(PLATTER.x, REC_Y + 0.008, PLATTER.z); scene.add(m); fx.gaps.push({ m, t0: performance.now() });
  };
  D.coverOpen = () => { idle = 0; coverT = 0; };
  D.cue = (m) => { cue = m || null; idle = 0; coverT = 0; poke = performance.now(); if (m === 'spin') press(ctl.start); };
  D.brush = () => { brushT0 = performance.now(); poke = brushT0; };
  // 깨우기: 판 갈기·흔들기·홈 빛·덮개 열기. 라벨·색·시간창은 실제로 바뀔 때만, 재생·조명·볼륨은 calm 조건이 본다
  for (const k of ['drop', 'shake', 'flashGap', 'coverOpen']) {
    const f = D[k]; D[k] = (...a) => { poke = performance.now(); return f(...a); };
  }
  for (const ev of ['pointerdown', 'pointermove', 'wheel']) el.addEventListener(ev, () => { poke = touchAt = performance.now(); }, { passive: true });
  init();
}
