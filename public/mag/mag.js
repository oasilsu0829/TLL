// 잡지 (MAG): 우편함 → 택배 상자 → 비닐 → 넘겨 읽기 → 마지막 장 부록 싱글. 책장에서는 지난 호를 바로 연다.
// 지면은 issues/<id>/issue.html (펼침마다 <template class="sp">). 화면 전체를 덮는 겹 하나를 Shadow DOM으로 그려
// 음악 앱 CSS와 섞이지 않게 한다. 저장: localStorage mag.opened {id: 시각}, mag.page {id: 넘긴 장 수}
const core = () => window.MusicCore;
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const BASE = '/mag/issues/';
let root, sh, list = [], cur = null, spreads = [], state = 'home', tab = 'shelf', k = 0, wide = false, leaves = [], torn = false, faces = [];
const issueCache = new Map();
const $ = (s) => sh.querySelector(s);

/* ── 소리 (Web Audio 합성, 파일 없음) ── */
let ac;
function noise(dur, freq, type, gain) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (Math.random() < .3 ? 1 : .45);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = gain;
    s.connect(f).connect(g).connect(ac.destination); s.start();
  } catch {}
}
const sfxOn = () => LS.get('music.sfx') !== false;
const sfx = {
  tape: () => sfxOn() && noise(.6, 1800, 'bandpass', .5), tear: () => sfxOn() && noise(.4, 2500, 'highpass', .4),
  page: () => sfxOn() && noise(.22, 700, 'lowpass', .35), peel: () => sfxOn() && noise(.3, 3000, 'bandpass', .35),
};

