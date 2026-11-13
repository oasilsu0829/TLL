// 잼 모드 (2026-11-12). 음악 앱 위에 화면 전체를 덮는다: 불이 꺼지고 카세트 라디오(3D)와 J카드(손글씨 셋리스트)만 남는다
// - 잼 하나 = Spotify 공동 작업 플레이리스트 하나("JAM 11.12"). 나는 J카드 빈 줄을 눌러 곡·앨범을 넣는다
// - 친구는 이 앱(/#jam)을 열면 손님 창(guest.js)에서 곡을 보낸다(Spotify 로그인·공동 작업자 초대 필요 없음).
//   서버 대기열(/api/music/jam/add)에 쌓이면 이 화면이 4초마다 가져가 내 토큰으로 넣는다(pullGuests). 셋리스트·지금 곡은 서버에 올려 손님 창이 읽는다(publish)
// - 참가(2026-11-13): 로그인한 친구는 JAM 버튼(초록 점)이나 링크로 같은 잼에 들어온다(join, J.cur.guest).
//   화면은 똑같은 카세트·J카드. 셋리스트는 서버에서 읽고(플레이리스트가 비공개라 친구 토큰으로는 못 읽음), 곡 넣기·건반·J카드 누르기는
//   서버 조작 대기열(/api/music/jam/ctl)로 보내 호스트 화면이 실행한다. 친구 기기는 호스트의 지금 곡·위치를 따라 자기 Spotify로 튼다(follow)
//   잼을 끝내는 건 호스트만. 참가자의 STOP/EJ 두 번 = 나가기
// - 4초마다 플레이리스트를 읽어 새 줄을 손글씨로 적는다. 지금 곡은 형광펜, 들은 곡은 줄을 긋는다. 곡이 바뀌면 앨범 표지 폴라로이드가 데크 옆에 꽂힌다
// - 건반: PLAY 재생 · PAUSE 잠깐 · FF/REW 다음/이전 · REC 장식(녹음 중 표시) · STOP/EJ 멈춤, 멈춘 채 두 번 = 잼 끝(테이프가 튀어나와 JAM 크레이트로)
// - 저장 music.jam = { id, tape, at, name, replay } (새로고침해도 잼이 이어진다), music.jamTape = 바로 전 잼 테이프(겹치지 않게)
// - 음악 앱(index.html)이 window.MusicCore로 api·토큰·기기·크레이트 저장을 넘겨준다
import { createBoombox, tapeFor } from './boombox.js';

