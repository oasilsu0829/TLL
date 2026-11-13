/* T/L/L 공통: 예전 Sabathia 기록 가져오기, 런처 뒤로가기, 서비스 워커.
   - 예전 주소(sabathia…/music/)가 이 기기의 음악 기록(music.* · mag.*, 로그인 토큰 제외)을
     #from=<base64url JSON> 에 담아 보낸다. 여기 없는 키만 채우고 주소에서 지운다. 메인 스크립트보다 먼저 돈다
   - 안드로이드 런처(WebView)가 부르는 onJarvisBack: 열린 창부터 닫고, 없으면 Sabathia 홈으로 */
(() => {
  'use strict';
  const S = (window.Shell = window.Shell || {});
  S.SABATHIA = 'https://sabathia.oasilsu0829.workers.dev/';

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

  window.onJarvisBack = () => { if (typeof S.back === 'function' && S.back()) return; location.href = S.SABATHIA; };
  window.onJarvisHome = () => { location.href = S.SABATHIA; };

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();