const CSS = `
:host{all:initial;position:fixed;inset:0;z-index:400;display:block;font-family:'Noto Sans KR',system-ui,sans-serif;color:#e9e2d6;
  --desk:#24201c;--desk2:#2e2924;--kraft:#c79f68;--kraft2:#a9814e;--kraftIn:#7d5f38;--packtape:rgba(150,104,52,.88)}
*{box-sizing:border-box}
.wrapall{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%,var(--desk2),var(--desk));overflow:hidden;-webkit-tap-highlight-color:transparent}
button{font:inherit;color:inherit}
.mbar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:max(12px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));z-index:60}
.tabs{display:flex;gap:6px}
.chip{background:rgba(36,32,28,.6);border:1px solid rgba(233,226,214,.35);border-radius:999px;padding:6px 14px;min-height:36px;cursor:pointer;font-size:13px}
.chip[aria-pressed="true"]{background:#e9e2d6;color:#24201c;border-color:#e9e2d6}
.chip:focus-visible{outline:2px solid #f59ad6;outline-offset:2px}
.hint{position:absolute;left:0;right:0;bottom:0;padding:10px 16px max(14px,env(safe-area-inset-bottom,0px));text-align:center;font-size:14px;pointer-events:none;z-index:50;display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap}
.hint button{pointer-events:auto}
.view{position:absolute;inset:0;padding:70px max(16px,env(safe-area-inset-right,0px)) 70px max(16px,env(safe-area-inset-left,0px));overflow:auto;transition:opacity .4s}
.view[hidden]{display:none}
h2{margin:0 0 6px;font-family:'Noto Serif KR',Georgia,serif;font-weight:900;font-size:clamp(22px,4vw,30px);text-align:center;color:#f3eee6}
.sub{margin:0 0 22px;text-align:center;color:#b9b0a2;font-size:14px}
.parcels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;width:min(900px,100%);margin:0 auto}
@media (max-width:700px){.parcels{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}
.parcel{position:relative;aspect-ratio:1/1.08;border:0;padding:0;cursor:pointer;background:linear-gradient(180deg,var(--kraft),var(--kraft2));border-radius:4px;box-shadow:0 16px 30px rgba(0,0,0,.45);transform:rotate(var(--r));transition:transform .25s}
.parcel:hover,.parcel:focus-visible{transform:rotate(var(--r)) translateY(-6px);outline:none}
.parcel::before{content:"";position:absolute;left:0;right:0;top:44%;height:14%;background:var(--packtape)}
.parcel .lb{position:absolute;left:9%;top:10%;width:74%;background:#fbfaf6;color:#161514;font-family:monospace;font-size:clamp(9px,1.2vw,11px);line-height:1.45;padding:6px 8px;text-align:left;transform:rotate(-2deg)}
.parcel .lb b{display:block;font-family:'Noto Sans KR',sans-serif;font-weight:900;font-size:1.15em;border-bottom:1.5px solid #161514;margin-bottom:3px}
.parcel .dot{position:absolute;right:8%;bottom:10%;width:32%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;font-size:clamp(10px,1.5vw,14px);color:#fff;transform:rotate(-8deg);text-align:center;line-height:1}
.empty{text-align:center;color:#b9b0a2;font-size:14px;margin-top:40px}
/* 책장 */
.shelf{width:min(1000px,100%);margin:0 auto 34px}
.shelf h3{margin:0 0 10px;font-size:13px;letter-spacing:.14em;font-family:monospace;color:#cfc6b6;display:flex;justify-content:space-between}
.ledge{position:relative;display:flex;gap:18px;align-items:flex-end;overflow-x:auto;padding:10px 6px 26px;scrollbar-width:thin}
.ledge::after{content:"";position:sticky;left:0;display:none}
.board{height:14px;margin-top:-20px;background:linear-gradient(180deg,#8a6440,#5b4128);border-radius:2px;box-shadow:0 10px 18px rgba(0,0,0,.45)}
.mini{flex:0 0 auto;width:132px;border:0;padding:0;background:none;cursor:pointer;text-align:left;transition:transform .2s}
.mini:hover,.mini:focus-visible{transform:translateY(-6px);outline:none}
.mini .cv{position:relative;width:132px;aspect-ratio:3/4;overflow:hidden;box-shadow:0 8px 16px rgba(0,0,0,.45);background:#fff}
.mini .cv .spw{position:absolute;inset:0}
.mini{position:relative}
.mini .newb{position:absolute;left:-6px;top:-8px;z-index:3;background:#e2341d;color:#fff;font:700 11px/1 monospace;letter-spacing:.08em;padding:5px 7px;border-radius:3px;transform:rotate(-6deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}
.mini.new .cv::after{content:"";position:absolute;inset:0;background:linear-gradient(118deg,transparent 30%,rgba(255,255,255,.35) 38%,transparent 46%),rgba(220,228,236,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)}
.mini small{display:block;margin-top:8px;font-size:12px;color:#cfc6b6;line-height:1.4}
.mini small b{color:#f3eee6;font-weight:700}
/* 상자 */
.boxv{display:flex;align-items:center;justify-content:center}
.box{position:relative;width:var(--bw);height:calc(var(--bw)*1.12);touch-action:none;cursor:ew-resize;perspective:1400px}
.inner{position:absolute;inset:0;background:var(--kraftIn);border-radius:4px;box-shadow:inset 0 0 40px rgba(0,0,0,.55),0 30px 60px rgba(0,0,0,.5)}
.inner .mag{position:absolute;inset:9% 14%;background:var(--magc);box-shadow:0 6px 18px rgba(0,0,0,.4);transition:transform .9s}
.inner .mag::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.4) 32%,transparent 40%)}
.box.open .inner .mag{transform:translateY(-6%) scale(1.04)}
.flap{position:absolute;left:0;right:0;height:50%;background:linear-gradient(180deg,var(--kraft),var(--kraft2));transition:transform 1s cubic-bezier(.3,.7,.2,1);backface-visibility:hidden;border-radius:3px}
.flap::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,.035) 0 2px,transparent 2px 9px)}
.flap.top{top:0;transform-origin:top center}.flap.bot{bottom:0;transform-origin:bottom center}
.box.open .flap.top{transform:rotateX(178deg)}.box.open .flap.bot{transform:rotateX(-178deg)}
.tape{position:absolute;left:-2%;right:-2%;height:28%;background:var(--packtape)}
.flap.top .tape{bottom:0}.flap.bot .tape{top:0}
.slit{position:absolute;left:0;top:50%;height:3px;margin-top:-1.5px;background:#1a120a;width:0;z-index:5}
.box.open .slit{opacity:0}
.label{position:absolute;left:8%;top:9%;width:60%;background:#fbfaf6;color:#161514;font-family:monospace;font-size:calc(var(--bw)*.028);line-height:1.5;padding:3% 4%;transform:rotate(-1.5deg)}
.label b{font-family:'Noto Sans KR',sans-serif;font-weight:900;font-size:1.15em;display:block;border-bottom:1.5px solid #161514;margin-bottom:4%}
.warn{position:absolute;right:7%;top:12%;width:24%;aspect-ratio:1;border-radius:50%;background:#d23a26;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:calc(var(--bw)*.03);line-height:1.25;transform:rotate(8deg)}
/* 책 */
.bookv{display:flex;align-items:center;justify-content:center;perspective:2600px}
.book{position:relative;width:var(--bkw);height:var(--ph);transition:transform .8s cubic-bezier(.3,.6,.2,1);touch-action:pan-y}
.leaf{position:absolute;top:0;left:var(--lx);width:var(--pw);height:var(--ph);transform-origin:left center;transform-style:preserve-3d;transition:transform .85s cubic-bezier(.3,.6,.2,1)}
.leaf.flipped{transform:rotateY(-180deg)}
.leaf.far{display:none}
.face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;background:#fbfaf6;box-shadow:0 18px 40px rgba(0,0,0,.45)}
.face.back{transform:rotateY(180deg)}
.face.front::before{content:"";position:absolute;inset:0;z-index:40;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.12),transparent 6%)}
.face.back::before{content:"";position:absolute;inset:0;z-index:40;pointer-events:none;background:linear-gradient(270deg,rgba(0,0,0,.12),transparent 6%)}
.spw{position:absolute;top:0;height:100%}
.spw>.spread{width:100%!important;height:100%!important;aspect-ratio:auto!important;box-shadow:none!important}
.blank{background:#f1ede4}
/* 비닐 */
.wrapv{position:absolute;inset:-1.5%;z-index:45;touch-action:none;cursor:ew-resize;border:1px solid rgba(255,255,255,.55);background:linear-gradient(112deg,transparent 18%,rgba(255,255,255,.42) 24%,transparent 31%,transparent 55%,rgba(255,255,255,.16) 62%,transparent 70%),linear-gradient(200deg,rgba(255,255,255,.14),transparent 30%),repeating-linear-gradient(77deg,rgba(255,255,255,.05) 0 1px,transparent 1px 23px),rgba(255,255,255,.07)}
.wst{position:absolute;left:6%;bottom:24%;background:#f08a16;color:#fff;border-radius:50%;width:19%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:calc(var(--pw)*.026);line-height:1.25;transform:rotate(-10deg)}
.tearl{position:absolute;height:3px;background:rgba(255,255,255,.9);box-shadow:0 0 6px rgba(255,255,255,.8);width:0;z-index:46;pointer-events:none}
.shard{position:absolute;inset:-1.5%;z-index:46;pointer-events:none;transition:transform .9s cubic-bezier(.3,.6,.2,1),opacity .9s}
.pgno{position:absolute;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom,0px)) + 30px);transform:translateX(-50%);font-family:monospace;font-size:12px;color:#b9b0a2;z-index:55}
.nav{position:absolute;top:50%;z-index:55;width:44px;height:64px;margin-top:-32px;border:0;background:rgba(36,32,28,.35);border-radius:8px;cursor:pointer;font-size:22px}
.nav.prev{left:max(6px,env(safe-area-inset-left,0px))}.nav.next{right:max(6px,env(safe-area-inset-right,0px))}
@media (hover:none){.nav{display:none}}
/* 부록 싱글 떼기 */
.single7{cursor:pointer;transition:transform .5s cubic-bezier(.3,.6,.2,1)}
.single7 .tp{transition:transform .45s,opacity .45s}
.single7.taken{transform:rotate(0deg) translateY(-2cqw) scale(1.04)!important;z-index:5}
.single7.taken .tp{transform:rotate(-35deg) translateY(-60%)!important;opacity:0}
.single7:focus-visible{outline:2px solid #2a2fb0;outline-offset:4px}
.single7.lp12 .sl,.single7.lp12 .bg{display:none}
.single7.lp12 .lpimg{position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:.25cqw;box-shadow:0 .5cqw 1cqw rgba(0,0,0,.22),0 1.6cqw 3.4cqw rgba(0,0,0,.2);-webkit-user-drag:none;user-select:none}
.single7.lp12 .tp{z-index:2}
.single7.lp12.taken{transform:rotate(0deg) translateY(-2cqw) scale(1.03)!important}
.toast{position:absolute;left:50%;top:60px;transform:translate(-50%,-30px);opacity:0;background:#fbfaf6;color:#161514;padding:10px 16px;border-radius:10px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);transition:.3s;z-index:70;max-width:calc(100% - 32px);pointer-events:none}
.toast.on{transform:translate(-50%,0);opacity:1}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
`;