const C = window.MusicCore;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const BASE = new URL('./', import.meta.url).href;
const today = () => { const d = new Date(); return { md: `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`, ymd: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }; };
const now0 = () => Date.now();
const fmt = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- 화면 ----------
const CSS = `
.jam { position: fixed; inset: 0; z-index: 80; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); gap: 2vw; padding: max(18px, env(safe-area-inset-top)) max(22px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(22px, env(safe-area-inset-left));
  background: radial-gradient(ellipse 60% 55% at 34% 52%, #2a2723 0%, #121110 55%, #070707 100%); color: #efe9dc; font-family: 'Space Grotesk', 'Noto Sans KR', sans-serif;
  opacity: 0; transition: opacity .7s ease; user-select: none; overflow: hidden; }
.jam.on { opacity: 1; }
.jam::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 34% 40%, rgba(255,236,200,.13), transparent 42%); opacity: 0; transition: opacity .25s ease .75s; }
.jam.lit::before { opacity: 1; }
.jam-stage { position: relative; min-height: 0; }
.jam-cv { position: fixed; inset: 0; width: 100vw; height: 100dvh; display: block; touch-action: none; z-index: 0; opacity: 0; transition: opacity 1.1s ease; }
.jam.lit .jam-cv { opacity: 1; }
.jam-cv { image-rendering: pixelated; image-rendering: crisp-edges; }
.jam-dith { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: .1; mix-blend-mode: soft-light; image-rendering: pixelated; }
.jam-bub { position: fixed; z-index: 3; max-width: min(260px, 70vw); padding: 10px 14px 12px; background: #f4efe3; color: #2a2622; border-radius: 14px 14px 14px 3px; font-family: 'Nanum Pen Script', cursive; font-size: 22px; line-height: 1.1;
  box-shadow: 0 10px 22px rgba(0,0,0,.55); transform-origin: 0 100%; animation: jbub .45s cubic-bezier(.2,.9,.25,1.3) both; pointer-events: none; }
.jam-bub small { display: block; font-size: 17px; color: rgba(42,38,34,.65); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jam-bub.out { animation: jbubo .35s ease both; }
@keyframes jbub { from { transform: translate(0, -100%) scale(.3); opacity: 0; } to { transform: translate(0, -100%); opacity: 1; } }
@keyframes jbubo { from { transform: translate(0, -100%); opacity: 1; } to { transform: translate(0, -110%) scale(.9); opacity: 0; } }
.jlist li .by.peng { color: #1f5d78; font-size: 20px; }
.jam-bub .pn { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; background: #12161d; color: #f1cf73; padding: 1px 6px 2px; border-radius: 4px; margin-right: 4px; vertical-align: 3px; }
body.jamming .toast { z-index: 95; }
.jam-k, .jam-pola { z-index: 1; } .jcard { z-index: 2; } .jam-help, .jam-notes { z-index: 3; }
.jam-k { position: absolute; left: 4px; top: 2px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .22em; color: rgba(239,233,220,.55); display: flex; align-items: center; gap: 8px; }
.jam-k .rec { width: 8px; height: 8px; border-radius: 50%; background: #3a1414; }
.jam.recording .jam-k .rec { background: #ff3b30; box-shadow: 0 0 10px #ff3b30; animation: jblink 1.4s steps(2) infinite; }
@keyframes jblink { 50% { opacity: .25; } }
/* 폴라로이드(지금 곡 앨범 표지) */
.jam-pola { position: absolute; right: -14px; top: -58px; width: clamp(96px, 34%, 150px); aspect-ratio: .86; pointer-events: none; z-index: 3; }
.pola { position: absolute; inset: 0; background: #f6f3ec; padding: 7% 7% 22%; border-radius: 2px; box-shadow: 0 14px 28px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.4); transform-origin: 50% 0;
  animation: pdrop .9s cubic-bezier(.2,.9,.25,1.15) both; transition: transform .6s ease, opacity .6s ease, filter .6s; }
.pola i { display: block; width: 100%; aspect-ratio: 1; background: #222 center/cover; }
.pola b { position: absolute; left: 7%; right: 7%; bottom: 5%; font-family: 'Nanum Pen Script', cursive; font-weight: 400; font-size: clamp(15px, 1.6vw, 21px); color: #2a2622; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.pola::after { content: ''; position: absolute; left: 50%; top: -9px; width: 44px; height: 18px; margin-left: -22px; background: rgba(230,220,190,.75); transform: rotate(-3deg); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.pola.old { opacity: .0; filter: brightness(.5); }
@keyframes pdrop { 0% { transform: translateY(-140%) rotate(var(--r0)); opacity: 0; } 55% { opacity: 1; } 100% { transform: rotate(var(--r)); } }
/* J카드 */
.jcard { position: relative; align-self: center; max-height: calc(100dvh - 48px); display: flex; flex-direction: column; min-height: 0; background: #f4efe3; color: #2a2622; border-radius: 3px;
  box-shadow: 0 30px 60px rgba(0,0,0,.6), 0 3px 6px rgba(0,0,0,.4), inset 0 0 60px rgba(160,130,80,.12);
  opacity: 0; transform: translateX(60px) rotate(3deg); transition: opacity .5s ease .25s, transform .7s cubic-bezier(.2,.9,.25,1.1) .25s; }
.jam.lit .jcard { opacity: 1; transform: rotate(-.6deg); }
.jcard .band { height: 12px; background: var(--tape, #c8402e); border-radius: 3px 3px 0 0; }
.jcard header { padding: 14px 150px 8px 46px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; border-bottom: 1.5px solid rgba(40,30,20,.55); }
.jcard h2 { margin: 0; font-family: 'Nanum Pen Script', cursive; font-weight: 400; font-size: 38px; line-height: 1; letter-spacing: .02em; }
.jcard header small { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .14em; color: rgba(42,38,34,.6); white-space: nowrap; }
.jlist { list-style: none; margin: 0; padding: 4px 0 8px; overflow-y: auto; flex: 1; min-height: 120px; scrollbar-width: thin;
  background: linear-gradient(90deg, transparent 37px, rgba(200,60,50,.5) 37px, rgba(200,60,50,.5) 38.5px, transparent 38.5px), repeating-linear-gradient(180deg, transparent 0 39px, rgba(70,110,170,.22) 39px 40px); background-attachment: local; }
.jlist li { position: relative; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 16px 0 46px; font-family: 'Nanum Pen Script', cursive; font-size: 24px; line-height: 1; cursor: pointer; }
.jlist li .no { position: absolute; left: 10px; width: 22px; text-align: right; font-size: 18px; color: rgba(42,38,34,.55); }
.jlist li .w { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; position: relative; }
.jlist li .w em { font-style: normal; font-size: 19px; color: rgba(42,38,34,.62); }
.jlist li .by { font-size: 16px; color: #6a5a9a; white-space: nowrap; }
.jlist li .d { font-size: 17px; color: rgba(42,38,34,.5); }
.jlist li.new .w { animation: jwrite 1s steps(14) both; }
@keyframes jwrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.jlist li.done .w::after { content: ''; position: absolute; left: 0; right: 0; top: 52%; height: 2px; background: rgba(42,38,34,.7); border-radius: 2px; transform: rotate(-.4deg); animation: jstrike .5s ease both; }
@keyframes jstrike { from { right: 100%; } }
.jlist li.done { color: rgba(42,38,34,.55); }
.jlist li.cur .w { background: linear-gradient(transparent 46%, rgba(255,214,0,.55) 46%, rgba(255,214,0,.55) 88%, transparent 88%); }
.jlist li.cur::before { content: '▶'; position: absolute; left: -2px; font-size: 16px; color: #c8402e; }
.jlist li.pend { color: rgba(42,38,34,.45); }
.jlist li.add { color: rgba(42,38,34,.42); }
.jlist li.add:hover, .jlist li.add:focus-visible { color: #c8402e; outline: none; }
.jcard footer { display: flex; gap: 8px; padding: 10px 14px 14px; border-top: 1px dashed rgba(42,38,34,.3); flex-wrap: wrap; align-items: center; }
.jbtn { appearance: none; border: 1.5px solid rgba(42,38,34,.75); background: transparent; color: #2a2622; font-family: 'Nanum Pen Script', cursive; font-size: 21px; line-height: 1; padding: 6px 12px 5px; border-radius: 6px 4px 7px 3px; cursor: pointer; }
.jbtn:hover { background: rgba(42,38,34,.07); }
.jbtn.k { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .14em; border: 0; color: rgba(42,38,34,.55); padding: 6px 4px; }
.jcard .sum { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; color: rgba(42,38,34,.55); }
/* 도움말 */
.jam-help { position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(12px, env(safe-area-inset-top)); z-index: 3; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid rgba(239,233,220,.45); background: rgba(0,0,0,.2); color: #efe9dc; font: 700 15px 'Space Grotesk', sans-serif; cursor: pointer; }
.jam-help[aria-pressed="true"] { background: #efe9dc; color: #121110; }
.jam-notes { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.jam-notes p { position: absolute; margin: 0; width: min(240px, 60vw); padding: 12px 14px 14px; background: #fff27a; color: #2a2622; font-family: 'Nanum Pen Script', cursive; font-size: 22px; line-height: 1.12; box-shadow: 0 10px 18px rgba(0,0,0,.45); transform: rotate(var(--r)); animation: pdrop .55s cubic-bezier(.2,.9,.25,1.2) both; animation-delay: var(--d); pointer-events: auto; }
/* 곡 찾기 */
.jfind { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
.jfind .box { width: min(520px, calc(100vw - 28px)); max-height: min(640px, calc(100dvh - 40px)); display: flex; flex-direction: column; background: #f4efe3; color: #2a2622; border-radius: 4px; box-shadow: 0 30px 60px rgba(0,0,0,.6); overflow: hidden; animation: pdrop .45s cubic-bezier(.2,.9,.25,1.1) both; --r: -.5deg; --r0: -4deg; }
.jfind .row { display: flex; gap: 8px; padding: 14px; border-bottom: 1.5px solid rgba(42,38,34,.4); align-items: center; }
.jfind input { flex: 1; min-width: 0; border: 0; background: transparent; font-family: 'Nanum Pen Script', cursive; font-size: 28px; color: #2a2622; outline: none; }
.jfind .tabs { display: flex; gap: 4px; }
.jfind .tabs button { appearance: none; border: 0; background: none; font-family: 'Nanum Pen Script', cursive; font-size: 22px; color: rgba(42,38,34,.5); cursor: pointer; padding: 2px 6px; }
.jfind .tabs button[aria-pressed="true"] { color: #2a2622; text-decoration: underline 2px; text-underline-offset: 4px; }
.jfind ul { list-style: none; margin: 0; padding: 6px 0; overflow-y: auto; }
.jfind li { display: flex; gap: 12px; align-items: center; padding: 8px 14px; cursor: pointer; }
.jfind li:hover, .jfind li:focus-visible { background: rgba(42,38,34,.07); outline: none; }
.jfind li i { width: 44px; height: 44px; flex: none; background: #ccc center/cover; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.jfind li div { min-width: 0; flex: 1; }
.jfind li b { display: block; font-family: 'Nanum Pen Script', cursive; font-weight: 400; font-size: 24px; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jfind li small { display: block; font-size: 12px; color: rgba(42,38,34,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jfind li .plus { font-family: 'Nanum Pen Script', cursive; font-size: 26px; color: #c8402e; }
.jfind .empty { padding: 26px 16px; text-align: center; font-family: 'Nanum Pen Script', cursive; font-size: 22px; color: rgba(42,38,34,.55); }
.jfind .x { appearance: none; border: 0; background: none; font-size: 22px; cursor: pointer; color: rgba(42,38,34,.6); }
/* 세로 화면 · 폰: 데크 위, J카드 아래 */
@media (max-aspect-ratio: 5/4) {
  .jam { grid-template-columns: 1fr; grid-template-rows: minmax(0, 46fr) minmax(0, 54fr); gap: 10px; }
  .jcard { align-self: stretch; max-height: none; }
  .jam-pola { width: 104px; top: -46px; right: -6px; }
  .jcard h2 { font-size: 32px; }
  .jcard header { padding-right: 110px; }
}
@media (prefers-reduced-motion: reduce) { .jam, .jam *, .jam *::before, .jam *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`;

