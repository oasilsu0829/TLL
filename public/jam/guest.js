// 잼 손님 (2026-11-13). Spotify에 로그인하지 않은 친구용 가벼운 창: 호스트가 연 잼에 곡만 넣는다
// (로그인한 친구는 이 창 대신 jam.js join()으로 같은 카세트 화면에 참가해 같이 듣는다)
// - 손님은 곡을 서버 대기열(/api/music/jam/add)에 넣고, 호스트 화면(jam.js)이 4초마다 가져가 자기 토큰으로 플레이리스트에 넣는다
// - 로그인한 손님: Spotify 검색 결과에서 정확한 곡을 고른다. 로그인 안 한 손님: '곡 이름 · 가수'를 그대로 보내면 호스트 쪽에서 찾아 첫 곡을 넣는다
// - Spotify 곡 링크(open.spotify.com/track/…)를 붙여넣어도 된다
// - 화면은 가벼운 창 하나(3D 없음). 셋리스트 · 지금 곡 · 대기 중인 곡을 4초마다 서버에서 읽는다
const C = window.MusicCore;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = { jam: null, pollT: 0, seq: 0, res: [] };

const CSS = `
#jg { width: min(520px, calc(100vw - 24px)); height: min(760px, calc(100dvh - 24px)); }
#jg .dlg { height: 100%; box-sizing: border-box; gap: 12px; }
.jg-sub { margin: -6px 0 0; font-size: 12px; color: var(--muted); }
.jg-list { flex: 1; min-height: 90px; overflow-y: auto; margin: 0; padding: 4px 0; list-style: none; border: 1px solid var(--line); border-radius: 10px; background: var(--z50); }
.jg-list li { display: flex; gap: 10px; align-items: baseline; padding: 7px 12px; font-size: 13px; line-height: 1.35; }
.jg-list li .n { flex: none; width: 22px; text-align: right; font-family: var(--mono); font-size: 10px; color: var(--muted); }
.jg-list li .w { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jg-list li .w em { font-style: normal; color: var(--muted); }
.jg-list li .by { flex: none; font-size: 11px; color: #6a5a9a; }
.jg-list li.cur { background: #fff7cc; font-weight: 600; }
.jg-list li.cur .n::before { content: '▶ '; color: var(--main, #026395); }
.jg-list li.done { color: var(--muted); }
.jg-list li.wait { color: var(--muted); font-style: italic; }
.jg-list .empty { padding: 18px 12px; text-align: center; color: var(--muted); font-size: 12px; }
#jg .dlg label.jg-me { flex-direction: row; align-items: center; gap: 8px; font-size: 11px; }
.jg-me input { flex: 1; min-width: 0; min-height: 36px !important; }
.jg-q { display: flex; gap: 8px; }
.jg-q input { flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--z300); border-radius: 8px; font: 14px var(--sans); background: #fff; color: var(--ink); }
.jg-q .btn { min-height: 44px; flex: none; }
.jg-res { list-style: none; margin: 0; padding: 0; max-height: 38%; overflow-y: auto; }
.jg-res li { display: flex; gap: 10px; align-items: center; padding: 7px 4px; border-bottom: 1px solid var(--line); cursor: pointer; }
.jg-res li:hover, .jg-res li:focus-visible { background: var(--z50); outline: none; }
.jg-res li i { width: 40px; height: 40px; flex: none; border-radius: 4px; background: var(--z200) center/cover no-repeat; }
.jg-res li div { flex: 1; min-width: 0; }
.jg-res li b { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jg-res li small { display: block; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jg-res li .plus { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--main, #026395); }
.jg-res li.raw i { display: grid; place-items: center; background: var(--z100); font-size: 18px; }
`;

function mount() {
  if ($('jg')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('dialog'); d.id = 'jg'; d.setAttribute('aria-labelledby', 'jgT');
  d.innerHTML = `<div class="dlg">
    <h2><span id="jgT">JAM</span><button class="icon-btn" type="button" id="jgX" aria-label="닫기">✕</button></h2>
    <p class="jg-sub" id="jgSub"></p>
    <ol class="jg-list" id="jgList"></ol>
    <label class="jg-me">내 이름 <input type="text" id="jgName" maxlength="24" placeholder="셋리스트에 적힐 이름" autocomplete="off"></label>
    <form class="jg-q" id="jgForm"><input type="search" id="jgQ" placeholder="곡 이름 · 가수, 또는 Spotify 곡 링크" enterkeyhint="search" autocomplete="off" aria-label="넣을 곡"><button class="btn dark" type="submit">찾기</button></form>
    <ul class="jg-res" id="jgRes"></ul>
    <p class="note" id="jgNote"></p>
    <div class="acts"><button class="btn" type="button" id="jgNew">내 잼 새로 시작</button></div>
  </div>`;
  document.body.appendChild(d);
  $('jgX').onclick = () => d.close();
  d.addEventListener('close', () => { clearTimeout(G.pollT); if (location.hash === '#jam') history.replaceState(null, '', location.pathname); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $('jgName').value = C.LS.get('music.guest') || (C.me() && C.me().display_name) || '';
  $('jgName').addEventListener('change', () => C.LS.set('music.guest', $('jgName').value.trim()));
  $('jgForm').addEventListener('submit', (e) => { e.preventDefault(); search(); });
  let t = 0;
  $('jgQ').addEventListener('input', () => { clearTimeout(t); if (C.loggedIn()) t = setTimeout(search, 450); });
  $('jgRes').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) send(G.res[+li.dataset.i]); });
  $('jgRes').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const li = e.target.closest('li[data-i]'); if (li) send(G.res[+li.dataset.i]); } });
  $('jgNew').onclick = () => {
    if (!confirm('친구의 잼 대신 내 잼을 새로 시작할까요? (친구 잼은 그대로 이어집니다)')) return;
    d.close(); C.startJam();
  };
  $('jgNote').textContent = C.loggedIn() ? '검색 결과에서 고르거나, 이름을 그대로 보내면 호스트 쪽에서 찾아 넣습니다.' : 'Spotify 로그인 없이도 됩니다. 곡 이름과 가수를 적어 보내면 호스트 쪽에서 찾아 넣습니다.';
}