function ensureRoot() {
  if (root) return;
  root = document.createElement('div'); root.id = 'magRoot';
  sh = root.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${CSS}</style><div class="wrapall">
    <div class="mbar"><div class="tabs" role="tablist"><button class="chip" data-t="shelf" type="button" aria-pressed="true">책장</button></div>
      <div class="tabs"><button class="chip" id="back" type="button" hidden>← 목록</button><button class="chip" id="close" type="button" aria-label="잡지 닫기">닫기</button></div></div>
    <section class="view" id="vMail"></section>
    <section class="view" id="vShelf" hidden></section>
    <section class="view boxv" id="vBox" hidden><div class="box" id="box" role="button" tabindex="0" aria-label="택배 상자. 테이프를 가로로 그어서 열기">
      <div class="inner"><div class="mag"></div></div>
      <div class="flap top"><div class="label" id="lbl"></div><div class="warn">구부리지<br>마세요</div><div class="tape"></div></div>
      <div class="flap bot"><div class="tape"></div></div><div class="slit" id="slit"></div></div></section>
    <section class="view bookv" id="vBook" hidden><div class="book" id="book"></div>
      <button class="nav prev" id="prev" type="button" aria-label="이전 쪽">‹</button><button class="nav next" id="next" type="button" aria-label="다음 쪽">›</button>
      <div class="pgno" id="pgno"></div></section>
    <div class="hint"><span id="hint"></span><button class="chip" id="alt" type="button" hidden></button></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>`;
  document.body.appendChild(root);
  for (const b of sh.querySelectorAll('[data-t]')) b.addEventListener('click', () => { tab = b.dataset.t; home(); });
  $('#close').addEventListener('click', close);
  $('#back').addEventListener('click', home);
  $('#alt').addEventListener('click', () => { if (state === 'box') openBox(); else if (state === 'wrap') tearWrap(.5); });
  $('#prev').addEventListener('click', () => turn(-1));
  $('#next').addEventListener('click', () => turn(1));
  bindBox(); bindBook();
  addEventListener('resize', () => { if (state === 'read' || state === 'wrap') { const w = wide; measure(); if (w !== wide) { k = wide ? Math.ceil(k / 2) : k * 2; buildBook(); } } });
  addEventListener('keydown', onKey);
}
function onKey(e) {
  if (!root || root.hidden) return;
  if (e.key === 'Escape') { e.stopPropagation(); if (state === 'home') close(); else home(); }
  if (state === 'read') { if (e.key === 'ArrowRight') turn(1); if (e.key === 'ArrowLeft') turn(-1); }
}
let toastT = 0;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
function hint(t, a) { $('#hint').textContent = t || ''; const b = $('#alt'); b.hidden = !a; if (a) b.textContent = a; }
function show(id) { for (const v of sh.querySelectorAll('.view')) v.hidden = v.id !== id; }

async function loadList() {
  const r = await fetch(BASE + 'index.json', { cache: 'no-cache' });
  const k = new Date(Date.now() + 9 * 3600e3), ym = k.toISOString().slice(0, 7), mon = k.getUTCMonth() + 1;
  list = ((await r.json()).issues || []).map((x) => x.dynamic ? { ...x, id: `${x.mag}-${ym}`, vol: `${k.getUTCFullYear()}.${String(mon).padStart(2, '0')}`, date: `${ym.replace('-', '.')}.01`, title: `나의 ${mon}월 — 내 청취 기록으로 짠 호` } : x);
}
async function loadIssue(it) {
  if (issueCache.has(it.id)) return issueCache.get(it.id);
  const html = await (await fetch(BASE + it.dir + '/issue.html')).text();
  if (it.dynamic) { // 33⅓: 지면 모양(CSS)은 정적 호에서, 내용은 그 자리에서 Spotify 기록으로
    const v0 = parseIssue(it, html);
    const m = await import('/mag/m33.js');
    const r = await m.build(core());
    it.tracks = r.tracks; it.singles = 1;
    const v = { css: v0.css, sp: r.sp.map((x) => lp12(it, x)) };
    if (r.tracks.length) issueCache.set(it.id, v);
    return v;
  }
  const v = parseIssue(it, html); v.sp = v.sp.map((x) => lp12(it, x));
  issueCache.set(it.id, v); return v;
}
// 부록 싱글 = 12인치 LP. 투명 비닐(PVC) 커버에 잡지사 시그니처가 인쇄된 그림(sleeves/<mag>.webp)으로 바꿔 끼운다
const sleeveOf = (mag) => `/mag/sleeves/${mag}.webp`;
function lp12(it, html) {
  return html.replace(/<div class="single7 bigs"([^>]*)>/g, (_, rest) => `<div class="single7 bigs lp12"${rest.replace('부록 싱글', '부록 LP')}><img class="lpimg" src="${sleeveOf(it.mag)}" alt="${it.name} 부록 LP, 투명 비닐 커버" draggable="false">`);
}
function parseIssue(it, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const link = doc.querySelector('link[rel=stylesheet]');
  if (link && !document.querySelector(`link[href="${link.href}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = link.getAttribute('href'); document.head.appendChild(l); }
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n').replace(/:root\s*\{/g, `.iss-${it.id}{`);
  const sp = [...doc.querySelectorAll('template.sp')].map((t) => t.innerHTML);
  return { css, sp };
}

/* ── 우편함 · 책장 ── */
const opened = () => LS.get('mag.opened') || {};
async function home() {
  state = 'home'; $('#back').hidden = true;
  for (const b of sh.querySelectorAll('[data-t]')) b.setAttribute('aria-pressed', String(b.dataset.t === tab));
  hint('');
  if (tab === 'mail') {
    show('vMail');
    const fresh = list.filter((x) => !opened()[x.id]);
    $('#vMail').innerHTML = `<h2>우편함</h2><p class="sub">${fresh.length ? `잡지 ${fresh.length}권이 도착했습니다. 상자를 골라 여세요.` : '새로 온 잡지가 없습니다. 읽은 호는 책장에 꽂혀 있습니다.'}</p><div class="parcels">${fresh.map((x, i) => `
      <button class="parcel" type="button" data-id="${x.id}" style="--r:${[-3, 2, -1.5, 3][i % 4]}deg" aria-label="${x.name} 상자 열기">
        <span class="lb"><b>${x.publisher} → 구독자 님</b>${x.name} ${x.vol}<br>부록 LP 1장<br>${x.date}</span>
        <span class="dot" style="background:${x.color}">${x.name}</span></button>`).join('')}</div>`;
    for (const b of sh.querySelectorAll('.parcel')) b.addEventListener('click', () => openParcel(list.find((x) => x.id === b.dataset.id)));
  } else {
    show('vShelf');
    const mags = [...new Map(list.map((x) => [x.mag, x])).values()];
    const read = opened();
    const shelves = mags.map((m) => {
      const its = list.filter((x) => x.mag === m.mag); // 안 연 새 호도 비닐째 꽂힘(NEW) → 누르면 상자부터
      return `<div class="shelf"><h3><span>${m.name} — ${m.publisher}</span><span>${its.length}권</span></h3>
        <div class="ledge">${its.length ? its.map((x) => `<button class="mini${read[x.id] ? '' : ' new'}" type="button" data-id="${x.id}"><div class="cv iss iss-${x.id}" data-cv="${x.id}"></div>${read[x.id] ? '' : '<span class="newb">NEW</span>'}<small><b>${x.vol}</b> · ${x.date}<br>${x.title}</small></button>`).join('') : '<span class="empty" style="margin:20px 0">아직 꽂힌 호가 없습니다</span>'}</div><div class="board"></div></div>`;
    }).join('');
    const nNew = list.filter((x) => !read[x.id]).length;
    $('#vShelf').innerHTML = `<h2>책장</h2><p class="sub">${nNew ? `새 호 ${nNew}권이 비닐째 꽂혀 있습니다. 누르면 상자부터 엽니다.` : '출판사별로 꽂힙니다. 누르면 바로 펼칩니다.'}</p>${shelves}`;
    for (const b of sh.querySelectorAll('.mini')) b.addEventListener('click', () => { const it = list.find((x) => x.id === b.dataset.id); if (opened()[it.id]) openRead(it); else openParcel(it); });
    for (const cv of sh.querySelectorAll('[data-cv]')) {
      const it = list.find((x) => x.id === cv.dataset.cv);
      loadIssue(it).then((v) => { ensureCss(it, v); cv.innerHTML = `<div class="spw" style="width:100%">${v.sp[0]}</div>`; }).catch(() => {});
    }
  }
}
function ensureCss(it, v) {
  if (sh.querySelector(`style[data-iss="${it.id}"]`)) return;
  const st = document.createElement('style'); st.dataset.iss = it.id; st.textContent = v.css; sh.appendChild(st);
}

/* ── 상자 ── */
let bx = null;
function openParcel(it) {
  cur = it; state = 'box'; torn = false; k = 0;
  show('vBox'); $('#back').hidden = false; measure();
  const box = $('#box'); box.classList.remove('open'); $('#slit').style.width = 0;
  box.style.setProperty('--magc', it.color);
  $('#lbl').innerHTML = `<b>${it.publisher} → 구독자 님</b>보내는 곳: ${it.publisher}<br>받는 곳: T/L/L 우편함<br>내용물: ${it.name} ${it.vol} 1부<br>부록 LP 1장(투명 비닐)<br>${it.date}`;
  hint('테이프를 따라 가로로 그어서 상자를 여세요', '칼로 자르기');
  loadIssue(it).catch(() => toast('잡지를 불러오지 못했습니다'));
  box.focus({ preventScroll: true });
}
function bindBox() {
  const box = $('#box'), slit = $('#slit');
  box.addEventListener('pointerdown', (e) => { if (state !== 'box') return; bx = { x: e.clientX, max: 0, r: box.getBoundingClientRect() }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => {
    if (!bx) return;
    const p = Math.min(1, Math.abs(e.clientX - bx.x) / bx.r.width);
    if (p > bx.max) { bx.max = p; slit.style.width = p * 100 + '%'; slit.style.left = Math.max(0, (Math.min(e.clientX, bx.x) - bx.r.left) / bx.r.width * 100) + '%'; if (Math.random() < .3 && sfxOn()) noise(.05, 1800, 'bandpass', .25); }
    if (p > .7) { bx = null; openBox(); }
  });
  box.addEventListener('pointerup', () => { if (bx && bx.max < .7) slit.style.width = 0; bx = null; });
  box.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && state === 'box') { e.preventDefault(); openBox(); } });
}
function openBox() {
  state = 'opening'; const slit = $('#slit'); slit.style.left = 0; slit.style.width = '100%'; sfx.tape(); hint('상자를 여는 중…');
  setTimeout(() => $('#box').classList.add('open'), 250);
  setTimeout(async () => { await loadIssue(cur); state = 'wrap'; show('vBook'); buildBook(); hint('비닐을 가로로 그어 뜯으세요', '비닐 뜯기'); }, 2000);
}