function mount() {
  if ($('jam')) return;
  if (!document.querySelector('link[data-jam-font]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.jamFont = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap'; document.head.appendChild(l);
  }
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div');
  el.id = 'jam'; el.className = 'jam'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '잼 모드');
  el.innerHTML = `
    <div class="jam-stage" id="jamStage"><canvas id="jamCv" class="jam-cv" aria-label="카세트 라디오: 건반을 눌러 조작"></canvas><div class="jam-dith" id="jamDith"></div>
      <div class="jam-k"><span class="rec"></span><span id="jamK">JAM SESSION</span></div>
</div>
    <aside class="jcard" aria-label="셋리스트">
      <div class="jam-pola" id="jamPola"></div>
      <div class="band"></div>
      <header><h2 id="jamTitle">JAM</h2><small id="jamDate"></small><small id="jamWho"></small></header>
      <ol class="jlist" id="jamList"></ol>
      <footer><button class="jbtn" id="jamAdd" type="button">+ 곡 넣기</button><button class="jbtn" id="jamShare" type="button">친구 부르기</button><span class="sum" id="jamSum"></span><button class="jbtn k" id="jamEnd" type="button">잼 끝 ⏏</button></footer>
    </aside>
    <button class="jam-help" id="jamHelp" type="button" aria-pressed="false" aria-label="잼 모드 도움말">?</button>
    <div class="jam-notes" id="jamNotes" hidden></div>
    <div class="jfind" id="jamFind" hidden><div class="box">
      <div class="row"><input id="jamQ" type="search" placeholder="곡이나 앨범 이름" autocomplete="off" enterkeyhint="search"><div class="tabs"><button type="button" data-t="track" aria-pressed="true">곡</button><button type="button" data-t="album" aria-pressed="false">앨범 통째로</button></div><button class="x" id="jamFindX" type="button" aria-label="닫기">×</button></div>
      <ul id="jamRes"><li class="empty">적을 곡을 찾아 보세요</li></ul></div></div>`;
  document.body.appendChild(el);
  wire();
}

// ---------- 효과음 (Web Audio 합성. 음악 앱의 효과음 설정 music.sfx를 따른다) ----------
const sfx = (() => {
  let ctx = null, nb = null;
  function get() {
    if (C.LS.get('music.sfx') === false) return null;
    try {
      if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }
  function noise(t0, dur, type, f0, f1, gain, q = 1) {
    const c = get(); if (!c) return;
    const s = c.createBufferSource(); s.buffer = nb; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, c.currentTime + t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime + t0); g.gain.exponentialRampToValueAtTime(gain, c.currentTime + t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + t0, Math.random() * 0.5); s.stop(c.currentTime + t0 + dur + 0.05);
  }
  function tone(t0, dur, f0, f1, gain, type = 'sine') {
    const c = get(); if (!c) return;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, c.currentTime + t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime + t0); g.gain.exponentialRampToValueAtTime(gain, c.currentTime + t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
  }
  return {
    unlock: get,
    key() { noise(0, 0.05, 'bandpass', 2400, 900, 0.5, 2); tone(0, 0.09, 180, 70, 0.35); noise(0.05, 0.04, 'highpass', 3000, 2000, 0.12); },
    light() { noise(0, 0.03, 'highpass', 5000, 3000, 0.4); tone(0, 0.05, 900, 300, 0.12, 'square'); },
    spot() { tone(0, 0.5, 70, 40, 0.5); noise(0, 0.35, 'lowpass', 900, 120, 0.25); },
    door() { tone(0, 0.22, 520, 260, 0.08, 'triangle'); noise(0, 0.12, 'bandpass', 1800, 600, 0.25, 3); },
    seat() { tone(0, 0.08, 140, 80, 0.45); noise(0, 0.05, 'bandpass', 1400, 500, 0.3, 2); },
    close() { noise(0, 0.04, 'bandpass', 3000, 1200, 0.5, 3); tone(0, 0.06, 260, 120, 0.3); },
    eject() { tone(0, 0.3, 300, 900, 0.07, 'triangle'); noise(0, 0.08, 'bandpass', 2000, 700, 0.4, 2); },
    whirr() { tone(0, 0.5, 300, 900, 0.05, 'sawtooth'); noise(0, 0.5, 'bandpass', 1200, 3500, 0.06, 4); },
    pen(n = 1) { for (let i = 0; i < n * 5; i++) noise(i * 0.075 + Math.random() * 0.02, 0.06, 'bandpass', 3800 + Math.random() * 2000, 2500, 0.05 + Math.random() * 0.03, 3); },
    tape() { noise(0, 0.12, 'lowpass', 700, 200, 0.25); },
    squawk() { tone(0, 0.16, 520, 760, 0.12, 'sawtooth'); tone(0.17, 0.22, 700, 430, 0.12, 'sawtooth'); noise(0, 0.38, 'bandpass', 1500, 900, 0.05, 6); },
  };
})();

// ---------- 상태 ----------
const J = {
  on: false, deck: null, cur: null,   // cur = { id, tape, at, name, replay }
  items: [], seen: new Set(), me: null, names: new Map(), started: false,
  pollT: 0, tickT: 0, lastUri: '', endArm: 0, busy: false, find: { t: 'track', q: '', seq: 0 },
};
const load = () => C.LS.get('music.jam');
const save = () => C.LS.set('music.jam', J.cur);

async function deck() {
  if (J.deck) return J.deck;
  J.deck = await createBoombox($('jamCv'), BASE);
  J.deck.onKey = onKey; J.deck.onPenguin = poke;
  const dith = $('jamDith');
  if (!dith.style.backgroundImage) { // 4x4 바이어 디더(PS1 느낌)
    const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'), B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    B.forEach((v, i) => { const l = Math.round(v / 15 * 255); g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(i % 4, (i / 4) | 0, 1, 1); });
    dith.style.backgroundImage = `url(${c.toDataURL()})`;
  }
  const fit = () => { const b = $('jamStage').getBoundingClientRect(), W = innerWidth, H = innerHeight; J.deck.setFrame(b.left / W, b.top / H, b.width / W, b.height / H); dith.style.backgroundSize = `${(H / 340) * 4}px`; };
  new ResizeObserver(fit).observe($('jamStage')); addEventListener('resize', fit); fit();
  J.deck.onDoor = () => note('문은 STOP/EJ로 열립니다 — 멈춘 채 두 번 누르면 잼 끝', 2600);
  return J.deck;
}

function note(msg, ms) { C.toast(msg, ms); }

// ---------- 시작 · 이어 하기 · 다시 듣기 ----------
export async function start() {
  if (J.on || J.busy) return;
  if (!C.loggedIn()) { C.openDlg(); return; }
  if (!C.hasScope('playlist-modify-private')) {
    if (confirm('잼은 Spotify 플레이리스트를 만들고 곡을 넣어야 해서, 권한을 한 번 더 받아야 합니다. 다시 로그인할까요?')) C.relogin();
    return;
  }
  J.busy = true; sfx.unlock();
  try {
    mount(); await lightsOff();
    const d = today();
    let pl;
    const body = { name: 'JAM ' + d.md, public: false, collaborative: true, description: 'T/L/L JAM · ' + d.ymd };
    try { pl = await C.api('/me/playlists', { method: 'POST', body }); } catch (e) {
      const me = await me_(); if (!me) throw e;
      pl = await C.api('/users/' + encodeURIComponent(me.id) + '/playlists', { method: 'POST', body });
    }
    if (!pl || !pl.id) throw new Error('플레이리스트를 만들지 못했습니다');
    const tape = tapeFor(pl.id, C.LS.get('music.jamTape'));
    C.LS.set('music.jamTape', tape);
    const st0 = C.state(), it0 = st0 && st0.item;
    J.cur = { id: pl.id, tape, at: Date.now(), name: pl.name || body.name, replay: false, peng: [], seed: it0 && it0.artists && it0.artists[0] ? it0.artists[0].name : '' };
    save();
    await enter(true);
  } catch (e) {
    C.toast('잼을 시작하지 못했습니다: ' + (e.message || e), 6000);
    await lightsOn();
  } finally { J.busy = false; }
}
// 새로고침 뒤 이어 하기(참가 중이던 잼은 아직 열려 있을 때만)
export async function resume() {
  const c = load(); if (!c || !c.id || J.on || J.busy) return;
  if (c.guest) {
    const R = await remote(); if (!R || R.pid !== c.id) { C.LS.del('music.jam'); return; }
  }
  J.cur = c; mount(); await lightsOff(true); await enter(false);
}
// 친구가 연 잼에 참가(로그인한 상태). R = 서버의 잼(/api/music/jam)
export async function join(R) {
  if (J.on || J.busy || !R || !R.pid) return;
  if (!C.loggedIn()) { C.openDlg(); return; }
  J.busy = true; sfx.unlock();
  try {
    J.cur = { id: R.pid, tape: R.tape || tapeFor(R.pid), at: R.at || Date.now(), name: R.name || 'JAM', guest: true, host: R.host || '친구', replay: false };
    J.remote = R; J.noListen = false; J.followAt = 0; J.following = false;
    save(); mount(); await lightsOff(); await enter(true);
  } finally { J.busy = false; }
}
// 서버의 잼 읽기. 서버 시각과 이 기기 시각 차이(J.skew)도 잰다
async function remote() {
  try { const j = await C.srv('/api/music/jam'); if (j.now) J.skew = j.now - Date.now(); return j.jam; } catch { return undefined; }
}
// JAM 크레이트의 테이프 다시 듣기
export async function replay(a) {
  if (J.on || J.busy || !a || !a.id) return;
  J.busy = true; sfx.unlock();
  try { J.cur = { id: a.id, tape: a.t || tapeFor(a.id), at: Date.now(), name: a.name || 'JAM', replay: true }; save(); mount(); await lightsOff(); await enter(true, true); }
  finally { J.busy = false; }
}
export const active = () => J.on;

