// 전체화면 가사(애플 뮤직처럼): 턴테이블을 왼쪽으로 밀고 오른쪽(세로 화면은 아래)에 시간 맞춘 가사를 띄운다
// - index.html lpFull이 처음 전체화면을 켤 때 import. 전체화면에서만 돈다(show(false)면 아무것도 안 함)
// - 가사는 /api/music/lyrics(src/lyrics.js → LRCLIB · NetEase). 지금 줄을 위쪽 1/3에 맞춰 올리고, 손으로 굴리면 3.5초 동안 따라가지 않음
// - 줄을 누르면 그 시각으로 감기(MusicCore.seekMs)
// - 지금 줄에서 멀수록 흐리게(data-d), 줄이 바뀌면 줄마다 조금씩 늦게 따라 올라옴(물결, --y · --dl)

// '[01:02.34]가사' → [{ t: ms, s: '가사' }]. 빈 줄 = 간주(점 세 개)
export function parseLrc(text) {
  const all = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!tags.length) continue;
    const s = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) all.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2].replace(':', '.'))) * 1000), s });
  }
  all.sort((a, b) => a.t - b.t);
  const L = all.filter((x, i) => x.s || (i > 0 && all[i - 1].s));
  while (L.length && !L[L.length - 1].s) L.pop();
  if (L.length && L[0].t > 3000) L.unshift({ t: 0, s: '' });
  return L;
}

// ms 시점의 줄 번호(첫 줄 전이면 -1)
export function indexAt(L, ms) {
  let lo = 0, hi = L.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (L[mid].t <= ms) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  return at;
}

const LEAD = 250; // 줄이 아주 조금 먼저 켜져야 맞아 보인다
const WAVE_UP = 8, WAVE_DOWN = 16, WAVE_MS = 55; // 물결로 움직일 줄 범위, 줄마다 늦어지는 시간