/* ── 책 ── */
function measure() {
  const vw = innerWidth - 32, vh = innerHeight - 150;
  wide = innerWidth >= 820;
  let w = wide ? Math.min(560, (vw - 90) / 2) : Math.min(520, vw);
  w = Math.min(w, vh * .75);
  const r = root.style;
  r.setProperty('--pw', w + 'px'); r.setProperty('--ph', w * 4 / 3 + 'px');
  r.setProperty('--bkw', (wide ? 2 * w : w) + 'px'); r.setProperty('--lx', (wide ? w : 0) + 'px');
  r.setProperty('--bw', Math.min(420, vw, vh * .85) + 'px');
}
// 펼침 하나를 두 배 폭으로 그리고 반쪽만 보이게 한다 → 어떤 레이아웃이든 한 쪽씩 넘길 수 있다
const half = (i, side) => {
  if (i < 0 || i >= spreads.length) return '';
  const c = `spw iss iss-${cur.id}`;
  if (i === 0) return `<div class="${c}" style="left:0;width:100%">${spreads[0]}</div>`;
  return `<div class="${c}" style="left:${side === 'L' ? '0' : '-100%'};width:200%">${spreads[i]}</div>`;
};
function pagesList() { // 좁은 화면: 표지 + 펼침마다 왼쪽·오른쪽
  const out = [[0, 'C']];
  for (let i = 1; i < spreads.length; i++) out.push([i, 'L'], [i, 'R']);
  return out;
}
function buildBook() {
  measure();
  const v = issueCache.get(cur.id); spreads = v.sp; ensureCss(cur, v);
  const book = $('#book');
  let groups;
  if (wide) { groups = [[half(0), half(1, 'L')]]; for (let i = 1; i < spreads.length; i++) groups.push([half(i, 'R'), half(i + 1, 'L')]); }
  else groups = pagesList().map(([i, s]) => [half(i, s), '']);
  // 아이폰 사파리는 3D 장이 많으면 메모리가 넘쳐 탭을 닫는다 → 지금 장 근처만 내용을 넣고(near) 나머지는 비워서 숨긴다
  faces = groups.map(([f, b], i) => [f + (i === 0 && state === 'wrap' && !torn ? wrapHTML() : ''), b]);
  book.innerHTML = groups.map(([, b]) => `<div class="leaf far"><div class="face front"></div><div class="face back ${b ? '' : 'blank'}"></div></div>`).join('');
  leaves = [...book.querySelectorAll('.leaf')];
  near();
  if (state === 'wrap' && !torn) bindWrap();
  apply();
}
const wrapHTML = () => `<div class="wrapv" aria-label="비닐 포장. 가로로 그어서 뜯기"><div class="wst">부록 LP<br>1장 수록</div></div><div class="tearl"></div>`;
const NEAR = 2;
function near() {
  leaves.forEach((L, i) => {
    const on = (i >= k - NEAR && i <= k + NEAR) || (i === 0 && state === 'wrap');
    if (on === !L.classList.contains('far')) return;
    L.classList.toggle('far', !on);
    const [fr, bk] = L.children;
    fr.innerHTML = on ? (i === 0 && torn ? faces[0][0].replace(wrapHTML(), '') : faces[i][0]) : ''; bk.innerHTML = on ? faces[i][1] : '';
  });
}
function apply(moving = -1) {
  const n = leaves.length;
  near();
  leaves.forEach((L, i) => { L.classList.toggle('flipped', i < k); L.style.zIndex = i === moving ? 200 : (i < k ? i + 1 : n - i + 10); });
  if (moving >= 0) setTimeout(() => apply(), 880);
  $('#book').style.transform = wide && k === 0 ? 'translateX(calc(var(--pw) * -.5))' : '';
  $('#pgno').textContent = state === 'read' ? `${k + 1} / ${n}` : '';
  if (state === 'read') { hint(lastPage() ? '부록 LP를 누르면 테이프를 떼고 재생합니다' : ''); const pg = LS.get('mag.page') || {}; pg[cur.id] = k; LS.set('mag.page', pg); }
}
const lastPage = () => k >= leaves.length - 1;
function turn(d) {
  if (state !== 'read') return;
  const n = leaves.length;
  if (d > 0 && k < n - 1) { k++; sfx.page(); apply(k - 1); } else if (d < 0 && k > 0) { k--; sfx.page(); apply(k); }
}
function bindWrap() {
  const w = sh.querySelector('.wrapv'), line = sh.querySelector('.tearl');
  if (!w) return;
  let t = null;
  w.addEventListener('pointerdown', (e) => { if (state !== 'wrap') return; const r = w.getBoundingClientRect(); t = { x: e.clientX, y: e.clientY - r.top, r, max: 0 }; w.setPointerCapture(e.pointerId); line.style.top = t.y + 'px'; line.style.left = (e.clientX - r.left) + 'px'; });
  w.addEventListener('pointermove', (e) => {
    if (!t) return;
    const dx = e.clientX - t.x, p = Math.min(1, Math.abs(dx) / t.r.width);
    if (p > t.max) { t.max = p; line.style.width = Math.abs(dx) + 'px'; line.style.left = (Math.min(e.clientX, t.x) - t.r.left) + 'px'; if (Math.random() < .25 && sfxOn()) noise(.04, 2600, 'highpass', .2); }
    if (p > .7) { const y = t.y / t.r.height; t = null; tearWrap(y); }
  });
  w.addEventListener('pointerup', () => { if (t) line.style.width = 0; t = null; });
}
function tearWrap(y = .5) {
  if (torn) return;
  torn = true; sfx.tear();
  const w = sh.querySelector('.wrapv'), line = sh.querySelector('.tearl');
  if (w) {
    const yy = Math.max(15, Math.min(85, y * 100)), zig = [];
    for (let i = 0; i <= 20; i++) zig.push(`${i * 5}% ${yy + (i % 2 ? 1.5 : -1.5)}%`);
    const bg = getComputedStyle(w).background, top = w.cloneNode(true), bot = w.cloneNode(true);
    [top, bot].forEach((s) => { s.className = 'shard'; s.style.background = bg; w.parentNode.appendChild(s); });
    top.style.clipPath = `polygon(0 0,100% 0,${zig.slice().reverse().join(',')})`;
    bot.style.clipPath = `polygon(${zig.join(',')},100% 100%,0 100%)`;
    w.remove(); if (line) line.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      top.style.transform = 'translate(-30%,-70%) rotate(-14deg)'; top.style.opacity = 0;
      bot.style.transform = 'translate(25%,70%) rotate(10deg)'; bot.style.opacity = 0;
    }));
    setTimeout(() => { top.remove(); bot.remove(); }, 950);
  }
  const o = opened(); o[cur.id] = Date.now(); LS.set('mag.opened', o); updateDot();
  state = 'read'; apply();
}
function bindBook() {
  const bookEl = $('#book');
  let sw = null;
  bookEl.addEventListener('pointerdown', (e) => { if (state !== 'read') return; sw = { x: e.clientX, y: e.clientY }; });
  bookEl.addEventListener('pointerup', (e) => {
    if (!sw || state !== 'read') return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (e.target.closest('a')) return;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { turn(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) return;
    const act = e.target.closest('[data-act]');
    if (act) { if (act.dataset.act === 'relogin') { const C = core(); if (C) C.relogin(); } return; }
    const one = e.target.closest('.single7');
    if (one) { takeSingle(one); return; }
    const r = bookEl.getBoundingClientRect();
    turn(e.clientX > (wide ? r.left + r.width / 2 : r.left + r.width * .35) ? 1 : -1);
  });
  bookEl.addEventListener('keydown', (e) => { const s = e.target.closest('.single7'); if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); takeSingle(s); } });
}