async function lightsOff(quick) {
  const el = $('jam'); el.hidden = false; J.on = true; document.body.classList.add('jamming'); window.MusicJamOn = true;
  if (!quick) sfx.light();
  await sleep(30); el.classList.add('on');
  await sleep(quick ? 100 : 750);
  if (!quick) sfx.spot();
  el.classList.add('lit');
}
async function lightsOn() {
  const el = $('jam'); if (!el) return;
  el.classList.remove('lit', 'recording'); await sleep(250);
  sfx.light(); el.classList.remove('on'); await sleep(700);
  el.hidden = true; J.on = false; document.body.classList.remove('jamming'); window.MusicJamOn = false;
}

async function enter(animate, autoplay) {
  const c = J.cur, d = await deck();
  const dt = new Date(c.at);
  $('jamTitle').textContent = c.name || 'JAM';
  $('jamDate').textContent = `SIDE A · ${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} · ${c.replay ? 'PLAYBACK' : 'C-90 REC'}`;
  $('jamK').textContent = c.guest ? `JAM SESSION · ${c.host} 님의 잼` : c.replay ? 'JAM · PLAYBACK' : 'JAM SESSION · REC';
  $('jamShare').hidden = !!c.replay || !!c.guest;
  $('jamEnd').textContent = c.guest ? '나가기 ⏏' : '잼 끝 ⏏';
  $('jamWho').textContent = '';
  try { const sh = await (await fetch(BASE + 'tapes/shell.json')).json(); document.querySelector('.jcard').style.setProperty('--tape', sh[c.tape] || '#c8402e'); } catch {}
  J.items = []; J.seen = new Set(); J.lastUri = ''; J.started = false; $('jamPola').innerHTML = ''; renderList();
  if (animate) await d.insert(c.tape, (k) => sfx[k] && sfx[k]()); else d.setTape(c.tape);
  if (!c.replay) { d.latch('REC', true); $('jam').classList.add('recording'); }
  J.pubKey = ''; J.remote = c.guest ? J.remote : null;
  await refresh(true);
  if (autoplay && J.items.length) playFrom(0);
  else if (!J.items.length && !c.replay && !c.guest) setTimeout(() => { if (J.on && !J.items.length) { J.autoHelp = true; toggleHelp(true); } }, 900);
  loop();
}

// ---------- 플레이리스트 읽기 ----------
async function me_() { if (J.me) return J.me; try { J.me = await C.api('/me'); } catch {} return J.me; }
async function items(id) {
  for (const path of ['/items', '/tracks']) {
    try {
      const out = []; let url = '/playlists/' + id + path + '?limit=50';
      while (url && out.length < 500) { const j = await C.api(url); out.push(...((j && j.items) || [])); url = j && j.next ? j.next.replace('https://api.spotify.com/v1', '') : ''; }
      return out.map((x) => { const t = x && (x.item || x.track); return t && t.uri ? { uri: t.uri, name: t.name, artist: (t.artists || []).map((a) => a.name).join(', '), img: ((t.album && t.album.images) || []).slice(-2)[0]?.url || ((t.album && t.album.images) || [])[0]?.url || '', big: ((t.album && t.album.images) || [])[0]?.url || '', ms: t.duration_ms || 0, by: x.added_by && x.added_by.id } : null; }).filter(Boolean);
    } catch (e) { if (e.status && e.status !== 404 && e.status !== 403) throw e; }
  }
  return [];
}
async function nameOf(id) {
  if (!id) return '';
  const me = await me_(); if (me && me.id === id) return '';
  if (J.names.has(id)) return J.names.get(id);
  J.names.set(id, '친구');
  try { const u = await C.api('/users/' + encodeURIComponent(id)); if (u && u.display_name) J.names.set(id, u.display_name); } catch {}
  return J.names.get(id);
}
async function refresh(first) {
  if (!J.cur) return;
  if (J.cur.guest) return refreshGuest(first);
  let list; try { list = await items(J.cur.id); } catch { return; }
  const fresh = [];
  list.forEach((x, i) => { const k = x.uri + '#' + i; if (!J.seen.has(k)) { J.seen.add(k); if (!first) fresh.push(i); } });
  const pg = new Set(J.cur.peng || []);
  const gs = J.cur.guests || {};
  for (const x of list) { if (pg.has(x.uri)) { x.byName = 'p'; x.peng = true; } else if (gs[x.uri]) { x.byName = gs[x.uri]; x.guest = true; } else if (x.by) x.byName = await nameOf(x.by); }
  if (list.some((x, i) => x.guest && !J.seen.has('g' + i))) { J.lastFriend = Date.now(); list.forEach((x, i) => { if (x.guest) J.seen.add('g' + i); }); }
  const me = await me_();
  if (list.some((x, i) => x.by && me && x.by !== me.id && !J.seen.has('f' + i))) { J.lastFriend = Date.now(); list.forEach((x, i) => { if (x.by && me && x.by !== me.id) J.seen.add('f' + i); }); }
  const grew = list.length > J.items.length;
  J.items = list; renderList(first ? null : new Set(fresh));
  publish();
  if (fresh.length) sfx.pen(Math.min(3, fresh.length));
  if (list.length && $('jamHelp').getAttribute('aria-pressed') === 'true' && J.autoHelp) { J.autoHelp = false; toggleHelp(false); }
  // 첫 곡이 들어오면 바로 녹음 겸 재생 시작
  if (grew && !J.started && !J.cur.replay && !playingOurs()) playFrom(0);
}

