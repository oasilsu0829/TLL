/* T/L/L 공통: 예전 기록 가져오기(한 번), 서비스 워커.
   - 예전 주소(sabathia…/music/)가 이 기기의 음악 기록(music.* · mag.*, 로그인 토큰 제외)을
     #from=<base64url JSON> 에 담아 보낸다. 여기 없는 키만 채우고 주소에서 지운다. 메인 스크립트보다 먼저 돈다
   - Shell.back: 열린 창 닫기(index.html이 채움). T/L/L은 다른 앱에 기대지 않는다 */
(() => {
  'use strict';
  const S = (window.Shell = window.Shell || {});

  const m = /^#from=([A-Za-z0-9_-]+)(?:&(.*))?$/.exec(location.hash);
  if (m) {
    try {
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      let n = 0;
      for (const [k, v] of Object.entries(data || {})) {
        if (!/^(music|mag)\./.test(k) || /^music\.(tok|pkce)/.test(k) || typeof v !== 'string') continue;
        if (localStorage.getItem(k) == null) { localStorage.setItem(k, v); n++; }
      }
      S.imported = n;
    } catch {}
    try { localStorage.setItem('tll.moved', String(Date.now())); } catch {}
    history.replaceState(null, '', location.pathname + location.search + (m[2] ? '#' + m[2] : ''));
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // ---------- 버전 확인 · 업데이트 ----------
  // 지금 버전 = 이 화면과 함께 불러온 /version.js(캐시본). 서버 버전 = /version.js?check(네트워크).
  // 다르면 아래에 띠를 띄우고, '업데이트'를 누르면 서비스 워커를 새로 받아 설치한 뒤 다시 연다.
  // '나중에'는 그 버전만 넘긴다(tll.skip). 열 때 · 앱으로 돌아올 때(10분 간격) · 30분마다 확인
  const cur = self.TLL_VERSION || { v: '0', notes: [] };
  S.version = cur;
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const cmp = (a, b) => {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  };
  let latest = null, lastCheck = 0, bar = null;

  async function fetchLatest() {
    const res = await fetch('/version.js?check=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const t = await res.text();
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  }

  function paintSettings(msg) {
    const n = document.getElementById('verNote');
    if (!n) return;
    const newer = latest && cmp(latest.v, cur.v) > 0;
    n.textContent = msg || ('버전 ' + cur.v + (cur.date ? ' (' + cur.date + ')' : '') +
      (newer ? ' · 새 버전 ' + latest.v + ' 있음' : latest ? ' · 최신' : ''));
    const b = document.getElementById('verBtn');
    if (b) b.textContent = newer ? latest.v + '로 업데이트' : '업데이트 확인';
  }

  function showBar() {
    if (bar || !latest) return;
    if (!document.getElementById('tllVerCss')) {
      const st = document.createElement('style'); st.id = 'tllVerCss';
      st.textContent = '.tll-ver{position:fixed;inset:auto;margin:0;border:0;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:60;width:min(440px,calc(100vw - 32px));background:var(--ink,#111);color:#fff;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.25)}' +
        '.tll-ver b{display:block;font-size:14px}.tll-ver ul{margin:4px 0 8px;padding-left:18px;opacity:.85}.tll-ver .a{display:flex;gap:8px;justify-content:flex-end}' +
        '.tll-ver button{font:inherit;border:0;border-radius:6px;padding:7px 12px;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}.tll-ver button.go{background:#fff;color:var(--ink,#111);font-weight:600}';
      document.head.appendChild(st);
    }
    bar = document.createElement('div');
    bar.className = 'tll-ver'; bar.setAttribute('role', 'status');
    const b = document.createElement('b'); b.textContent = '새 버전 ' + latest.v + ' (지금 ' + cur.v + ')';
    const ul = document.createElement('ul');
    (latest.notes || []).slice(0, 3).forEach((x) => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
    const a = document.createElement('div'); a.className = 'a';
    const later = document.createElement('button'); later.type = 'button'; later.textContent = '나중에';
    const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = '업데이트';
    later.onclick = () => { ls.set('tll.skip', latest.v); hideBar(); };
    go.onclick = () => { go.disabled = true; go.textContent = '받는 중…'; update(); };
    a.append(later, go); bar.append(b, ul, a);
    // 모달 창이 열려 있으면 바깥은 눌리지 않으니 그 창 안에 넣고, 최상위 층(popover)에 올린다
    let host = document.body;
    try { host = document.querySelector('dialog:modal') || host; } catch {}
    host.appendChild(bar);
    try { bar.popover = 'manual'; bar.showPopover(); } catch {}
  }
  function hideBar() { if (bar) { try { bar.hidePopover(); } catch {} bar.remove(); bar = null; } }

  async function check(manual) {
    lastCheck = Date.now();
    if (manual) paintSettings('확인 중…');
    try { latest = await fetchLatest(); } catch (e) {
      paintSettings(manual ? '확인 못 함: ' + (navigator.onLine === false ? '오프라인' : e.message) : undefined);
      return null;
    }
    paintSettings();
    const newer = cmp(latest.v, cur.v) > 0;
    if (newer && (manual || ls.get('tll.skip') !== latest.v)) showBar();
    return newer;
  }

  // 새 서비스 워커를 받아 설치(그쪽 install이 새 파일을 모두 받아 둔다)되면 다시 연다. 8초 넘으면 그냥 새로고침
  async function update() {
    const reload = () => location.reload();
    const t = setTimeout(reload, 8000);
    try {
      const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
      if (!reg) { clearTimeout(t); reload(); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); reload(); }, { once: true });
      await reg.update();
      if (!reg.installing && !reg.waiting) { clearTimeout(t); reload(); }
    } catch { clearTimeout(t); reload(); }
  }

  S.checkUpdate = check;
  S.update = update;
  const vb = document.getElementById('verBtn');
  if (vb) vb.addEventListener('click', async () => {
    if (latest && cmp(latest.v, cur.v) > 0) { vb.disabled = true; vb.textContent = '받는 중…'; update(); return; }
    const r = await check(true);
    if (r === false) paintSettings('버전 ' + cur.v + ' · 최신입니다');
  });
  paintSettings();
  addEventListener('load', () => setTimeout(() => check(false), 3000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > 10 * 60e3) check(false);
  });
  setInterval(() => { if (document.visibilityState === 'visible') check(false); }, 30 * 60e3);
})();