export function mount(host, core) {
  host.innerHTML = '<div class="lyr-sc"><div class="lyr-in"></div></div><p class="lyr-note"></p>';
  const sc = host.querySelector('.lyr-sc'), box = host.querySelector('.lyr-in'), note = host.querySelector('.lyr-note');
  const memo = new Map();
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let id, lines = [], els = [], cur = -2, hold = 0, timer = 0, req = 0;

  const posMs = () => {
    const st = core.state(), it = st && st.item; if (!it) return 0;
    let p = st.progress_ms || 0; if (st.is_playing) p += Date.now() - (st.at || Date.now());
    return Math.min(p, it.duration_ms || p);
  };
  function clear(kind) {
    box.textContent = ''; lines = []; els = []; cur = -2; host.dataset.k = kind; sc.scrollTop = 0;
  }
  function msg(t) {
    clear('msg'); note.textContent = '';
    const p = document.createElement('p'); p.className = 'lyr-msg'; p.textContent = t; box.append(p);
  }
  function line(s) {
    const p = document.createElement('p'); p.className = 'll';
    if (s) p.textContent = s; else { p.classList.add('dots'); p.innerHTML = '<i></i><i></i><i></i>'; p.setAttribute('aria-label', '간주'); }
    return p;
  }
  let src = 'LRCLIB';
  function drawSynced(L) {
    clear('synced'); lines = L; els = L.map((x) => line(x.s)); box.append(...els);
    note.textContent = '가사 ' + src;
    step();
  }
  function drawPlain(text) {
    clear('plain');
    for (const s of String(text).split(/\r?\n/)) { const p = document.createElement('p'); p.className = s.trim() ? 'll' : 'll gap'; p.textContent = s.trim(); box.append(p); }
    note.textContent = '가사 ' + src + ' · 시간 정보 없음';
  }
  // 따라가기. 스크롤은 바로 옮기고, 줄마다 원래 자리에서 조금씩 늦게 따라 올라오게 한다(물결)
  // instant = 화면 크기가 바뀌었을 때처럼 움직임 없이 맞출 때
  function follow(force, instant) {
    if (!force && Date.now() < hold) return;
    const c = Math.max(cur, 0), el = els[c]; if (!el) return;
    const before = sc.scrollTop;
    sc.scrollTop = el.offsetTop - sc.clientHeight * 0.3;
    const d = sc.scrollTop - before;
    if (!d || instant || calm.matches || Math.abs(d) > sc.clientHeight * 1.2) return;
    const from = Math.max(0, c - WAVE_UP), to = Math.min(els.length - 1, c + WAVE_DOWN);
    for (let j = from; j <= to; j++) {
      const x = els[j];
      x.classList.add('snap'); x.style.setProperty('--y', d + 'px');
      // 지금 줄 바로 위는 먼저, 아래로 갈수록 늦게
      x.style.setProperty('--dl', Math.min(Math.max(j - c + 1, 0), 8) * WAVE_MS + 'ms');
    }
    void box.offsetHeight; // 옮긴 자리를 먼저 그리게 한 뒤 풀어 준다
    for (let j = from; j <= to; j++) { els[j].classList.remove('snap'); els[j].style.setProperty('--y', '0px'); }
  }
  // 지금 줄에서 몇 줄 떨어졌는지(0~5) → 멀수록 흐림
  function mark(i) {
    els.forEach((el, j) => {
      el.classList.toggle('on', j === i); el.classList.toggle('past', j < i);
      el.dataset.d = String(Math.min(Math.abs(j - Math.max(i, 0)), 5));
    });
  }
  async function load(it) {
    const my = ++req;
    if (!it) return msg('재생 중인 곡이 없습니다');
    if (it.type === 'episode') return msg('이 콘텐츠는 가사가 없습니다');
    const k = it.id || it.uri;
    let r = memo.get(k);
    if (!r) {
      msg('가사를 찾는 중');
      try {
        const q = new URLSearchParams({ t: it.name || '', al: (it.album && it.album.name) || '', d: String(Math.round((it.duration_ms || 0) / 1000)) });
        for (const a of (it.artists || []).slice(0, 6)) if (a && a.name) q.append('a', a.name); // 가수 전부(가사 쪽엔 다른 가수 이름으로 올라 있기도 함)
        const res = await fetch('/api/music/lyrics?' + q);
        if (!res.ok) throw new Error(String(res.status));
        r = await res.json();
        memo.set(k, r); if (memo.size > 40) memo.delete(memo.keys().next().value);
      } catch { if (my === req) { msg('가사를 불러오지 못했습니다'); id = undefined; } return; }
    }
    if (my !== req) return;
    src = r.src || 'LRCLIB';
    if (r.synced) { const L = parseLrc(r.synced); if (L.length) return drawSynced(L); }
    if (r.plain) return drawPlain(r.plain);
    msg(r.inst ? '연주곡입니다' : '이 곡은 가사를 찾지 못했습니다');
  }
  let retry = 0;
  function step() {
    const st = core.state(), it = st && st.item, k = it ? it.id || it.uri : null;
    if (k !== id) {
      // 불러오기에 실패했으면(id = undefined) 10초 뒤 다시
      if (id === undefined && k && Date.now() < retry) return;
      id = k; retry = Date.now() + 10000; load(it); return;
    }
    if (hold && Date.now() >= hold) { hold = 0; host.classList.remove('free'); follow(true); }
    if (host.dataset.k !== 'synced') return;
    const i = indexAt(lines, posMs() + LEAD);
    if (i === cur) return;
    cur = i;
    mark(i);
    follow();
  }
  // 손으로 굴리면 잠깐 따라가지 않는다(다른 줄도 밝게)
  const free = () => { hold = Date.now() + 3500; host.classList.add('free'); };
  sc.addEventListener('wheel', free, { passive: true });
  sc.addEventListener('touchstart', free, { passive: true });
  box.addEventListener('click', (e) => {
    if (host.dataset.k !== 'synced') return;
    const el = e.target.closest('.ll'); const j = els.indexOf(el); if (j < 0) return;
    core.seekMs(lines[j].t);
    hold = 0; host.classList.remove('free');
    cur = j; mark(j); follow(true);
  });
  new ResizeObserver(() => follow(true, true)).observe(sc);

  return {
    show(on) {
      clearInterval(timer); timer = 0;
      if (!on) return;
      timer = setInterval(step, 200); step(); follow(true, true);
    },
  };
}