// ---------- 참가자: 서버에서 셋리스트·지금 곡을 읽고 내 기기를 맞춘다 ----------
async function refreshGuest(first) {
  const R = await remote();
  if (R === undefined) return; // 잠깐 끊김
  if (!R || R.pid !== J.cur.id) {
    if (J.on && !J.busy) { C.toast(`${J.cur.host} 님이 잼을 끝냈습니다`, 4000); leave(true); }
    return;
  }
  J.remote = R;
  const list = (R.list || []).map((x) => ({ uri: x.uri || '', name: x.t, artist: x.a, ms: x.ms || 0, img: x.img || '', big: x.img || '', byName: x.by || '' }));
  const fresh = [];
  list.forEach((x, i) => { const k = x.uri + '#' + i; if (!J.seen.has(k)) { J.seen.add(k); if (!first) fresh.push(i); } });
  J.items = list; renderList(first ? null : new Set(fresh));
  if (fresh.length) sfx.pen(Math.min(3, fresh.length));
  showWho(R.members, R.host);
  C.srv('/api/music/jam/hello', { method: 'POST', body: { pid: J.cur.id } }).catch(() => {});
  follow();
}
function showWho(members, host) {
  const L = [...new Set([...(J.cur.guest ? [host] : []), ...(members || [])].filter(Boolean))];
  $('jamWho').textContent = L.length ? '함께: ' + L.join(', ') : '';
}
// 호스트 위치(서버 시각 기준으로 늘림)
function remotePos() {
  const R = J.remote; if (!R) return 0;
  return (R.ps || 0) + (R.on ? Math.max(0, Date.now() + (J.skew || 0) - (R.pu || 0)) : 0);
}
// 내 Spotify가 호스트의 지금 곡·위치를 따라가게. 곡이 다르거나 4초 넘게 어긋나면 그 곡부터 다시 튼다(6초에 한 번까지)
async function follow() {
  const R = J.remote; if (!R || !J.on || J.followBusy || J.noListen) return;
  const s = C.state(), list = J.items, tgt = list[R.cur];
  const myUri = s && s.item && s.item.uri, mineOn = !!(s && s.is_playing);
  const inJam = !!myUri && list.some((x) => x.uri === myUri);
  if (!R.on || !tgt || !tgt.uri) {
    if (J.following && mineOn && inJam && Date.now() - (J.followAt || 0) > 3000) { J.followAt = Date.now(); C.api('/me/player/pause', { method: 'PUT' }).catch(() => {}); C.poll(600); }
    return;
  }
  const pos = Math.min(remotePos(), Math.max(0, (tgt.ms || 1e9) - 1500));
  const myPos = s ? (s.progress_ms || 0) + (s.is_playing ? Date.now() - (s.at || Date.now()) : 0) : 0;
  if (mineOn && myUri === tgt.uri && Math.abs(myPos - pos) < 4000) return;
  if (Date.now() - (J.followAt || 0) < 6000) return; // 방금 틀었으면 상태가 따라올 때까지 기다림
  J.followAt = Date.now(); J.followBusy = true;
  try {
    const uris = list.slice(R.cur, R.cur + 100).map((x) => x.uri).filter(Boolean);
    C.wake(); const dev = await C.targetDevice();
    await C.api('/me/player/play?device_id=' + encodeURIComponent(dev), { method: 'PUT', body: { uris, offset: { position: 0 }, position_ms: pos } });
    J.following = true; C.poll(900);
  } catch (e) {
    if (e.reason === 'PREMIUM_REQUIRED' || e.status === 403) { J.noListen = true; note('Spotify Premium이 아니라 이 기기에서는 같이 들을 수 없습니다. 셋리스트 보기·곡 넣기·조작은 됩니다', 6000); }
    else note(e.message || String(e), 4000);
  } finally { J.followBusy = false; }
}
// 참가자 조작 → 호스트 화면이 실행
async function ctl(k, i = -1) {
  try { await C.srv('/api/music/jam/ctl', { method: 'POST', body: { pid: J.cur.id, k, i } }); J.followAt = 0; }
  catch (e) { note(e.message || '보내지 못했습니다'); }
}
// 참가자 나가기: 내 음악만 멈추고 화면을 닫는다(잼은 호스트 쪽에서 계속)
async function leave(ended) {
  if (!J.on || J.busy) return;
  J.busy = true;
  clearTimeout(J.pollT); clearInterval(J.tickT);
  try {
    const s = C.state(), myUri = s && s.item && s.item.uri;
    if (J.following && s && s.is_playing && J.items.some((x) => x.uri === myUri)) C.api('/me/player/pause', { method: 'PUT' }).catch(() => {});
    if (!ended) C.srv('/api/music/jam/hello', { method: 'POST', body: { pid: J.cur.id, bye: 1 } }).catch(() => {});
    toggleHelp(false); $('jamFind').hidden = true;
    const d = J.deck; for (const k of ['REC', 'PLAY', 'PAUSE']) d.latch(k, false); d.setPlaying(false);
    $('jam').classList.remove('recording');
    await d.eject((k) => sfx[k] && sfx[k]());
    C.LS.del('music.jam'); J.cur = null; J.remote = null; J.following = false;
    await lightsOn();
  } finally { J.busy = false; }
}

// ---------- 재생 ----------
const ctxUri = () => 'spotify:playlist:' + J.cur.id;
function playingOurs() { const s = C.state(); return !!(s && s.context && s.context.uri === ctxUri() && s.is_playing); }
function curIndex() {
  if (J.cur && J.cur.guest) return J.remote ? J.remote.cur : -1;
  const s = C.state(); if (!s || !s.item || !s.context || s.context.uri !== ctxUri()) return -1;
  const i = J.items.findIndex((x) => x.uri === s.item.uri); return i;
}
async function playFrom(i) {
  try {
    C.wake(); const dev = await C.targetDevice();
    await C.api('/me/player/play?device_id=' + dev, { method: 'PUT', body: { context_uri: ctxUri(), offset: { position: i } } });
    J.started = true; C.poll(500);
  } catch (e) { C.toast(e.message || String(e)); }
}
async function cmd(path, method = 'POST') { try { await C.api(path, { method }); } catch (e) { C.toast(e.message || String(e)); } C.poll(500); }

async function onKey(k) {
  const d = J.deck; sfx.key();
  if (J.cur && J.cur.guest) return onKeyGuest(k);
  const s = C.state(), ours = s && s.context && s.context.uri === ctxUri();
  if (k === 'PLAY') {
    d.tap('PLAY');
    if (!J.items.length) { note('먼저 J카드 빈 줄에 곡을 적으세요'); return; }
    if (ours && s.item) { await cmd('/me/player/play', 'PUT'); } else await playFrom(Math.max(0, curIndex()));
  } else if (k === 'PAUSE') {
    if (s && s.is_playing && ours) { d.latch('PAUSE', true); await cmd('/me/player/pause', 'PUT'); }
    else { d.latch('PAUSE', false); if (ours) await cmd('/me/player/play', 'PUT'); }
  } else if (k === 'FF' || k === 'REW') {
    d.tap(k); sfx.whirr();
    if (ours) await cmd(k === 'FF' ? '/me/player/next' : '/me/player/previous');
  } else if (k === 'REC') {
    d.tap('REC');
    note(J.cur.replay ? '다시 듣는 테이프입니다. 곡을 더 넣으면 이 잼에 같이 적힙니다' : '녹음 중 — 들어오는 곡이 모두 이 테이프에 남습니다', 3000);
  } else if (k === 'STOP/EJ') {
    d.tap('STOP/EJ');
    if (s && s.is_playing && ours) { await cmd('/me/player/pause', 'PUT'); J.endArm = Date.now(); note('멈췄습니다. 한 번 더 누르면 잼을 끝내고 테이프를 꺼냅니다', 3000); return; }
    if (Date.now() - J.endArm < 4000) { end(); return; }
    J.endArm = Date.now(); note('한 번 더 누르면 잼을 끝내고 테이프를 꺼냅니다', 3000);
  }
}

// 참가자 건반: 모두의 잼을 움직인다(호스트 화면이 실행). STOP/EJ 두 번 = 나가기
async function onKeyGuest(k) {
  const d = J.deck, on = !!(J.remote && J.remote.on);
  if (k === 'PLAY') { d.tap('PLAY'); if (!J.items.length) { note('먼저 J카드 빈 줄에 곡을 적으세요'); return; } J.noListen = false; await ctl('play'); }
  else if (k === 'PAUSE') { d.latch('PAUSE', on); await ctl(on ? 'pause' : 'play'); }
  else if (k === 'FF' || k === 'REW') { d.tap(k); sfx.whirr(); await ctl(k === 'FF' ? 'next' : 'prev'); }
  else if (k === 'REC') { d.tap('REC'); note(`${J.cur.host} 님의 테이프에 녹음 중 — 넣는 곡이 모두 남습니다`, 3000); }
  else if (k === 'STOP/EJ') {
    d.tap('STOP/EJ');
    if (Date.now() - J.endArm < 4000) { leave(); return; }
    J.endArm = Date.now(); note('한 번 더 누르면 이 잼에서 나갑니다(잼은 계속됩니다)', 3000);
  }
}

