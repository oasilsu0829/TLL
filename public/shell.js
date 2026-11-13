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
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then((r) => {
      // 앱이 오래 켜져 있어도(폰 PWA는 뒤에 계속 살아 있다) 돌아올 때마다 새 버전이 있는지 본다
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
    }).catch(() => {}));
    // 새 버전(sw.js VERSION)이 자리를 잡으면 적용한다(2026-11-13: 배포해도 예전 화면이 계속 떠 있었다)
    // 연 지 20초 안이면 바로 새로고침, 아니면 보던 것을 끊지 않게 화면을 떠날 때(숨김) 새로고침 → 돌아오면 새 버전
    const had = !!navigator.serviceWorker.controller, t0 = Date.now();
    let done = false;
    const reload = () => { if (!done) { done = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) return; // 처음 설치될 때는 이미 새 파일이다
      if (Date.now() - t0 < 20000 && !window.MusicJamOn) reload();
      else document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') reload(); });
    });
  }
})();