/* ── 부록 싱글: 테이프를 떼고 Spotify에서 찾아 재생, 출판사 크레이트에 꽂기 ── */
async function takeSingle() {
  for (const x of sh.querySelectorAll('.single7')) x.classList.add('taken');
  sfx.peel();
  const C = core(), tracks = cur.tracks || [];
  if (!C || !C.loggedIn()) { toast('Spotify에 연결하면 이 LP를 바로 들을 수 있습니다'); return; }
  if (!tracks.length) return;
  try {
    const saved = LS.get('mag.pl') || {};
    let ent = saved[cur.id];
    if (!ent) {
      toast('부록 LP를 꺼내는 중…');
      const found = [];
      for (const s of tracks) {
        if (s.uri) { found.push({ uri: s.uri, img: s.img }); continue; }
        const j = await C.api('/search?' + new URLSearchParams({ type: 'track', limit: '1', q: `track:${s.t} artist:${s.a.split(' · ')[0]}` })).catch(() => null);
        const tr = j && j.tracks && j.tracks.items && j.tracks.items[0];
        if (tr) found.push({ uri: tr.uri, img: tr.album && tr.album.images && tr.album.images[0] && tr.album.images[0].url });
      }
      if (!found.length) { toast('부록 곡을 Spotify에서 찾지 못했습니다'); return; }
      const name = `${cur.name} ${cur.vol} 부록`;
      ent = await makePlaylist(C, name, `${cur.publisher} · ${cur.date} · T/L/L 잡지 부록 LP`, found.map((f) => f.uri)).catch(() => null);
      if (!ent) { await playUris(C, found.map((f) => f.uri)); toast(`▶ 부록 ${found.length}곡 재생 (플레이리스트는 만들지 못했습니다)`); return; }
      ent.n = found.length;
      saved[cur.id] = ent; LS.set('mag.pl', saved);
    }
    ent = { ...ent, m: cur.mag, img: sleeveOf(cur.mag) }; // 예전에 만든 것도 비닐 LP로
    C.addToCrate(cur.crate.id, cur.crate.name, cur.crate.o, ent);
    C.playAlbum(ent);
    toast(`▶ ${ent.name} — ${cur.crate.name} 크레이트에 꽂았습니다`);
  } catch (e) { toast(e.message || '재생하지 못했습니다'); }
}
async function makePlaylist(C, name, description, uris) {
  if (!C.hasScope('playlist-modify-private')) throw new Error('scope');
  const body = { name, description, public: false };
  let pl;
  try { pl = await C.api('/me/playlists', { method: 'POST', body }); }
  catch { const me = await C.api('/me'); pl = await C.api(`/users/${encodeURIComponent(me.id)}/playlists`, { method: 'POST', body }); }
  try { await C.api(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris } }); }
  catch { await C.api(`/playlists/${pl.id}/tracks`, { method: 'POST', body: { uris } }); }
  return { k: 'pl', id: pl.id, name, artist: cur.publisher };
}
async function playUris(C, uris) {
  const id = encodeURIComponent(await C.targetDevice());
  await C.api('/me/player/play?device_id=' + id, { method: 'PUT', body: { uris } });
}