// ---------- 잼 끝: 테이프가 튀어나와 JAM 크레이트로 ----------
async function end() {
  if (J.cur && J.cur.guest) return leave();
  if (!J.on || J.busy) return;
  J.busy = true;
  clearTimeout(J.pollT); clearInterval(J.tickT);
  try {
    if (playingOurs()) C.api('/me/player/pause', { method: 'PUT' }).catch(() => {});
    toggleHelp(false); $('jamFind').hidden = true;
    const d = J.deck; for (const k of ['REC', 'PLAY', 'PAUSE']) d.latch(k, false); d.setPlaying(false);
    $('jam').classList.remove('recording');
    await d.eject((k) => sfx[k] && sfx[k]());
    const c = J.cur;
    if (J.items.length) {
      const dt = new Date(c.at), ymd = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
      const who = new Set(J.items.map((x) => x.byName).filter(Boolean));
      C.saveJam({ id: c.id, k: 'pl', name: c.name, artist: `${J.items.length}곡${who.size ? ' · ' + [...who].slice(0, 3).join(', ') : ''}`, img: (J.items[0] && J.items[0].big) || '', year: ymd, n: J.items.length, t: c.tape });
      if (!c.replay) C.toast('테이프를 JAM 크레이트에 꽂았습니다', 3500);
    } else if (!c.replay) C.toast('곡이 없어 테이프를 남기지 않았습니다(플레이리스트는 Spotify에 남아 있습니다)', 5000);
    C.srv('/api/music/jam?pid=' + encodeURIComponent(c.id), { method: 'DELETE' }).catch(() => {});
    J.pubKey = '';
    C.LS.del('music.jam'); J.cur = null;
    await lightsOn();
  } finally { J.busy = false; }
}

// ---------- 지금 곡 · 릴 · 폴라로이드 ----------
function loop() {
  clearTimeout(J.pollT); clearInterval(J.tickT);
  const poll = async () => {
    if (!J.on || !J.cur) return;
    if (document.visibilityState === 'visible') { if (!J.cur.guest) await pullGuests(); await refresh(false); }
    J.pollT = setTimeout(poll, J.cur && J.cur.guest ? 2000 : 4000);
  };
  J.pollT = setTimeout(poll, 4000);
  J.tickT = setInterval(tick, 250); tick();
}
function tick() {
  if (!J.on || !J.cur || !J.deck) return;
  if (J.cur.guest) return tickGuest();
  const s = C.state(), ours = !!(s && s.context && s.context.uri === ctxUri());
  const on = ours && s.is_playing;
  J.deck.setPlaying(on);
  J.deck.latch('PLAY', on);
  if (on) J.deck.latch('PAUSE', false);
  const i = curIndex();
  if (ours && i >= 0) {
    J.started = true;
    const total = J.items.reduce((a, x) => a + x.ms, 0) || 1;
    let pos = s.progress_ms || 0; if (s.is_playing) pos += Date.now() - s.at;
    const before = J.items.slice(0, i).reduce((a, x) => a + x.ms, 0);
    J.deck.setProgress((before + Math.min(pos, J.items[i].ms)) / total);
    if (J.items[i].uri !== J.lastUri) { J.lastUri = J.items[i].uri; pola(J.items[i]); renderList(); publish(); }
  }
  if (now0() - (J.pengT || 0) > 2000) { J.pengT = now0(); penguin(); penguinSkip(); }
  const tot = J.items.reduce((a, x) => a + x.ms, 0);
  $('jamSum').textContent = J.items.length ? `${J.items.length}곡 · ${fmt(tot)}` : '';
}
function tickGuest() {
  const R = J.remote, on = !!(R && R.on), i = R ? R.cur : -1;
  J.deck.setPlaying(on); J.deck.latch('PLAY', on); if (on) J.deck.latch('PAUSE', false);
  const tot = J.items.reduce((a, x) => a + x.ms, 0);
  if (i >= 0 && J.items[i]) {
    const before = J.items.slice(0, i).reduce((a, x) => a + x.ms, 0);
    J.deck.setProgress((before + Math.min(remotePos(), J.items[i].ms)) / (tot || 1));
    if (J.items[i].uri !== J.lastUri) { J.lastUri = J.items[i].uri; pola(J.items[i]); renderList(); }
  }
  $('jamSum').textContent = J.items.length ? `${J.items.length}곡 · ${fmt(tot)}` : '';
  if (now0() - (J.folT || 0) > 1000) { J.folT = now0(); follow(); }
}
function pola(x) {
  const box = $('jamPola'); if (!box) return;
  for (const o of box.children) o.classList.add('old');
  while (box.children.length > 2) box.firstChild.remove();
  const p = document.createElement('div'); p.className = 'pola';
  const r = (Math.random() * 10 - 5).toFixed(1); p.style.setProperty('--r', r + 'deg'); p.style.setProperty('--r0', (r * 3) + 'deg');
  p.innerHTML = `<i style="background-image:url('${esc(x.big || x.img)}')"></i><b>${esc(x.name)}</b>`;
  box.appendChild(p); sfx.tape();
  setTimeout(() => { for (const o of [...box.querySelectorAll('.old')]) o.remove(); }, 900);
}