export function open(jam) {
  mount();
  G.jam = jam; paint();
  const d = $('jg'); if (!d.open) d.showModal();
  loop();
}

function loop() {
  clearTimeout(G.pollT);
  G.pollT = setTimeout(async () => {
    if (!$('jg').open) return;
    if (document.visibilityState === 'visible') await refresh();
    loop();
  }, 4000);
}
async function refresh() {
  try {
    const j = await C.srv('/api/music/jam', { spotify: false });
    if (!j.jam) { G.jam = null; paint(); return; }
    G.jam = j.jam; paint();
  } catch {}
}

function paint() {
  const J = G.jam, ul = $('jgList');
  if (!J) {
    $('jgT').textContent = 'JAM'; $('jgSub').textContent = '잼이 끝났습니다';
    ul.innerHTML = '<li class="empty">지금 열린 잼이 없습니다</li>'; $('jgForm').hidden = true; return;
  }
  $('jgForm').hidden = false;
  $('jgT').textContent = J.name || 'JAM';
  const list = J.list || [], wait = J.wait || [];
  $('jgSub').textContent = `${J.host || '호스트'} 님의 잼 · ${list.length}곡${wait.length ? ` · 대기 ${wait.length}` : ''}`;
  const rows = list.map((x, i) => `<li class="${i === J.cur ? 'cur' : J.cur > i ? 'done' : ''}"><span class="n">${i + 1}</span><span class="w">${esc(x.t)} <em>— ${esc(x.a)}</em></span>${x.by ? `<span class="by">${esc(x.by)}</span>` : ''}</li>`);
  const w = wait.map((x) => `<li class="wait"><span class="n">·</span><span class="w">${esc(x.label)} …</span><span class="by">${esc(x.by)}</span></li>`);
  ul.innerHTML = rows.length || w.length ? rows.join('') + w.join('') : '<li class="empty">아직 곡이 없습니다. 첫 곡을 넣어 보세요</li>';
  const c = ul.querySelector('li.cur'); if (c) c.scrollIntoView({ block: 'nearest' });
}

const fmt = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
async function search() {
  const q = $('jgQ').value.trim(), ul = $('jgRes'), seq = ++G.seq;
  G.res = [];
  if (!q) { ul.innerHTML = ''; return; }
  const link = q.match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/|spotify:track:)([A-Za-z0-9]{10,40})/);
  if (link) G.res.push({ uris: ['spotify:track:' + link[1]], label: 'Spotify 링크로 넣은 곡', sub: '링크 그대로 넣기', raw: '🔗' });
  else G.res.push({ q, label: q, sub: '이대로 보내기 · 호스트 쪽에서 찾아 첫 곡을 넣음', raw: '✎' });
  draw();
  if (link || !C.loggedIn()) return;
  try {
    const j = await C.api(`/search?type=track&limit=8&q=${encodeURIComponent(q)}`);
    if (seq !== G.seq) return;
    for (const x of ((j && j.tracks && j.tracks.items) || []).filter(Boolean)) {
      const ar = (x.artists || []).map((a) => a.name).join(', '), im = (x.album && x.album.images) || [];
      G.res.push({ uris: [x.uri], label: `${x.name} — ${ar}`, name: x.name, sub: `${ar} · ${fmt(x.duration_ms)}`, img: (im.slice(-1)[0] || {}).url || '' });
    }
    draw();
  } catch {}
}
function draw() {
  $('jgRes').innerHTML = G.res.map((x, i) => `<li tabindex="0" data-i="${i}" class="${x.raw ? 'raw' : ''}"><i${x.img ? ` style="background-image:url('${esc(x.img)}')"` : ''}>${x.raw || ''}</i><div><b>${esc(x.name || x.label)}</b><small>${esc(x.sub)}</small></div><span class="plus">+ 넣기</span></li>`).join('');
}

async function send(x) {
  if (!x || !G.jam) return;
  const by = $('jgName').value.trim() || (C.me() && C.me().display_name) || '손님';
  C.LS.set('music.guest', by);
  try {
    await C.srv('/api/music/jam/add', { method: 'POST', spotify: false, body: { pid: G.jam.pid, uris: x.uris || [], q: x.q || '', label: x.label, by } });
    C.toast('보냈습니다. 호스트 화면에 곧 적힙니다', 2500);
    $('jgQ').value = ''; $('jgRes').innerHTML = ''; G.res = [];
    if (C.sfx && C.sfx.flip) C.sfx.flip();
    refresh();
  } catch (e) { C.toast(e.message || '보내지 못했습니다'); }
}
