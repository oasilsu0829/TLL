/* 황동 실린더 전축(2026-11-24 사용자 요청): 시가를 잔에 담가 끄고 토치로 다시 붙이면 연기 속에서 턴테이블이 이것으로 바뀐다
   에디슨 스탠더드 같은 모양을 T/L/L 식으로: 마호가니 상자 + 황동 기계부(모터 상자·조속기·만드릴·이송 나사·안내 막대·재생기 캐리지) + 백조 목 황동 나팔
   - 만드릴은 오른쪽 모터 상자에만 물려 있고 왼쪽 끝이 비어 있어 실린더를 왼쪽에서 끼운다
   - 재생기(진동판이 위를 보는 둥근 통)가 앨범 진행에 따라 실린더 위를 왼쪽 → 오른쪽으로 간다(턴테이블 톤암과 같은 뜻). 멈추면 캐리지가 안내 막대를 축으로 들림
   - 나팔은 고정, 재생기 팔꿈치와는 천 감은 고무관으로 잇는다(재생기가 움직이면 관을 다시 그림)
   - 실린더 = 앨범: 표지 대표색 셀룰로이드(블루 앰버롤처럼) + 가는 홈 + 곡 사이 무음 홈 + 끝 띠에 제목·아티스트 각인
   - 판 갈기(3초, 소리 시각은 턴테이블과 같음): 옛 실린더가 왼쪽으로 빠져 사라짐 → 마분지 통이 날아와 섬 → 뚜껑이 튀고 실린더가 솟음 → 통은 빠지고 실린더가 눕혀져 만드릴 왼쪽 → 2.52초에 끼워짐
     플레이리스트(1.9초): 통이 위에서 떨어져 0.646초에 쾅 → 실린더가 튀어나와 끼워짐
   deck3d.js가 import해서 씀: buildPhono({ THREE, RoundedBoxGeometry, loadImg }) → { g, hits, step, setLabel, drop, dropping, flashGap, crank, busy } */