// ---------- J카드 ----------
function renderList(fresh) {
  const ul = $('jamList'); if (!ul) return;
  const ci = curIndex();
  const rows = J.items.map((x, i) => `<li class="${i === ci ? 'cur' : ci > i ? 'done' : ''}${fresh && fresh.has(i) ? ' new' : ''}" data-i="${i}" tabindex="0" title="이 곡부터 듣기"><span class="no">${i + 1}</span><span class="w">${esc(x.name)} <em>— ${esc(x.artist)}</em></span>${x.byName ? `<span class="by${x.peng ? ' peng' : ''}">${esc(x.byName)}</span>` : ''}<span class="d">${fmt(x.ms)}</span></li>`);
  const pend = J.pend ? J.pend.map((n) => `<li class="pend"><span class="no">·</span><span class="w">${esc(n)} …</span></li>`) : [];
  ul.innerHTML = rows.join('') + pend.join('') + `<li class="add" data-add="1" tabindex="0"><span class="no">${J.items.length + 1}</span><span class="w">+ 여기를 눌러 곡 적기</span></li>` + '<li aria-hidden="true"></li>'.repeat(Math.max(0, 6 - J.items.length));
  const c = ul.querySelector('li.cur'); if (c && !fresh) c.scrollIntoView({ block: 'nearest' });
  if (fresh && fresh.size) { const n = ul.querySelector('li.new:last-of-type') || ul.querySelector('li.new'); n && n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// ---------- 곡 찾기 · 넣기 ----------
function openFind() {
  $('jamFind').hidden = false; const q = $('jamQ'); q.value = J.find.q; setTimeout(() => q.focus(), 50);
  if (J.find.q) search();
}
let findT = 0;
async function search() {
  const q = $('jamQ').value.trim(); J.find.q = q; const seq = ++J.find.seq, ul = $('jamRes');
  if (!q) { ul.innerHTML = '<li class="empty">적을 곡을 찾아 보세요</li>'; return; }
  ul.innerHTML = '<li class="empty">찾는 중…</li>';
  try {
    const t = J.find.t, j = await C.api(`/search?type=${t}&limit=10&q=${encodeURIComponent(q)}`);
    if (seq !== J.find.seq) return;
    const L = ((j && j[t + 's'] && j[t + 's'].items) || []).filter(Boolean);
    if (!L.length) { ul.innerHTML = '<li class="empty">못 찾았습니다</li>'; return; }
    ul.innerHTML = L.map((x, i) => {
      const imgs = (t === 'track' ? x.album && x.album.images : x.images) || [];
      const sub = t === 'track' ? `${(x.artists || []).map((a) => a.name).join(', ')} · ${fmt(x.duration_ms)}` : `${(x.artists || []).map((a) => a.name).join(', ')} · ${x.total_tracks || ''}곡 · ${(x.release_date || '').slice(0, 4)}`;
      return `<li tabindex="0" data-i="${i}"><i style="background-image:url('${esc((imgs.slice(-2)[0] || imgs[0] || {}).url || '')}')"></i><div><b>${esc(x.name)}</b><small>${esc(sub)}</small></div><span class="plus">${t === 'album' ? '+ 통째로' : '+'}</span></li>`;
    }).join('');
    ul.onclick = (ev) => { const li = ev.target.closest('li[data-i]'); if (li) add(L[+li.dataset.i], t); };
    ul.onkeydown = (ev) => { if (ev.key === 'Enter') { const li = ev.target.closest('li[data-i]'); if (li) add(L[+li.dataset.i], t); } };
  } catch (e) { if (seq === J.find.seq) ul.innerHTML = `<li class="empty">${esc(e.message || '찾지 못했습니다')}</li>`; }
}
async function post(uris) {
  for (const path of ['/items', '/tracks']) {
    try { await C.api('/playlists/' + J.cur.id + path, { method: 'POST', body: { uris: uris.slice(0, 100) } }); return; } catch (e) { if (e.status !== 404) throw e; }
  }
  throw new Error('곡을 넣지 못했습니다');
}

// ---------- 황제펭귄: 혼자 있을 때(5분 넘게 친구가 안 넣음) 곡이 다 떨어져 가면 하나 골라 넣는다 ----------
// 고르는 법: 잼에 있는 아티스트(없으면 잼 시작 전에 듣던 아티스트) 중 하나로 곡 찾기 → 아직 없는 곡 하나. 곡마다 한 번만
const PENG_LINES = ['됐고 이거 들어', '내 맘대로 넣음', '거절은 안 받아', 'p 선곡이다', '이게 낫지', '조용히 들어'];
const SKIP_LINES = ['별로. 넘김', '이건 아니야', '패스', '내 취향 아님', '다음'];
const POKE_LINES = { ignore: ['...', '바쁨', '(못 들은 척)'], squawk: ['꽥!!', '왜!!', '건드리지 마'], flop: ['(벌러덩)', '아 미끄러워', '...안 넘어졌음'] };
const pickL = (L) => L[(Math.random() * L.length) | 0];
async function penguinSkip() {
  if (!J.on || !J.cur || J.cur.guest || J.cur.replay || J.pengBusy || J.busy) return;
  const s = C.state(), ours = s && s.context && s.context.uri === ctxUri(); if (!ours || !s.is_playing) return;
  const ci = curIndex(); if (ci < 0 || ci >= J.items.length - 1 || J.items[ci].peng) return;
  let pos = s.progress_ms || 0; pos += Date.now() - s.at; if (pos < 25000) return;
  if (J.skipFor === J.items[ci].uri) return; J.skipFor = J.items[ci].uri;
  if (Math.random() > 1 / 7) return;
  J.pengBusy = true;
  try {
    await J.deck.penguinAct('peck'); // 라디오까지 뒤뚱뒤뚱 걸어가 쪼는 순간
    J.deck.tap('FF'); sfx.key(); sfx.whirr(); bubble(pickL(SKIP_LINES), '');
    await cmd('/me/player/next');
  } catch {} finally { J.pengBusy = false; }
}
function poke() {
  const r = J.deck.penguinAct('poke'); if (typeof r !== 'string') return;
  if (r !== 'ignore') sfx.squawk();
  bubble(pickL(POKE_LINES[r] || ['...']), '');
}

async function penguin() {
  if (!J.on || !J.cur || J.cur.guest || J.cur.replay || J.pengBusy || J.busy) return;
  const s = C.state(), ours = s && s.context && s.context.uri === ctxUri();
  const ci = curIndex(), alone = Date.now() - (J.lastFriend || 0) > 5 * 60000;
  const low = J.items.length ? ours && s.is_playing && ci >= J.items.length - 1 : Date.now() - J.cur.at > 25000 && !!J.cur.seed;
  const key = J.items.length ? 'c' + ci : 'empty';
  if (!alone || !low || J.pengFor === key) return;
  J.pengFor = key; J.pengBusy = true;
  try {
    const pool = [...new Set([...J.items.map((x) => (x.artist || '').split(', ')[0]), J.cur.seed].filter(Boolean))];
    const have = new Set(J.items.map((x) => x.uri));
    let pick = null;
    for (let tries = 0; tries < 2 && !pick && pool.length; tries++) {
      const a = pool[(Math.random() * pool.length) | 0];
      const j = await C.api(`/search?type=track&limit=10&q=${encodeURIComponent('artist:"' + a + '"')}`);
      const L = ((j && j.tracks && j.tracks.items) || []).filter((x) => x && x.uri && !have.has(x.uri));
      pick = L[(Math.random() * L.length) | 0] || null;
    }
    if (!pick) return;
    J.deck.penguinAct('add'); sfx.squawk();
    bubble(pickL(PENG_LINES), `${pick.name} — ${(pick.artists || []).map((a) => a.name).join(', ')}`);
    await sleep(900);
    J.cur.peng = [...(J.cur.peng || []), pick.uri]; save();
    await post([pick.uri]);
    await refresh(false);
  } catch {} finally { J.pengBusy = false; }
}
function bubble(t, sub) {
  document.querySelectorAll('.jam-bub').forEach((b) => b.remove());
  const at = J.deck.penguinAt(); if (!at.on) { C.toast('p: ' + t + (sub ? ' ' + sub : ''), 3500); return; }
  const b = document.createElement('div'); b.className = 'jam-bub'; b.innerHTML = `<b class="pn">p</b> ${esc(t)}${sub ? `<small>♪ ${esc(sub)}</small>` : ''}`;
  b.style.left = Math.min(innerWidth - 270, at.x + 12) + 'px'; b.style.top = Math.max(70, at.y - 10) + 'px';
  $('jam').appendChild(b);
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, 3800);
}

async function add(x, t) {
  if (!x || !J.cur) return;
  $('jamFind').hidden = true;
  let uris = [], label = x.name;
  try {
    if (t === 'album') { const j = await C.api('/albums/' + x.id + '/tracks?limit=50'); uris = ((j && j.items) || []).map((y) => y.uri).filter(Boolean); label = x.name + ` (${uris.length}곡)`; }
    else uris = [x.uri];
    if (!uris.length) return;
    J.pend = [...(J.pend || []), label]; renderList();
    if (J.cur.guest) await C.srv('/api/music/jam/add', { method: 'POST', body: { pid: J.cur.id, uris, label: t === 'album' ? label : `${x.name} — ${(x.artists || []).map((a) => a.name).join(', ')}` } });
    else await post(uris);
  } catch (e) { C.toast(e.status === 403 ? '이 플레이리스트에 곡을 넣을 권한이 없습니다' : (e.message || String(e))); }
  J.pend = (J.pend || []).filter((n) => n !== label);
  await refresh(false);
}

// ---------- 친구 부르기 · 도움말 ----------
// 친구에게는 이 앱 주소(/deck/#jam)를 보낸다. 열면 손님 창이 바로 뜨고 로그인 없이 곡을 넣을 수 있다
async function share() {
  if (!J.cur) return;
  publish(true);
  const url = location.origin + '/deck/#jam';
  try {
    if (navigator.share) await navigator.share({ title: J.cur.name, text: '같이 잼 하자 — 열어서 곡 넣어 줘(로그인 필요 없음)', url });
    else { await navigator.clipboard.writeText(url); C.toast('링크를 복사했습니다. 친구는 열어서 곡만 넣으면 됩니다', 4000); }
  } catch {}
}

// ---------- 손님 곡 받기 · 셋리스트 올리기 (서버 /api/music/jam) ----------
// 셋리스트나 지금 곡이 바뀌면 올리고, 바뀐 게 없어도 1분마다 한 번(잼이 살아 있다는 표시)
// 참가자 기기가 따라 틀도록 지금 곡·재생 여부·위치(ps)도 올린다. 곡·재생 상태가 바뀌면 바로, 아니면 20초마다(멀리 감기 같은 건 이걸로 맞춤)
function publish(force) {
  if (!J.on || !J.cur || J.cur.guest) return;
  const list = J.items.map((x) => ({ t: x.name, a: x.artist, by: x.byName || '', uri: x.uri, ms: x.ms, img: x.img })), cur = curIndex();
  const s = C.state(), on = playingOurs();
  const ps = s && cur >= 0 ? (s.progress_ms || 0) + (s.is_playing ? Date.now() - (s.at || Date.now()) : 0) : 0;
  const key = JSON.stringify([J.cur.id, list.length, list.map((x) => x.by).join('|'), cur, on]);
  if (!force && key === J.pubKey && Date.now() - (J.pubAt || 0) < 20000) return;
  J.pubKey = key; J.pubAt = Date.now();
  C.srv('/api/music/jam', { method: 'PUT', body: { pid: J.cur.id, name: J.cur.name, tape: J.cur.tape, list, cur, on, ps } }).catch(() => { J.pubKey = ''; });
}
// 참가자가 누른 건반·J카드
const CTL_LABEL = { play: '재생', pause: '잠깐 멈춤', next: '다음 곡', prev: '이전 곡', from: '이 곡부터' };
async function runCtl(g) {
  const [k, n] = String(g.q || '').split(':'), i = +n;
  const s = C.state(), ours = s && s.context && s.context.uri === ctxUri();
  if (k === 'play') { if (ours && s.item) await cmd('/me/player/play', 'PUT'); else if (J.items.length) await playFrom(Math.max(0, curIndex())); }
  else if (k === 'pause') { if (ours && s.is_playing) await cmd('/me/player/pause', 'PUT'); }
  else if (k === 'next' || k === 'prev') { if (ours) { sfx.whirr(); J.deck.tap(k === 'next' ? 'FF' : 'REW'); await cmd(k === 'next' ? '/me/player/next' : '/me/player/previous'); } }
  else if (k === 'from' && i >= 0 && i < J.items.length) await playFrom(i);
  else return;
  note(`${g.by}: ${CTL_LABEL[k] || k}`, 2200);
  setTimeout(() => publish(true), 1200);
}
async function pullGuests() {
  if (!J.cur || J.pulling) return;
  J.pulling = true;
  try {
    if (Date.now() - (J.whoAt || 0) > 8000) { J.whoAt = Date.now(); remote().then((R) => { if (R && J.on && J.cur && !J.cur.guest) showWho(R.members); }); }
    const { items: Q } = await C.srv('/api/music/jam/q');
    if (!Q || !Q.length) return;
    const done = [], gs = J.cur.guests = J.cur.guests || {};
    let added = 0;
    for (const g of Q) {
      if (g.kind === 'ctl') { try { await runCtl(g); } catch {} done.push(g.id); continue; }
      let uris = (g.uris || []).filter(Boolean);
      if (!uris.length && g.q) { // 이름만 보냈으면 내가 찾아서 첫 곡
        try { const j = await C.api(`/search?type=track&limit=1&q=${encodeURIComponent(g.q)}`); const t = j && j.tracks && j.tracks.items && j.tracks.items[0]; if (t) uris = [t.uri]; } catch {}
        if (!uris.length) C.toast(`${g.by}: '${g.q}'를 찾지 못했습니다`, 3500);
      }
      if (uris.length) { try { await post(uris); uris.forEach((u) => { gs[u] = g.by; }); added += uris.length; } catch (e) { if (e.status === 429) break; } }
      done.push(g.id);
    }
    save();
    if (done.length) await C.srv('/api/music/jam/done', { method: 'POST', body: { ids: done } }).catch(() => {});
    if (added) { J.lastFriend = Date.now(); bubbleGuest(Q.filter((g) => g.kind !== 'ctl').pop()); }
  } catch {} finally { J.pulling = false; }
}
function bubbleGuest(g) { if (g) C.toast(`${g.by} 님이 곡을 넣었습니다 — ${g.label}`, 3000); }
const NOTES = [
  ['J카드 빈 줄을 누르면 곡 적기. "앨범 통째로"도 됩니다', '6%', '58%', -3, 0],
  ['친구 부르기 = 링크 보내기. 친구는 열어서 곡만 넣으면 돼요(로그인 필요 없음). 넣은 곡은 여기 손글씨로 적혀요', '34%', '62%', 2, 0.08],
  ['PLAY 재생 · PAUSE 잠깐 · FF 다음 곡 · REW 이전 곡', '8%', '14%', 2.5, 0.16],
  ['STOP/EJ로 멈춘 뒤 한 번 더 = 잼 끝. 테이프는 JAM 크레이트에 꽂혀요', '36%', '10%', -2, 0.24],
  ['J카드의 곡을 누르면 그 곡부터 다시', '62%', '74%', 3, 0.32],
  ['p는 펭귄이에요. 지 맘대로 해요. 혼자일 땐 곡을 넣고, 싫은 곡은 쪼아서 넘겨요. 눌러 보면 반응함', '40%', '38%', -1.5, 0.4],
];
function toggleHelp(on) {
  const b = $('jamHelp'), box = $('jamNotes'); if (!b) return;
  on = on ?? b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on)); box.hidden = !on;
  box.innerHTML = on ? NOTES.map(([t, x, y, r, d]) => `<p style="left:${x};top:${y};--r:${r}deg;--r0:${r * 4}deg;--d:${d}s">${esc(t)}</p>`).join('') : '';
  if (on) sfx.pen(1);
}

