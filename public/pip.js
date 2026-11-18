// PiP (아이폰·아이패드 전용, 2026-11-17 친구 요청)
// iOS는 <video>만 PiP로 띄울 수 있다 → 캔버스(왼쪽 도는 LP · 오른쪽 앨범 표지)를 그려
// captureStream으로 <video>에 넣고 그 영상을 PiP로 띄운다. 사파리 · 홈 화면 앱 둘 다 같은 길.
// PiP 창의 재생/일시정지 = 음악 재생/일시정지, 앞뒤 버튼 = 이전/다음 곡(mediaSession)
const W = 640, H = 320;
let cv, g, video, timer = 0, img = null, imgSrc = '', ang = 0, last = 0, ours = false, C = null;

const st = () => (C && C.state()) || null;
const coverOf = (it) => {
  const im = (it && it.album && it.album.images) || [];
  return (im.find((x) => x.width && x.width <= 320) || im[0] || {}).url || '';
};

function loadCover(src) {
  if (src === imgSrc) return;
  imgSrc = src; img = null;
  if (!src) return;
  const i = new Image();
  i.crossOrigin = 'anonymous'; // 캔버스가 오염되면 captureStream이 막힌다
  i.onload = () => { if (imgSrc === src) img = i; };
  i.src = src;
}

function draw() {
  const s = st(), it = s && s.item, on = !!(s && s.is_playing);
  loadCover(coverOf(it));
  const now = performance.now(), dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (on) ang += dt * Math.PI * 2 * (33.333 / 60);
  g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, W, H);
  // 왼쪽: 도는 LP
  const cx = H / 2, cy = H / 2, r = H / 2 - 18;
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  for (let k = r - 6; k > r * 0.38; k -= 5) { g.beginPath(); g.arc(0, 0, k, 0, 7); g.stroke(); }
  // 빛 반사(판이 돌아 보이게)
  g.fillStyle = 'rgba(255,255,255,.07)';
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, -0.35, 0.35); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, Math.PI - 0.35, Math.PI + 0.35); g.closePath(); g.fill();
  const lr = r * 0.34;
  g.save(); g.beginPath(); g.arc(0, 0, lr, 0, 7); g.clip();
  if (img) g.drawImage(img, -lr, -lr, lr * 2, lr * 2); else { g.fillStyle = '#026395'; g.fillRect(-lr, -lr, lr * 2, lr * 2); }
  g.restore();
  g.fillStyle = '#0d0d0f'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
  g.restore();
  // 오른쪽: 앨범 표지
  const sz = H - 36, x = W - sz - 18, y = 18;
  if (img) g.drawImage(img, x, y, sz, sz);
  else { g.fillStyle = '#1c1c20'; g.fillRect(x, y, sz, sz); g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 22px sans-serif'; g.textAlign = 'center'; g.fillText('T/L/L', x + sz / 2, y + sz / 2 + 8); }
  // 아래 진행 막대
  if (it && it.duration_ms) {
    const p = Math.min(1, ((s.progress_ms || 0) + (on && s.at ? Date.now() - s.at : 0)) / it.duration_ms);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, H - 4, W, 4);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, H - 4, W * p, 4);
  }
}

// 음악 상태 → 영상 재생 상태(PiP 버튼 모양이 맞게)
function follow() {
  const on = !!(st() && st().is_playing);
  if (!video) return;
  if (on && video.paused) { ours = true; video.play().catch(() => {}).finally(() => { ours = false; }); }
  else if (!on && !video.paused) { ours = true; video.pause(); ours = false; }
}

function build() {
  cv = document.createElement('canvas'); cv.width = W; cv.height = H; g = cv.getContext('2d');
  video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  // 화면에는 안 보이게(완전히 숨기면 iOS가 PiP를 안 띄울 때가 있어 1px로 둔다)
  Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
  document.body.appendChild(video);
  draw();
  video.srcObject = cv.captureStream(30);
  // PiP 창의 재생/일시정지를 누르면 음악도
  video.addEventListener('play', () => { if (!ours && st() && !st().is_playing) C.toggle(); });
  video.addEventListener('pause', () => { if (!ours && inPip() && st() && st().is_playing) C.toggle(); });
  const done = () => { if (!inPip()) stop(); };
  video.addEventListener('leavepictureinpicture', done);
  video.addEventListener('webkitpresentationmodechanged', done);
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.setActionHandler('previoustrack', () => C.skip(-1)); } catch {}
    try { navigator.mediaSession.setActionHandler('nexttrack', () => C.skip(1)); } catch {}
  }
}

const inPip = () => !!video && (document.pictureInPictureElement === video || video.webkitPresentationMode === 'picture-in-picture');

function stop() {
  clearInterval(timer); timer = 0; last = 0;
}

export const supported = () => {
  const v = document.createElement('video');
  return !!(HTMLCanvasElement.prototype.captureStream && (document.pictureInPictureEnabled || typeof v.webkitSetPresentationMode === 'function'));
};

// iOS 준비: 영상이 미리 메타데이터를 갖고 있어야 탭 한 번에 PiP가 뜬다
export function prepare(core) { C = core; if (!video) build(); }

// 탭 처리기 안에서 await 없이 바로 불러야 iOS가 허락한다
export function open(core) {
  prepare(core);
  if (inPip()) { // 한 번 더 누르면 닫기
    if (document.exitPictureInPicture && document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else if (video.webkitSetPresentationMode) video.webkitSetPresentationMode('inline');
    return Promise.resolve();
  }
  // 백그라운드에선 requestAnimationFrame이 멈춰서 타이머로 그린다(iOS가 늦추면 판이 느려질 수 있음)
  if (!timer) timer = setInterval(() => { draw(); follow(); }, 33);
  ours = true; video.play().catch(() => {}).finally(() => { ours = false; });
  let p;
  if (video.requestPictureInPicture && document.pictureInPictureEnabled) p = video.requestPictureInPicture();
  else { video.webkitSetPresentationMode('picture-in-picture'); p = Promise.resolve(); }
  return p.then(() => follow(), (e) => { stop(); throw e; });
}