export function buildPhono({ THREE, RoundedBoxGeometry, loadImg }) {
  const g = new THREE.Group(); g.name = 'phono';
  const SC = 1.12; g.scale.setScalar(SC); g.position.set(-0.04, -0.196 * (1 - SC), 0); // 턴테이블 자리를 채우게 조금 키움(바닥은 그대로)
  const FL = -0.196;                         // 탁자 높이
  const CX = 0.02, CW = 1.16, CD = 0.76;      // 상자 가운데·폭·깊이
  const TOP = 0.184, TP = TOP + 0.016;        // 뚜껑 윗면 · 기계판 윗면
  const YM = TP + 0.19, ZM = 0.06;            // 만드릴 축 높이·앞뒤
  const RM = 0.102, RC = 0.115;               // 만드릴 · 실린더 반지름
  const HX = -0.44;                           // 모터 상자(왼쪽, 나팔 밑)
  const XR = -0.38, XL = 0.17;                // 만드릴 모터 쪽(왼쪽) · 빈 끝(오른쪽, 여기로 실린더를 끼움)
  const CL = 0.48, XC = -0.11;                // 실린더 길이·자리(가운데)
  const G0 = 0.08, G1 = 0.88;                  // 소리 홈 띠(실린더 왼쪽 끝 0 → 오른쪽 끝 1). 오른쪽(빈 끝) 남는 띠에 제목 각인
  const P0 = XC - CL / 2 + G0 * CL, P1 = XC - CL / 2 + G1 * CL; // 재생기 길(진행 0 → 1)
  const RODY = YM + 0.1, RODZ = ZM - 0.17;    // 안내 막대(캐리지 축)
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const easeIn = (t) => t * t * t, easeOut = (t) => 1 - (1 - t) ** 3;
  const lerp = THREE.MathUtils.lerp, clamp01 = (t) => Math.min(1, Math.max(0, t));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const rnd = (() => { let sd = 41; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  // ---------- 재질 ----------
  // 황동: 얼룩진 손때(거칠기 무늬) + 아주 옅은 망치 자국
  const [bc, bx] = canvas(256, 256);
  bx.fillStyle = '#8a8a8a'; bx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { const x = rnd() * 256, y = rnd() * 256, r = 6 + rnd() * 30, gr = bx.createRadialGradient(x, y, 0, x, y, r); const v = rnd() < 0.5 ? 40 : 190; gr.addColorStop(0, `rgba(${v},${v},${v},.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); bx.fillStyle = gr; bx.fillRect(x - r, y - r, r * 2, r * 2); }
  const brassRough = ctex(bc, false); brassRough.wrapS = brassRough.wrapT = THREE.RepeatWrapping;
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9ad55, metalness: 1, roughness: 0.3, roughnessMap: brassRough, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.4 });
  const brassDark = new THREE.MeshPhysicalMaterial({ color: 0xa8792e, metalness: 1, roughness: 0.42, roughnessMap: brassRough, envMapIntensity: 1.2 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xe4e6ea, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 });
  const japan = new THREE.MeshPhysicalMaterial({ color: 0x121010, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  // 마호가니: 붉은 갈색 바탕 + 물결치는 나뭇결 + 니스 광택
  const [wc, wx] = canvas(1024, 512);
  { const gr = wx.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5a2514'); gr.addColorStop(0.5, '#4a1c0e'); gr.addColorStop(1, '#3d170b'); wx.fillStyle = gr; wx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 140; i++) { const y0 = rnd() * 512, a = 4 + rnd() * 14, f = 0.004 + rnd() * 0.01, ph = rnd() * 7, dark = rnd() < 0.6;
      wx.strokeStyle = dark ? `rgba(25,8,3,${0.1 + rnd() * 0.25})` : `rgba(150,70,40,${0.06 + rnd() * 0.12})`; wx.lineWidth = 0.6 + rnd() * 2.4; wx.beginPath();
      for (let x = 0; x <= 1024; x += 8) { const y = y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 3.1 + ph * 2) * a * 0.3; x ? wx.lineTo(x, y) : wx.moveTo(x, y); } wx.stroke(); }
    for (let i = 0; i < 12; i++) { const x = rnd() * 1024, y = rnd() * 512, gr2 = wx.createRadialGradient(x, y, 0, x, y, 60 + rnd() * 80); gr2.addColorStop(0, 'rgba(120,50,25,.18)'); gr2.addColorStop(1, 'rgba(0,0,0,0)'); wx.fillStyle = gr2; wx.fillRect(x - 140, y - 140, 280, 280); } }
  const woodT = ctex(wc); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshPhysicalMaterial({ map: woodT, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.2 });

  // ---------- 상자 ----------
  const base = new THREE.Mesh(new RoundedBoxGeometry(CW + 0.06, 0.03, CD + 0.06, 3, 0.012), wood); base.position.set(CX, FL + 0.015, 0); g.add(base);
  const body = new THREE.Mesh(new RoundedBoxGeometry(CW, 0.32, CD, 3, 0.01), wood); body.position.set(CX, FL + 0.03 + 0.16, 0); g.add(body);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(CW + 0.04, 0.03, CD + 0.04, 3, 0.012), wood); lid.position.set(CX, TOP - 0.015, 0); g.add(lid);
  // 몰딩 사이 금줄(황동 띠)
  for (const y of [FL + 0.031, TOP - 0.031]) { const b = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.004, 0.005, CD + 0.004), brassDark); b.position.set(CX, y, 0); g.add(b); }
  // 앞면 장식: 금박 테 두 줄 + 모서리 덩굴 + T/L/L + 글자
  { const [c, x] = canvas(2048, 560);
    x.clearRect(0, 0, 2048, 560);
    const goldG = () => { const gg = x.createLinearGradient(0, 0, 0, 560); gg.addColorStop(0, '#f7e3a0'); gg.addColorStop(0.5, '#c49a3c'); gg.addColorStop(1, '#f0d27a'); return gg; };
    x.strokeStyle = goldG(); x.lineWidth = 6; x.strokeRect(70, 60, 1908, 440); x.lineWidth = 2.5; x.strokeRect(92, 82, 1864, 396);
    for (const [cx, cy, sx, sy] of [[92, 82, 1, 1], [1956, 82, -1, 1], [92, 478, 1, -1], [1956, 478, -1, -1]]) { // 모서리 덩굴
      x.save(); x.translate(cx, cy); x.scale(sx, sy); x.lineWidth = 3; x.beginPath(); x.moveTo(10, 40); x.bezierCurveTo(10, 10, 40, 10, 70, 18); x.bezierCurveTo(100, 26, 110, 60, 80, 62); x.bezierCurveTo(60, 64, 58, 44, 72, 42); x.stroke();
      x.beginPath(); x.moveTo(40, 10); x.bezierCurveTo(20, 30, 30, 70, 18, 100); x.stroke(); x.beginPath(); x.arc(70, 40, 5, 0, 7); x.fillStyle = goldG(); x.fill(); x.restore(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'italic 700 150px Georgia, "Times New Roman", serif'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,6,2,.85)'; x.strokeText('T/L/L', 1024, 236); x.fillStyle = goldG(); x.fillText('T/L/L', 1024, 236);
    x.font = '600 40px Georgia, serif'; if ('letterSpacing' in x) x.letterSpacing = '14px'; x.fillStyle = goldG(); x.fillText('BRASS CYLINDER PHONOGRAPH', 1024, 368);
    x.font = 'italic 30px Georgia, serif'; if ('letterSpacing' in x) x.letterSpacing = '4px'; x.fillText('— Trade ✦ Mark —', 1024, 428);
    x.lineWidth = 2.5; x.strokeStyle = goldG(); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(1024 + s * 230, 236); x.lineTo(1024 + s * 560, 236); x.stroke(); x.beginPath(); x.arc(1024 + s * 580, 236, 8, 0, 7); x.stroke(); }
    const t = ctex(c);
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.06, (CW - 0.06) * 560 / 2048), new THREE.MeshPhysicalMaterial({ map: t, transparent: true, metalness: 0.5, roughness: 0.32, clearcoat: 1, depthWrite: false, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 }));
    dec.position.set(CX, FL + 0.03 + 0.16, CD / 2 + 0.0012); dec.renderOrder = 2; g.add(dec); }
  // 황동 모서리 쇠(뚜껑 네 귀)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.05), brassDark); k.position.set(CX + sx * (CW / 2 + 0.0), TOP - 0.015, sz * (CD / 2 + 0.0)); g.add(k); }
  // 태엽 손잡이(오른쪽 옆): 장미꽃 받침 + S자 팔 + 검은 나무 손잡이. 감을 때 돈다
  const crankG = new THREE.Group(); crankG.position.set(CX - CW / 2 - 0.004, FL + 0.17, 0.1); crankG.rotation.y = Math.PI; g.add(crankG); // 왼쪽 옆(모터 쪽)
  { const ros = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.01, 32), brass); ros.rotation.z = Math.PI / 2; crankG.add(ros);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16), nickel); sh.rotation.z = Math.PI / 2; sh.position.x = 0.025; crankG.add(sh); }
  const crankArm = new THREE.Group(); crankArm.position.x = 0.05; crankG.add(crankArm);
  { const shp = new THREE.Shape(); shp.moveTo(-0.012, 0); shp.bezierCurveTo(-0.02, 0.05, 0.03, 0.07, 0.015, 0.13); shp.lineTo(0.035, 0.13); shp.bezierCurveTo(0.05, 0.07, 0.0, 0.05, 0.012, 0); shp.closePath();
    const arm = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), brass); arm.rotation.y = Math.PI / 2; crankArm.add(arm);
    const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.07, 20), new THREE.MeshPhysicalMaterial({ color: 0x140c08, roughness: 0.35, clearcoat: 1 })); kn.rotation.z = Math.PI / 2; kn.position.set(0.04, 0.13, 0.025); crankArm.add(kn); }

  // ---------- 기계판·모터 상자·조속기 ----------
  // 검은 칠 판 + 금줄
  { const [c, x] = canvas(1024, 460); x.fillStyle = '#121010'; x.fillRect(0, 0, 1024, 460);
    x.strokeStyle = '#c9a44e'; x.lineWidth = 3; x.strokeRect(22, 22, 980, 416); x.lineWidth = 1.2; x.strokeRect(34, 34, 956, 392);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.016, 0.44), [japan, japan, new THREE.MeshPhysicalMaterial({ map: ctex(c), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }), japan, japan, japan]);
    plate.position.set(CX + 0.03, TOP + 0.008, -0.01); g.add(plate); }
  const housing = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.27, 0.22, 4, 0.025), brass); housing.position.set(HX, TP + 0.135, 0.0); g.add(housing);
  { const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 32), brassDark); boss.rotation.z = Math.PI / 2; boss.position.set(XR + 0.0, YM, ZM); g.add(boss);
    // 상자 앞 명판(작은 타원)
    const [c, x] = canvas(256, 128); x.fillStyle = '#16110a'; x.beginPath(); x.ellipse(128, 64, 120, 56, 0, 0, 7); x.fill(); x.strokeStyle = '#e6c46c'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#e6c46c'; x.font = '700 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('T/L/L', 128, 50); x.font = '16px Georgia, serif'; x.fillText('No. 1924', 128, 84);
    const np = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ map: ctex(c), metalness: 0.6, roughness: 0.3, transparent: true })); np.position.set(HX, TP + 0.11, 0.1105); g.add(np); }
  // 조속기: 모터 상자 위에서 도는 축 + 공 셋(빨리 돌수록 벌어짐)
  const gov = new THREE.Group(); gov.position.set(HX, TP + 0.27, 0.0); g.add(gov);
  { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 12), nickel); sp.position.y = 0.06; gov.add(sp);
    const capT = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), brass); capT.position.y = 0.122; gov.add(capT); }
  const balls = [];
  for (let i = 0; i < 3; i++) { const arm = new THREE.Group(); arm.position.y = 0.105; arm.rotation.y = (i / 3) * Math.PI * 2; gov.add(arm);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 8), nickel); rod.position.y = -0.03; arm.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 14), brass); ball.position.y = -0.06; arm.add(ball); balls.push(arm); }

  // ---------- 만드릴·실린더 ----------
  const spin = new THREE.Group(); spin.position.set(0, YM, ZM); g.add(spin);
  { const ml = XL - XR, mg = new THREE.CylinderGeometry(RM + 0.004, RM, ml, 64, 1, false); mg.rotateZ(Math.PI / 2); // 모터 쪽(왼쪽)이 조금 굵음(테이퍼)
    const mand = new THREE.Mesh(mg, nickel); mand.position.x = (XR + XL) / 2; spin.add(mand);
    const capE = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), brass); capE.rotation.z = Math.PI / 2; capE.position.x = XL + 0.006; spin.add(capE);
    // 돌 때 보이게: 만드릴 끝에 구멍 넷
    for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), japan); h.rotation.y = Math.PI / 2; const a = (i / 4) * Math.PI * 2; h.position.set(XL + 0.013, Math.cos(a) * 0.065, Math.sin(a) * 0.065); spin.add(h); } }
  // 이송 나사(나선 줄무늬) · 안내 막대 · 왼쪽 받침 기둥
  const [sc, sx2] = canvas(64, 512); sx2.fillStyle = '#d8d9dc'; sx2.fillRect(0, 0, 64, 512); for (let y = 0; y < 512; y += 6) { sx2.fillStyle = 'rgba(30,30,34,.55)'; sx2.fillRect(0, y, 64, 2); }
  const screwT = ctex(sc); screwT.wrapS = screwT.wrapT = THREE.RepeatWrapping; screwT.repeat.set(1, 6);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, XL - XR + 0.04, 16), new THREE.MeshStandardMaterial({ map: screwT, metalness: 1, roughness: 0.25 })); screw.rotation.z = Math.PI / 2; screw.position.set((XR + XL) / 2 + 0.02, YM - 0.07, RODZ); g.add(screw);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, XL - XR + 0.06, 20), nickel); rod.rotation.z = Math.PI / 2; rod.position.set((XR + XL) / 2 + 0.03, RODY, RODZ); g.add(rod);
  { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, RODY - TP, 16), brass); post.position.set(XL + 0.05, (RODY + TP) / 2, RODZ); g.add(post);
    const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 20), brass); ft.position.set(XL + 0.05, TP + 0.006, RODZ); g.add(ft);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), brass); knob.position.set(XL + 0.05, RODY, RODZ); g.add(knob); }
  // 캐리지: 안내 막대를 축으로 들리는 팔 + 재생기(위를 보는 진동판) + 아래 반 너트 팔
  const car = new THREE.Group(); car.position.set(P0, RODY, RODZ); g.add(car);
  const RZ = ZM - RODZ; // 막대에서 재생기까지 앞으로
  { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.075, 20), brass); sl.rotation.z = Math.PI / 2; car.add(sl);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.012, RZ + 0.02, 2, 0.004), brass); arm.position.set(0, 0.03, RZ / 2); arm.rotation.x = -Math.atan2(0.06, RZ); car.add(arm);
    const nut = new THREE.Mesh(new RoundedBoxGeometry(0.022, RODY - (YM - 0.07) + 0.01, 0.022, 2, 0.004), brassDark); nut.position.set(0, -(RODY - (YM - 0.07)) / 2, 0); car.add(nut);
    const lev = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 8), nickel); lev.rotation.x = 0.6; lev.position.set(0.03, 0.03, 0.02); car.add(lev);
    const lk = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0x140c08, clearcoat: 1, roughness: 0.3 })); lk.position.set(0.03, 0.055, 0.04); car.add(lk); }
  const rep = new THREE.Group(); rep.position.set(0, 0.06, RZ); car.add(rep);
  { const ringM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.058, 0.03, 48, 1, true), nickel); rep.add(ringM);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.058, 48), nickel); bot.rotation.x = Math.PI / 2; bot.position.y = -0.015; rep.add(bot);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.004, 8, 48), brass); rimT.rotation.x = Math.PI / 2; rimT.position.y = 0.015; rep.add(rimT);
    const mica = new THREE.Mesh(new THREE.CircleGeometry(0.054, 48), new THREE.MeshPhysicalMaterial({ color: 0x8f8470, roughness: 0.15, metalness: 0.2, iridescence: 0.8, iridescenceIOR: 1.6, clearcoat: 1, transparent: true, opacity: 0.85 }));
    mica.rotation.x = -Math.PI / 2; mica.position.y = 0.0135; rep.add(mica);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.012, 16), brass); hub.position.y = 0.02; rep.add(hub);
    // 바늘대: 밑에서 실린더 윗면까지
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.032, 0.006), nickel); st.position.set(0, -0.03, 0); rep.add(st);
    const wt = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.016), brassDark); wt.position.set(0.012, -0.022, 0); rep.add(wt);
    // 팔꿈치: 진동판 위 가운데에서 솟아 뒤로 꺾임(여기에 고무관)
    const el = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(0, 0.08, -0.05)), 12, 0.011, 12, false), brass); rep.add(el); }
  const ELB = new THREE.Vector3(0, 0.08, -0.05); // 팔꿈치 끝(재생기 기준)

  // ---------- 나팔(고정) ----------
  // 굽은 길을 따라 반지름이 점점 커지는 관(지수 나팔처럼 끝에서 확 퍼짐), 판 열 장을 이은 이음매 줄
  // 목(가는 관)은 재생기 위에서 솟아 뒤로 넘어가 상자 뒤로 낮게 휘돌고, 나팔꽃(퍼지는 끝)은 곧게 왼쪽 뒤에서 보는 사람 쪽으로 고개를 듦
  const BELL_D = new THREE.Vector3(0.3, 0.45, 0.84).normalize(), BELL = new THREE.Vector3(-0.5, 0.48, -0.2);
  const bAt = (k) => BELL.clone().addScaledVector(BELL_D, -k);
  const hornPts = [new THREE.Vector3(-0.06, 0.66, -0.1), new THREE.Vector3(-0.08, 0.72, -0.3), new THREE.Vector3(-0.28, 0.7, -0.56), new THREE.Vector3(-0.56, 0.48, -0.78), new THREE.Vector3(-0.72, 0.22, -0.78), bAt(0.42), bAt(0.22), BELL];
  const hornC = new THREE.CatmullRomCurve3(hornPts, false, 'centripetal');
  const HS = 120, HR = 36, R0 = 0.017, R1 = 0.26;
  const hornR = (u) => R0 + (R1 - R0) * Math.pow(u, 3.4);
  const [hc, hx] = canvas(512, 512); { const gr = hx.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#d7b064'); gr.addColorStop(1, '#d7b064'); hx.fillStyle = gr; hx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10; i++) { const x = (i / 10) * 512; hx.fillStyle = 'rgba(90,55,15,.45)'; hx.fillRect(x, 0, 2, 512); hx.fillStyle = 'rgba(255,240,200,.35)'; hx.fillRect(x + 2, 0, 1.5, 512); }
    for (let i = 0; i < 400; i++) { hx.fillStyle = `rgba(${rnd() < 0.5 ? '120,80,30' : '255,235,180'},${rnd() * 0.08})`; hx.beginPath(); hx.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 8, 0, 7); hx.fill(); } }
  const hornT = ctex(hc);
  const hornG = (() => {
    const fr = hornC.computeFrenetFrames(HS, false), pos = [], nor = [], uv = [], idx = [];
    // 프레네 틀은 휘는 곳에서 뒤집힐 수 있어 회전 최소 틀로 다시 계산
    const N = [fr.normals[0].clone()], B = [fr.binormals[0].clone()];
    for (let i = 1; i <= HS; i++) { const t0 = fr.tangents[i - 1], t1 = fr.tangents[i]; const q = new THREE.Quaternion().setFromUnitVectors(t0, t1); N.push(N[i - 1].clone().applyQuaternion(q)); B.push(B[i - 1].clone().applyQuaternion(q)); }
    for (let i = 0; i <= HS; i++) { const u = i / HS, p = hornC.getPointAt(u), r = hornR(u);
      for (let j = 0; j <= HR; j++) { const a = (j / HR) * Math.PI * 2, n = N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(B[i], Math.sin(a));
        pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); nor.push(n.x, n.y, n.z); uv.push(j / HR, u); } }
    for (let i = 0; i < HS; i++) for (let j = 0; j < HR; j++) { const a = i * (HR + 1) + j, b = a + HR + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    return { geo, N, B };
  })();
  const hornM = new THREE.MeshPhysicalMaterial({ map: hornT, metalness: 1, roughness: 0.26, roughnessMap: brassRough, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 1.5 });
  const horn = new THREE.Mesh(hornG.geo, hornM); g.add(horn);
  // 안쪽: 등불을 머금은 따뜻한 황동(밤에도 나팔 속이 보이게 아주 옅게 스스로 빛남)
  const hornIn = new THREE.Mesh(hornG.geo, new THREE.MeshPhysicalMaterial({ map: hornT, color: 0xe0b060, metalness: 0.55, roughness: 0.35, side: THREE.BackSide, envMapIntensity: 1.6, emissive: 0x6a3e12, emissiveIntensity: 0.55 })); g.add(hornIn);
  // 나팔 끝 말린 테 + 목 고리
  const bellP = hornC.getPointAt(1), bellT = hornC.getTangentAt(1);
  { const rim = new THREE.Mesh(new THREE.TorusGeometry(R1, 0.008, 12, 96), brass); rim.position.copy(bellP); rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bellT); g.add(rim);
    for (const u of [0.02, 0.35, 0.62]) { const p = hornC.getPointAt(u), t = hornC.getTangentAt(u); const c = new THREE.Mesh(new THREE.TorusGeometry(hornR(u) + 0.004, 0.005, 8, 32), brassDark); c.position.copy(p); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t); g.add(c); } }
  // 나팔 받침(크레인): 상자 뒤 왼쪽 기계판에서 솟은 기둥 → 팔 → 나팔을 감은 고리
  { const HU = 0.3, hp = hornC.getPointAt(HU), foot = new THREE.Vector3(-0.2, TOP, -0.3);
    const top = new THREE.Vector3(foot.x, hp.y - hornR(HU) - 0.04, foot.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, top.y - foot.y, 16), nickel); post.position.copy(foot).add(top).multiplyScalar(0.5); g.add(post);
    const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.014, 20), brass); ft.position.copy(foot).setY(TOP + 0.007); g.add(ft);
    const armV = new THREE.Vector3().subVectors(hp, top), armL = armV.length() - hornR(HU);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, armL, 12), nickel); arm.position.copy(top).addScaledVector(armV.clone().normalize(), armL / 2); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armV.clone().normalize()); g.add(arm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(hornR(HU) + 0.006, 0.006, 8, 32), nickel); ring.position.copy(hp); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hornC.getTangentAt(HU)); g.add(ring); }
  // 고무관(천 감음): 재생기 팔꿈치 → 나팔 목. 재생기가 옮겨 가면 다시 그림
  const throat = hornC.getPointAt(0);
  const [tc, tx] = canvas(64, 256); tx.fillStyle = '#2a1c12'; tx.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 4) { tx.fillStyle = 'rgba(0,0,0,.35)'; tx.fillRect(0, y, 64, 2); tx.fillStyle = 'rgba(120,80,50,.25)'; tx.fillRect(0, y + 2, 64, 1); }
  const tubeT = ctex(tc); tubeT.wrapS = tubeT.wrapT = THREE.RepeatWrapping; tubeT.repeat.set(1, 6);
  const hose = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: tubeT, roughness: 0.9 })); g.add(hose);
  let hoseKey = '';
  const _e = new THREE.Vector3(), _m = new THREE.Vector3();
  function stepHose() {
    car.updateMatrixWorld(); g.updateMatrixWorld();
    _e.copy(ELB); rep.localToWorld(_e); g.worldToLocal(_e);
    const k = _e.x.toFixed(3) + _e.y.toFixed(3) + _e.z.toFixed(3); if (k === hoseKey) return; hoseKey = k;
    _m.copy(_e).add(throat).multiplyScalar(0.5); _m.z -= 0.06; _m.y -= 0.02;
    hose.geometry.dispose(); hose.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(_e.clone(), _m.clone(), throat.clone().addScaledVector(hornC.getTangentAt(0), -0.005)), 20, 0.0125, 10, false);
  }

  // ---------- 실린더 그림 ----------
  // 표지 대표색(채도 높은 것들의 평균)을 어둡게 → 셀룰로이드 바탕. 없으면 블루 앰버롤 남색
  function colorOf(img, L) {
    if (L && L.vc && L.vc[0]) return new THREE.Color(L.vc[0]);
    if (!img) return new THREE.Color(0x1d2d52);
    try { const [c, x] = canvas(16, 16); x.drawImage(img, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), s = mx ? (mx - mn) / mx : 0, k = s * s + 0.02; r += d[i] * k; gg += d[i + 1] * k; b += d[i + 2] * k; w += k; }
      return new THREE.Color().setRGB(r / w / 255, gg / w / 255, b / w / 255, THREE.SRGBColorSpace); } catch { return new THREE.Color(0x1d2d52); }
  }
  function drawCyl(R, L, img) {
    const { x, c } = R, W = c.width, H = c.height;
    const S = THREE.SRGBColorSpace, col = colorOf(img, L), hsl = {}; col.getHSL(hsl, S);
    const base = new THREE.Color().setHSL(hsl.h, Math.min(0.75, hsl.s * 1.1 + 0.1), 0.17, S), hi = new THREE.Color().setHSL(hsl.h, Math.min(0.8, hsl.s + 0.15), 0.36, S);
    const css = (cc) => '#' + cc.getHexString();
    // 세로(H) = 실린더 길이(왼쪽 끝 = 위), 가로(W) = 둘레
    const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, css(base)); gr.addColorStop(0.5, css(hi)); gr.addColorStop(1, css(base));
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    const g0 = G0 * H, g1 = G1 * H; // 소리 홈 띠
    for (let y = g0; y < g1; y += 1.6) { x.fillStyle = `rgba(0,0,0,${0.18 + (y % 3.2 < 1.6 ? 0.08 : 0)})`; x.fillRect(0, y, W, 0.7); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, y + 0.8, W, 0.5); }
    // 곡 사이 무음 홈: 반짝이는 매끈한 띠
    for (const f of (L && L.tracks) || []) { const y = g0 + clamp01(f) * (g1 - g0); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(0, y - 2, W, 4); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, y + 2, W, 1); }
    // 홈 없는 양끝 + 왼쪽 끝 각인 띠(제목 · 아티스트 · T/L/L)
    x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(0, 0, W, g0 - 4); x.fillRect(0, g1 + 4, W, H - g1 - 4);
    const name = (L && L.name) || 'T/L/L', who = (L && L.artist) || '';
    x.font = `600 ${Math.round(H * 0.06)}px Georgia, "Noto Serif KR", serif`; x.textBaseline = 'middle'; x.textAlign = 'center';
    const line = [name, who, 'T/L/L CYLINDER'].filter(Boolean).join('  ·  ');
    const tw = Math.min(W * 0.48, x.measureText(line).width);
    for (const cx of [W * 0.25, W * 0.75]) { x.save(); x.translate(cx, (g1 + H) / 2); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillText(line, 1, 1.5, tw); x.fillStyle = 'rgba(255,236,190,.82)'; x.fillText(line, 0, 0, tw); x.restore(); }
    R.t.needsUpdate = true;
    if (R.endM) R.endM.color.copy(base).multiplyScalar(1.3);
  }
  function makeCyl() {
    const [c, x] = canvas(1024, 512);
    const t = ctex(c); t.wrapS = THREE.RepeatWrapping;
    const grp = new THREE.Group();
    const m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color(0x8899bb) });
    const geo = new THREE.CylinderGeometry(RC, RC, CL, 96, 1, true); geo.rotateZ(Math.PI / 2); // 위(v=1) = 왼쪽(-x)
    const out = new THREE.Mesh(geo, m); grp.add(out);
    const inn = new THREE.Mesh(new THREE.CylinderGeometry(RM + 0.003, RM + 0.006, CL, 48, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.9, side: THREE.BackSide })); grp.add(inn);
    const endM = new THREE.MeshPhysicalMaterial({ color: 0x223355, roughness: 0.3, clearcoat: 1 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.RingGeometry(RM + 0.004, RC, 64), endM); e.rotation.y = s * Math.PI / 2; e.position.x = s * CL / 2; grp.add(e); }
    grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const R = { c, x, t, endM };
    grp.userData.R = R; grp.userData.mats = [m, endM, inn.material];
    return grp;
  }
  // 마분지 통(판 갈기에 씀): 주황 마분지 + 가운데 앨범 표지 + 제목 + 뚜껑
  function makeBox(L, img) {
    const grp = new THREE.Group();
    const [c, x] = canvas(1024, 512);
    const draw = (img) => {
    x.fillStyle = '#b4682a'; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '60,25,5' : '230,170,110'},${rnd() * 0.09})`; x.fillRect(rnd() * 1024, rnd() * 512, 2, 1); }
    x.fillStyle = '#f1e4c8'; x.fillRect(312, 40, 400, 432); x.strokeStyle = '#2b1a0c'; x.lineWidth = 3; x.strokeRect(322, 50, 380, 412);
    x.fillStyle = '#2b1a0c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'italic 700 34px Georgia, serif'; x.fillText('T/L/L', 512, 82);
    x.font = '600 14px Georgia, serif'; if ('letterSpacing' in x) x.letterSpacing = '4px'; x.fillText('CYLINDER RECORD', 512, 110); if ('letterSpacing' in x) x.letterSpacing = '0px';
    if (img) { try { x.drawImage(img, 392, 126, 240, 240); } catch {} } else { x.fillStyle = '#3a2a1a'; x.fillRect(392, 126, 240, 240); }
    x.strokeRect(392, 126, 240, 240);
    const clipT = (s, w) => { if (x.measureText(s).width <= w) return s; while (s.length > 1 && x.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
    x.font = '700 24px Georgia, "Noto Serif KR", serif'; x.fillText(clipT((L && L.name) || '', 360), 512, 400);
    x.font = 'italic 18px Georgia, "Noto Serif KR", serif'; x.fillText(clipT((L && L.artist) || '', 360), 512, 432);
    // 양옆 띠(4분음표·숫자)
    x.fillStyle = '#2b1a0c'; for (const sx of [130, 894]) { x.font = '700 40px Georgia, serif'; x.fillText('No.', sx, 220); x.font = '700 64px Georgia, serif'; x.fillText(String(4000 + ((L && L.name ? L.name.length * 37 : 1) % 900)), sx, 290); }
    };
    draw(img);
    const t = ctex(c);
    grp.userData.draw = (im) => { draw(im); t.needsUpdate = true; };
    const cardSide = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), cardTop = new THREE.MeshStandardMaterial({ color: 0x8a4a1c, roughness: 0.9 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.52, 48), [cardSide, cardTop, cardTop]); tube.position.y = 0.26; tube.rotation.y = Math.PI; grp.add(tube); // 표지 띠가 앞(카메라 쪽)으로
    const lidG = new THREE.Group(); lidG.position.y = 0.52; grp.add(lidG);
    const [lc, lx] = canvas(256, 256); lx.fillStyle = '#4a2410'; lx.fillRect(0, 0, 256, 256); lx.strokeStyle = '#e0b46a'; lx.lineWidth = 6; lx.beginPath(); lx.arc(128, 128, 100, 0, 7); lx.stroke(); lx.fillStyle = '#e0b46a'; lx.font = 'italic 700 52px Georgia, serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('T/L/L', 128, 132);
    const lidM = new THREE.MeshStandardMaterial({ color: 0x4a2410, roughness: 0.8 });
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.147, 0.147, 0.07, 48), [lidM, new THREE.MeshStandardMaterial({ map: ctex(lc), roughness: 0.8 }), lidM]); lidMesh.position.y = 0.0; lidG.add(lidMesh);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    grp.userData.lid = lidG;
    return grp;
  }

  let rec = makeCyl(); spin.add(rec); rec.position.x = XC;
  let label = null, labelKey = '';
  function setLabel(L) {
    label = L;
    const key = L ? [L.name, L.artist, L.img, (L.vc || []).join(), (L.tracks || []).map((f) => f.toFixed(3)).join(',')].join('|') : '';
    if (key === labelKey || pdrop) return; labelKey = key;
    const R = rec.userData.R; drawCyl(R, L, null);
    loadImg(L && L.img).then((im) => { if (im && labelKey === key) drawCyl(R, L, im); });
  }

  // ---------- 누르는 자리(상자·기계 전체) ----------
  const hitM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.1, YM + 0.2 - FL, CD), hitM); hit.position.set(CX, (YM + 0.2 + FL) / 2, 0); hit.userData.act = 'phono'; g.add(hit);
  const hit2 = new THREE.Mesh(new THREE.SphereGeometry(R1 + 0.04, 16, 12), hitM); hit2.position.copy(bellP); hit2.userData.act = 'phono'; g.add(hit2);
  const noShadow = new Set([hit, hit2]);
  g.traverse((o) => { if (o.isMesh && !noShadow.has(o)) { o.castShadow = true; o.receiveShadow = true; } });
  hit.castShadow = hit2.castShadow = false;

  // 밤에 황동이 살게: 기계 위 따뜻한 등(보이는 동안만 켜짐) + 나팔 안을 비추는 낮은 빛
  const lamp = new THREE.PointLight(0xffd6a0, 0, 2.6, 1.6); lamp.position.set(0.05, 1.25, 0.7); g.add(lamp);
  const bellL = new THREE.PointLight(0xffc880, 0, 1.0, 2); bellL.position.copy(bellP).addScaledVector(bellT, 0.25); g.add(bellL);

  // ---------- 움직임 ----------
  let ang = 0, vel = 0, carX = P0, lift = 1, crankT = -1, crankA = 0;
  const gaps = [];
  let pdrop = null;
  const _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _Z = new THREE.Vector3(0, 0, 1);
  const LIFT_UP = 0.55;
  // st: { playing, progress, cue, night, now }
  function step(dt, T, st) {
    const now = performance.now(), busy = !!pdrop;
    // 만드릴: 160rpm(실제)는 너무 빨라 보여서 초당 1.4바퀴
    const target = (st.playing || st.cue) && !busy ? 1.4 * Math.PI * 2 : 0;
    vel += (target - vel) * Math.min(1, dt * (target ? 2.2 : 1.4)); ang += vel * dt; spin.rotation.x = -ang;
    // 조속기: 속도만큼 돌고 공이 벌어짐
    gov.rotation.y += vel * 2.6 * dt; const open = Math.min(1, vel / (1.4 * Math.PI * 2));
    balls.forEach((a) => { a.rotation.z = 0.12 + open * 0.75; });
    // 재생기: 재생 중이면 진행 자리에 내려앉고, 큐 'lead'면 처음 자리 위에 들려 있고, 'down'이면 천천히 내림, 판 갈 땐 높이 들림
    const cueArm = !st.playing && !busy && (st.cue === 'lead' || st.cue === 'down');
    const xT = busy ? P0 : st.playing ? lerp(P0, P1, clamp01(st.progress)) : cueArm ? P0 : carX;
    const far = Math.abs(xT - carX) > 0.004;
    const liftT = busy ? 1 : cueArm && st.cue === 'lead' ? 0.35 : far ? 0.35 : st.playing || (cueArm && st.cue === 'down') ? 0 : 0.35;
    lift += (liftT - lift) * Math.min(1, dt * (cueArm && st.cue === 'down' ? 2.2 : 5));
    if (!far || lift > 0.3) carX += (xT - carX) * Math.min(1, dt * (far ? 2.5 : 1.5));
    car.position.x = carX; car.rotation.x = -lift * LIFT_UP - (st.playing && !far ? 0.004 * Math.sin(ang * 1) : 0);
    stepHose();
    // 태엽: 감을 때 1.4초 동안 세 바퀴
    if (crankT >= 0) { const k = (now - crankT) / 1400; if (k >= 1) crankT = -1; else crankA = ease(k) * Math.PI * 6; }
    crankArm.rotation.x = -crankA;
    // 곡 사이 무음 홈 빛남
    for (let i = gaps.length - 1; i >= 0; i--) { const gp = gaps[i], k = (now - gp.t0) / 1600; if (k >= 1) { spin.remove(gp.m); gaps.splice(i, 1); } else gp.m.material.opacity = (1 - k) * 0.9; }
    lamp.intensity = g.visible ? lerp(0.25, 1.5, st.night) : 0; bellL.intensity = g.visible ? lerp(0.1, 1.4, st.night) : 0;
    if (pdrop) stepDrop(now);
  }

  // ---------- 판 갈기 ----------
  const STAND = new THREE.Vector3(0.5, FL, 0.6); // 통이 서는 자리(앞 오른쪽)
  const HOVER = new THREE.Vector3(XC + CL + 0.1, YM, ZM + 0.02); // 실린더가 눕혀져 기다리는 자리(만드릴 오른쪽 빈 끝 앞)
  function drop(L, slam, img) {
    if (pdrop) { finish(); }
    const n = makeCyl(); drawCyl(n.userData.R, L, img); if (!img && L && L.img) loadImg(L.img).then((im) => im && pdrop && pdrop.n === n && drawCyl(n.userData.R, L, im));
    const box = makeBox(L, img); g.add(box); box.visible = false;
    if (!img && L && L.img) loadImg(L.img).then((im) => { if (im && pdrop && pdrop.box === box) box.userData.draw(im); });
    g.add(n); n.visible = false;
    // 옛 실린더: 만드릴에서 떼어 기계부 좌표로
    const old = rec; spin.updateMatrixWorld(); old.getWorldPosition(_w); g.worldToLocal(_w); spin.remove(old); old.position.copy(_w); old.rotation.set(0, 0, 0); g.add(old); rec = null;
    label = L; labelKey = L ? [L.name, L.artist, L.img, (L.vc || []).join(), (L.tracks || []).map((f) => f.toFixed(3)).join(',')].join('|') : '';
    pdrop = { t0: performance.now(), slam: !!slam, n, box, old, handed: false };
  }
  function finish() {
    const d = pdrop; if (!d) return;
    if (d.old) { g.remove(d.old); d.old = null; }
    if (!d.handed) { g.remove(d.n); spin.add(d.n); d.n.position.set(XC, 0, 0); d.n.rotation.set(0, 0, 0); d.n.visible = true; rec = d.n; d.handed = true; }
    g.remove(d.box); pdrop = null;
  }
  function stepDrop(now) {
    const d = pdrop, T = d.slam ? 1900 : 3000, t = (now - d.t0) / T, box = d.box, n = d.n, lidG = box.userData.lid;
    // 옛 실린더: 왼쪽으로 빠져나가며 들리고 흐려짐
    if (d.old) { const k = seg(t, 0, d.slam ? 0.3 : 0.2); d.old.position.set(lerp(XC, XC + CL + 0.25, ease(k)), YM + easeIn(k) * 0.25, ZM + easeIn(k) * 0.1);
      d.old.userData.mats.forEach((m) => { m.transparent = true; m.opacity = 1 - seg(k, 0.4, 1); }); if (k >= 1) { g.remove(d.old); d.old = null; } }
    const hand = d.slam ? 0.76 : 0.84;
    if (!d.slam) {
      // 통: 왼쪽 위에서 날아와 섬(0~0.15) → 뚜껑 튐(0.17~0.3) → 실린더가 솟음(0.2~0.45) → 통은 왼쪽으로 빠짐(0.5~0.68)
      const inK = easeOut(seg(t, 0, 0.15)), outK = easeIn(seg(t, 0.5, 0.68));
      box.visible = t < 0.7;
      box.position.set(lerp(STAND.x + 0.9, STAND.x, inK) + outK * 1.2, lerp(FL + 0.9, FL, inK) + Math.sin(inK * Math.PI) * 0.05 + outK * 0.15, lerp(STAND.z - 0.3, STAND.z, inK));
      box.rotation.set(lerp(0.6, 0, inK), lerp(1.4, 0.2, inK), lerp(-0.9, 0, inK) - outK * 0.8);
      const lk = seg(t, 0.17, 0.3); lidG.position.set(lk * 0.1, 0.52 + easeOut(lk) * 0.35 - easeIn(seg(t, 0.3, 0.45)) * 0.9, lk * 0.05); lidG.rotation.set(lk * 2.2, 0, lk * 1.4); lidG.visible = t < 0.45;
    } else {
      // 플레이리스트: 통이 위에서 떨어져 0.34(0.646초)에 쾅 → 튐 → 0.4 뚜껑 → 0.42~0.55 실린더 튀어나옴 → 통은 0.55~0.72 빠짐
      const fall = seg(t, 0.05, 0.34), bounce = seg(t, 0.34, 0.45), outK = easeIn(seg(t, 0.55, 0.72));
      box.visible = t < 0.74;
      box.position.set(STAND.x + outK * 1.3, (t < 0.34 ? lerp(1.9, FL, easeIn(fall)) : FL + Math.sin(bounce * Math.PI) * 0.06) + outK * 0.2, STAND.z);
      box.rotation.set(0, 0.2 - fall * 0.3, t < 0.34 ? lerp(0.5, 0, fall) : -Math.sin(bounce * Math.PI) * 0.06 - outK * 0.8);
      const lk = seg(t, 0.38, 0.48); lidG.position.set(-lk * 0.08, 0.52 + easeOut(lk) * 0.4 - easeIn(seg(t, 0.48, 0.6)) * 1.0, 0); lidG.rotation.set(-lk * 2, 0, -lk); lidG.visible = t < 0.6;
    }
    if (d.handed) { if (t >= 1) finish(); return; }
    // 실린더: 통 속(세움) → 솟음 → 눕히며 만드릴 왼쪽으로 → 끼워짐
    const r0 = d.slam ? 0.4 : 0.2, r1 = d.slam ? 0.52 : 0.45, m1 = d.slam ? 0.68 : 0.76;
    n.visible = t >= r0;
    box.updateMatrixWorld();
    const inBox = _w.set(0, 0.26, 0); box.localToWorld(inBox); g.worldToLocal(inBox);
    const upK = easeOut(seg(t, r0, r1));
    const up = new THREE.Vector3(inBox.x, inBox.y + upK * (0.55 + 0.12), inBox.z);
    _qa.setFromAxisAngle(_Z, Math.PI / 2).premultiply(_q.copy(box.quaternion)); // 세운 실린더(축 = 통 축)
    if (t < r1) { n.position.copy(up); n.quaternion.copy(_qa); return; }
    const k = ease(seg(t, r1, m1));
    _qb.identity(); // 눕힘(축 = x)
    n.position.lerpVectors(up, HOVER, k); n.position.y += Math.sin(k * Math.PI) * 0.18;
    n.quaternion.slerpQuaternions(_qa, _qb, k);
    if (t >= m1) { const s = easeIn(seg(t, m1, hand)); n.position.set(lerp(HOVER.x, XC, s), YM, lerp(HOVER.z, ZM, s)); n.quaternion.identity(); }
    if (t >= hand) {
      d.handed = true; g.remove(n); spin.add(n); n.position.set(XC, 0, 0); n.rotation.set(0, 0, 0); n.quaternion.identity(); rec = n; vel = 0;
      // 끼워지며 살짝 흔들림
      spin.position.y = YM - 0.004; setTimeout(() => { spin.position.y = YM; }, 90);
    }
  }
  function flashGap(f) {
    if (!rec) return;
    const x = lerp(P0, P1, clamp01(f)); // 그림 위 = 실린더 왼쪽 끝
    const m = new THREE.Mesh(new THREE.TorusGeometry(RC + 0.0008, 0.0035, 6, 96), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.y = Math.PI / 2; m.position.x = x; spin.add(m); gaps.push({ m, t0: performance.now() });
  }
  function crank() { crankT = performance.now(); }
  const busyF = () => !!pdrop || crankT >= 0 || gaps.length > 0 || Math.abs(vel) > 0.01;
  return { g, hits: [hit, hit2], step, setLabel, drop, finish, dropping: () => !!pdrop, flashGap, crank, busy: busyF, lively: () => !!pdrop || crankT >= 0 };
}