function wire() {
  $('jamList').addEventListener('click', (ev) => {
    const li = ev.target.closest('li'); if (!li) return;
    if (li.dataset.add) { openFind(); return; }
    if (li.dataset.i != null) { sfx.key(); if (J.cur && J.cur.guest) ctl('from', +li.dataset.i); else playFrom(+li.dataset.i); }
  });
  $('jamList').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.click(); });
  $('jamAdd').onclick = openFind;
  $('jamShare').onclick = share;
  $('jamEnd').onclick = () => { if (Date.now() - J.endArm < 4000) end(); else { J.endArm = Date.now(); note(J.cur && J.cur.guest ? '한 번 더 누르면 이 잼에서 나갑니다' : '한 번 더 누르면 잼을 끝내고 테이프를 꺼냅니다', 3000); } };
  $('jamHelp').onclick = () => toggleHelp();
  $('jamNotes').addEventListener('click', () => toggleHelp(false));
  $('jamFindX').onclick = () => { $('jamFind').hidden = true; };
  $('jamFind').addEventListener('click', (ev) => { if (ev.target.id === 'jamFind') $('jamFind').hidden = true; });
  $('jamQ').addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(search, 350); });
  $('jamQ').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { clearTimeout(findT); search(); } if (ev.key === 'Escape') $('jamFind').hidden = true; });
  for (const b of document.querySelectorAll('#jamFind .tabs button')) b.onclick = () => {
    J.find.t = b.dataset.t; for (const x of document.querySelectorAll('#jamFind .tabs button')) x.setAttribute('aria-pressed', String(x === b)); search();
  };
  document.addEventListener('keydown', (ev) => {
    if (!J.on || ev.target.closest && ev.target.closest('input')) return;
    if (ev.key === ' ') { ev.preventDefault(); onKey((J.cur && J.cur.guest ? J.remote && J.remote.on : playingOurs()) ? 'PAUSE' : 'PLAY'); }
    else if (ev.key === 'ArrowRight') onKey('FF'); else if (ev.key === 'ArrowLeft') onKey('REW');
    else if (ev.key === '?') toggleHelp();
    else if (ev.key === 'Escape') { if (!$('jamFind').hidden) $('jamFind').hidden = true; else if ($('jamHelp').getAttribute('aria-pressed') === 'true') toggleHelp(false); }
  });
}

window.MusicJam = { start, resume, replay, join, active };