/* ── 책장에서 바로 펼치기 ── */
async function openRead(it) {
  cur = it; torn = true; state = 'read'; $('#back').hidden = false;
  try { await loadIssue(it); } catch { toast('잡지를 불러오지 못했습니다'); return; }
  show('vBook'); k = 0; buildBook(); k = Math.min((LS.get('mag.page') || {})[it.id] || 0, leaves.length - 1); apply();
}

function updateDot() { const d = document.getElementById('magDot'); if (d) d.hidden = !list.some((x) => !opened()[x.id]); }
export async function open() {
  ensureRoot(); root.hidden = false; document.body.style.overflow = 'hidden';
  // 뒤의 앱(3D 턴테이블·유리 칸)은 잡지를 보는 동안 그리지 않는다
  document.body.classList.add('magon'); if (window.Deck3D && Deck3D.suspend) Deck3D.suspend(true);
  try { await loadList(); } catch { list = []; }
  tab = 'shelf';
  home();
}
// 신간 팝업에서: 그 호를 바로 연다(안 연 호면 상자부터)
export async function openIssue(id) {
  await open();
  const it = list.find((x) => x.id === id); if (!it) return;
  if (opened()[it.id]) openRead(it); else openParcel(it);
}
export function close() {
  if (!root) return;
  root.hidden = true; document.body.style.overflow = ''; state = 'home';
  if (sh) { const b = sh.querySelector('#book'); if (b) b.innerHTML = ''; leaves = []; faces = []; }
  document.body.classList.remove('magon'); if (window.Deck3D && Deck3D.suspend) Deck3D.suspend(false);
}
