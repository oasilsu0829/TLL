// 33⅓ 월간지: 사용자마다 다르게, 그 자리에서 Spotify 청취 기록으로 짠다.
// 재료: /me/top/tracks·artists(최근 4주), /me/player/recently-played(최근 50곡), 앱이 쌓은 music.plays(앱을 켜 둔 동안의 재생 시간).
// 숫자는 모두 이 재료에서만 나온다. '허세 카드'는 리스너를 띄워 주는 말이지만, 문장마다 근거 숫자를 함께 적는다.
// 앨범 표지·아티스트 사진은 Spotify가 준 그대로 쓴다(자르거나 색을 바꾸지 않음).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (im, w) => { if (!im || !im.length) return ''; const s = im.slice().sort((x, y) => (x.width || 0) - (y.width || 0)); return (s.find((x) => (x.width || 0) >= w) || s[s.length - 1]).url; };
const kst = (d) => new Date(d.getTime() + 9 * 3600e3);
const DAYS = '월화수목금토일';

function readLog(ym) {
  let L = null; try { L = JSON.parse(localStorage.getItem('music.plays')); } catch {}
  const out = { secs: 0, days: 0, byId: {}, cnt: {}, heat: Array.from({ length: 7 }, () => Array(24).fill(0)), meta: (L && L.meta) || {} };
  if (!L || !L.days) return out;
  for (const [d, D] of Object.entries(L.days)) {
    if (!d.startsWith(ym)) continue;
    out.days++;
    for (const [id, s] of Object.entries(D.s || {})) { out.secs += s; out.byId[id] = (out.byId[id] || 0) + s; }
    for (const [id, c] of Object.entries(D.c || {})) out.cnt[id] = (out.cnt[id] || 0) + c;
    (D.h || []).forEach((s, h) => { out.heat[D.wd ?? 0][h] += s; });
  }
  return out;
}

// 허세 카드: 근거 숫자가 있는 것만 고른다
function brag(d) {
  const B = [];
  const hrs = d.log.secs / 3600;
  if (d.log.secs >= 600) {
    const h = Math.floor(hrs), m = Math.round((d.log.secs % 3600) / 60);
    B.push({ big: h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`, line: hrs >= 20 ? `이번 달 판 위에서 보낸 시간. 영화 ${Math.floor(hrs / 2)}편, 서울에서 부산까지 KTX ${Math.floor(hrs / 2.5)}번. 이쯤 되면 귀가 직업이다.` : hrs >= 5 ? `이번 달 판 위에서 보낸 시간. 영화 ${Math.max(1, Math.floor(hrs / 2))}편 분량을 귀로만 봤다.` : '이번 달 판 위에서 보낸 시간. 진짜 귀는 천천히 데워진다.', src: `T/L/L에서 들은 시간 · ${d.log.days}일치` });
  }
  const pops = d.arts.map((a) => a.pop).filter((p) => typeof p === 'number');
  if (pops.length >= 3) {
    const p = Math.round(pops.reduce((a, b) => a + b, 0) / pops.length);
    B.push({ big: String(p), line: p < 45 ? '자주 듣는 아티스트들의 평균 인기도. 남들이 아직 모르는 이름을 먼저 찾아내는 귀다.' : p < 65 ? '자주 듣는 아티스트들의 평균 인기도. 큰 무대와 지하 사이, 가장 맛있는 선을 탄다.' : '자주 듣는 아티스트들의 평균 인기도. 시대의 노래를 알아보는 것도 재능이다.', src: `Spotify 인기도(0–100) · 상위 아티스트 ${pops.length}명` });
  }
  if (d.recent.length >= 20) {
    const uniq = new Set(d.recent.map((r) => r.a)).size;
    B.push({ big: `${uniq}명`, line: uniq >= d.recent.length * 0.6 ? '최근 들은 노래 속 서로 다른 아티스트. 한 우물만 파지 않는 잡식성, 플레이리스트가 곧 잡지다.' : uniq <= d.recent.length * 0.25 ? '최근 들은 노래 속 서로 다른 아티스트. 한번 빠지면 끝까지 판다. 진짜 팬은 이런 사람이다.' : '최근 들은 노래 속 서로 다른 아티스트. 넓게 듣되 깊게 고른다.', src: `최근 재생 ${d.recent.length}곡 기준` });
    const night = d.recent.filter((r) => { const h = kst(r.at).getUTCHours(); return h < 5; }).length / d.recent.length;
    const morn = d.recent.filter((r) => { const h = kst(r.at).getUTCHours(); return h >= 6 && h < 10; }).length / d.recent.length;
    if (night >= 0.15) B.push({ big: `${Math.round(night * 100)}%`, line: '자정을 넘겨 들은 노래의 비율. 남들이 잘 때 듣는 사람이 결국 먼저 안다.', src: `최근 재생 ${d.recent.length}곡 기준` });
    else if (morn >= 0.2) B.push({ big: `${Math.round(morn * 100)}%`, line: '아침 6–10시에 들은 노래의 비율. 하루를 음악으로 여는 사람.', src: `최근 재생 ${d.recent.length}곡 기준` });
  }
  const genres = new Set(d.arts.flatMap((a) => a.g));
  if (genres.size >= 4) B.push({ big: `${genres.size}개`, line: '상위 아티스트들이 걸친 장르의 수. 장르 지도를 머릿속에 들고 다니는 사람.', src: `Spotify 장르 · 상위 아티스트 ${d.arts.length}명` });
  const rep = Object.entries(d.log.cnt).sort((a, b) => b[1] - a[1])[0];
  if (rep && rep[1] >= 4) { const m = d.log.meta[rep[0]] || {}; B.push({ big: `${rep[1]}번`, line: `'${esc(m.n || '이 곡')}'을 이번 달 다시 건 횟수. 집요함은 취향의 다른 이름이다.`, src: 'T/L/L에서 들은 기록' }); }
  if (d.tops[0] && d.arts[0] && d.tops[0].a.split(', ').includes(d.arts[0].n)) B.push({ big: '1 = 1', line: `1위 곡과 1위 아티스트가 같다. 이번 달을 ${esc(d.arts[0].n)}에게 걸었다.`, src: 'Spotify 최근 4주 순위' });
  return B.slice(0, 6);
}

const folio = (n, side) => `<div class="folio" ${side === 'L' ? '' : ''}>${n}</div>`;
const rh = (a, b) => `<div class="rh"><span>${a}</span><span>${b}</span></div>`;
const cover = (img, size, rot, extra = '') => `<div style="position:absolute;${extra};width:${size}cqw;height:${size}cqw;background:#fff;padding:1.2cqw;box-shadow:.8cqw .8cqw 0 #141414;transform:rotate(${rot}deg)"><div style="width:100%;height:100%;background:#ddd url('${esc(img)}') center/cover"></div></div>`;

function bigSingle(title, tracks, x, y, r, w) {
  const half = Math.ceil(tracks.length / 2);
  const tl = tracks.map((s, i) => `<b>${i < half ? 'A' : 'B'}${(i < half ? i : i - half) + 1}</b> ${esc(s.t)} — ${esc(s.a.split(', ')[0])}<br>`).join('');
  return `<div class="single7 bigs" data-i="0" role="button" tabindex="0" aria-label="부록 싱글. 눌러서 테이프를 떼고 재생" style="left:${x}cqw;top:${y}cqw;--r:${r}deg;--w:${w}cqw"><span class="sl"><span class="ttl">${esc(title)}</span><span class="ho" style="--c:#d62718"></span><span class="tl">${tl}</span></span><span class="bg"></span><span class="tp" style="left:-8%;top:5%;width:40%;transform:rotate(-12deg)"></span><span class="tp" style="left:64%;top:74%;width:30%;transform:rotate(22deg)"></span><span class="c2">이달의 노래 ${tracks.length}곡, 한 장에<small>테이프를 떼면 처음부터 재생</small></span></div>`;
}

function msgSpread(title, text, act, label) {
  return `<div class="spread single"><div class="pg ray">
    <div class="jt" style="position:absolute;left:0;right:0;top:-1cqw;text-align:center;font-size:36cqw;line-height:1;color:#f4efe6;text-shadow:1cqw 1cqw 0 #141414">33⅓</div>
    <div style="position:absolute;left:7cqw;right:7cqw;top:52cqw;background:#f6f1e7;padding:5cqw;box-shadow:1cqw 1cqw 0 #141414">
      <div style="font-family:var(--body);font-weight:900;font-size:5.4cqw;line-height:1.3;color:#141414">${title}</div>
      <div style="font-family:var(--ui);font-size:2.8cqw;line-height:1.6;margin-top:2cqw;color:#141414">${text}</div>
      ${act ? `<button type="button" data-act="${act}" style="margin-top:3cqw;font:inherit;font-family:var(--ui);font-weight:900;font-size:3cqw;padding:2cqw 4cqw;border:0;background:#d62718;color:#fff;cursor:pointer">${label}</button>` : ''}
    </div></div></div>`;
}

export async function build(C) {
  const now = kst(new Date()), ym = now.toISOString().slice(0, 7), mon = `${now.getUTCMonth() + 1}월`, yy = now.getUTCFullYear();
  if (!C || !C.loggedIn()) return { sp: [msgSpread('Spotify를 연결하면<br>당신만의 33⅓이 나옵니다', '이 잡지는 당신의 청취 기록으로 매달 새로 짜입니다. 음악 앱 설정에서 Spotify에 연결한 뒤 다시 펼쳐 주세요.')], tracks: [] };
  const need = ['user-top-read', 'user-read-recently-played'].filter((s) => !C.hasScope(s));
  if (need.length) return { sp: [msgSpread('청취 기록을 볼 권한이<br>하나 더 필요합니다', '33⅓은 최근 4주 많이 들은 곡·아티스트와 최근 재생 기록을 읽습니다. 아래 버튼으로 Spotify에 한 번만 다시 연결해 주세요.', 'relogin', 'Spotify 다시 연결')], tracks: [] };
  const get = (p) => C.api(p).catch(() => null);
  const [me, tt, ta, rp] = await Promise.all([get('/me'), get('/me/top/tracks?time_range=short_term&limit=20'), get('/me/top/artists?time_range=short_term&limit=10'), get('/me/player/recently-played?limit=50')]);
  const d = {
    name: (me && me.display_name) || '나',
    tops: ((tt && tt.items) || []).map((t) => ({ uri: t.uri, n: t.name, a: (t.artists || []).map((x) => x.name).join(', '), img: pick(t.album && t.album.images, 300), al: t.album && t.album.name })),
    arts: ((ta && ta.items) || []).map((a) => ({ n: a.name, img: pick(a.images, 300), g: a.genres || [], pop: a.popularity })),
    recent: ((rp && rp.items) || []).map((x) => ({ at: new Date(x.played_at), n: x.track.name, a: (x.track.artists || []).map((z) => z.name).join(', ') })),
    log: readLog(ym),
  };
  if (!d.tops.length && !d.recent.length) return { sp: [msgSpread('아직 기록이 없습니다', 'Spotify에서 최근 4주 동안 들은 기록이 쌓이면 이 잡지가 채워집니다. 다음 달 1일에 다시 펼쳐 보세요.')], tracks: [] };
  const B = brag(d);
  const t1 = d.tops[0];
  const hrs = d.log.secs / 3600;
  const coverStat = d.log.secs >= 600 ? `${Math.floor(hrs)}<small>시간</small>` : `${d.tops.length}<small>곡</small>`;
  const sp = [];

  /* 00 표지 */
  sp.push(`<div class="spread single"><div class="pg ray">
    <div class="jt" style="position:absolute;left:0;right:0;top:-1cqw;text-align:center;font-size:34cqw;line-height:1;letter-spacing:-.02em;color:#f4efe6;text-shadow:1cqw 1cqw 0 #141414">33⅓</div>
    <div style="position:absolute;right:4cqw;top:36cqw;text-align:right;font-family:var(--mono);font-size:2.2cqw;line-height:1.5;color:#f4efe6;text-shadow:.3cqw .3cqw 0 #141414">VOL. ${yy}.${String(now.getUTCMonth() + 1).padStart(2, '0')}<br>T/L/L 출판</div>
    ${d.tops.slice(0, 4).map((t, i) => cover(t.img, 30, [-6, 4, 3, -5][i], `left:${[6, 34, 10, 38][i]}cqw;top:${[44, 48, 76, 80][i]}cqw`)).join('')}
    <div style="position:absolute;right:4cqw;top:48cqw;text-align:right;font-family:var(--body);font-weight:900;font-size:6cqw;line-height:1.2;color:#fff;text-shadow:.4cqw .5cqw 0 #141414;max-width:30cqw;word-break:keep-all">${esc(d.name)}의<br>${mon}</div>
    <div class="jt" style="position:absolute;right:4cqw;top:74cqw;text-align:right;font-size:13cqw;line-height:1;color:#ffd84d;text-shadow:.6cqw .6cqw 0 #141414">${coverStat.replace('<small>', '<small style="font-size:5cqw">')}</div>
    <div style="position:absolute;left:4cqw;right:4cqw;bottom:6cqw;font-family:var(--body);font-weight:900;font-size:4.2cqw;line-height:1.3;color:#fff;text-shadow:.4cqw .5cqw 0 #141414">${t1 ? `이달의 1위 '${esc(t1.n)}'` : '이달의 기록'}</div>
    <div style="position:absolute;right:4cqw;bottom:16cqw;width:14cqw;height:7cqw;background:#fff;padding:1cqw"><i class="bar"></i></div>
  </div></div>`);

  /* 01 편집장의 글 + 차례 */
  const toc = [['2', '이달의 한 줄'], ['4', 'TOP 20'], ['5', '이달의 1위'], ['6', '언제 듣나'], ['7', '아티스트 다섯'], ['8', '허세 카드'], ['10', '부록 · 이달의 LP']];
  sp.push(`<div class="spread"><div class="pg L">${rh('From the chart desk', `33⅓ · ${mon}`)}
      <div class="jt" style="position:absolute;left:7cqw;right:7cqw;top:11cqw;font-size:8cqw;line-height:1;color:#1f2a8a">YOUR ${esc(['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][now.getUTCMonth()])}.</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:24cqw;font-family:var(--body);font-weight:900;font-size:4.6cqw;line-height:1.3">${esc(d.name)}의 ${mon}을 셌다</div>
      <div class="body2" style="position:absolute;left:7cqw;right:7cqw;top:36cqw;font-size:2.7cqw">
        <p class="drop">이번 달 가장 많이 들은 노래는 ${t1 ? `'${esc(t1.n)}'(${esc(t1.a)})` : '아직 정해지지 않았다'}. ${d.arts[0] ? `가장 많이 찾은 이름은 ${esc(d.arts[0].n)}.` : ''}</p>
        ${B[0] ? `<p>${esc(B[0].big)} — ${B[0].line}</p>` : ''}
        <p>숫자는 두 곳에서 왔다. Spotify가 매긴 최근 4주 순위와 최근 재생 ${d.recent.length}곡, 그리고 T/L/L을 켜 두고 들은 ${d.log.days}일치 기록. 기록에 없는 숫자는 쓰지 않았다.</p>
        <p class="ni" style="text-align:right;font-family:var(--mono);font-size:2.2cqw">— 차트 데스크</p>
      </div>${folio(2)}</div>
    <div class="pg R"><div class="jt" style="position:absolute;left:6cqw;top:4cqw;font-size:15cqw;line-height:1;color:#d62718">CONTENTS</div>
      <div class="lbl" style="position:absolute;left:7cqw;top:22cqw;color:#1f2a8a">33⅓ · ${esc(d.name)}의 ${mon}</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:28cqw">${toc.map(([n, t]) => `<div style="display:grid;grid-template-columns:12cqw 1fr;gap:2cqw;align-items:baseline;border-top:.3cqw solid #141414;padding:2.2cqw 0"><span class="jt" style="font-size:6.4cqw;line-height:.9;color:#1f2a8a">${n}</span><b style="font-family:var(--ui);font-weight:900;font-size:3cqw">${t}</b></div>`).join('')}</div>${folio(3)}</div></div>`);

  /* 02 TOP 20 + 1위 */
  const rows = d.tops.slice(0, 20).map((t, i) => `<div style="display:grid;grid-template-columns:7cqw 5cqw 1fr;gap:1.6cqw;align-items:center;border-top:.15cqw solid rgba(18,18,18,.18);padding:.25cqw 0"><span class="jt" style="font-size:2.8cqw">${i + 1}</span><span style="width:4.4cqw;height:4.4cqw;background:#ddd url('${esc(t.img)}') center/cover"></span><span style="font-family:var(--ui);font-size:2cqw;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${esc(t.n)}</b> · <span style="color:#6b665e">${esc(t.a)}</span></span></div>`).join('');
  const sec1 = t1 && d.log.byId ? Object.entries(d.log.meta).find(([, m]) => m.u === t1.uri) : null;
  const t1min = sec1 ? Math.round((d.log.byId[sec1[0]] || 0) / 60) : 0;
  sp.push(`<div class="spread"><div class="pg L">${rh('The chart', 'Spotify 최근 4주')}
      <div class="jt" style="position:absolute;left:6cqw;top:9cqw;font-size:9cqw;line-height:1;color:#d62718">TOP 20</div>
      <div class="cap" style="position:absolute;left:6.4cqw;top:19cqw">순위는 Spotify가 매긴 최근 4주 기준</div>
      <div style="position:absolute;left:6cqw;right:6cqw;top:23cqw">${rows}</div>${folio(4)}</div>
    <div class="pg R" style="background:#1f2a8a;color:#f4efe6">
      <div class="lbl" style="position:absolute;left:7cqw;top:7cqw;color:#ffd84d">Number one</div>
      <div class="jt" style="position:absolute;right:5cqw;top:3cqw;font-size:30cqw;line-height:1;color:#d62718;text-shadow:.8cqw .8cqw 0 #141414">#1</div>
      ${t1 ? cover(t1.img, 56, -3, 'left:10cqw;top:24cqw') : ''}
      <div style="position:absolute;left:7cqw;right:7cqw;top:88cqw;font-family:var(--body);font-weight:900;font-size:5.6cqw;line-height:1.2">${t1 ? esc(t1.n) : ''}</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:${t1 && t1.n.length > 18 ? 103 : 97}cqw;font-family:var(--ui);font-size:2.6cqw;color:#c9cdf0">${t1 ? `${esc(t1.a)} · [${esc(t1.al)}]` : ''}${t1min ? ` · T/L/L에서 ${t1min}분` : ''}</div>
      ${folio(5)}</div></div>`);

  /* 03 히트맵 + 아티스트 */
  let heat = d.log.heat, heatSrc = `T/L/L에서 들은 시간 · ${d.log.days}일치`;
  if (d.log.secs < 600) { heat = Array.from({ length: 7 }, () => Array(24).fill(0)); for (const r of d.recent) { const k = kst(r.at); heat[(k.getUTCDay() + 6) % 7][k.getUTCHours()]++; } heatSrc = `최근 재생 ${d.recent.length}곡`; }
  const mx = Math.max(1, ...heat.flat());
  let peak = [0, 0]; heat.forEach((row, w) => row.forEach((v, h) => { if (v > heat[peak[0]][peak[1]]) peak = [w, h]; }));
  const H = `<div style="display:grid;grid-template-columns:4cqw repeat(24,minmax(0,1fr));gap:.35cqw;font-family:var(--mono);font-size:1.4cqw;color:#6b665e"><span></span>${Array.from({ length: 24 }, (_, h) => `<span style="text-align:center">${h % 6 ? '' : h}</span>`).join('')}${heat.map((row, w) => `<span style="font-family:var(--ui);font-size:1.9cqw;color:#141414">${DAYS[w]}</span>` + row.map((v) => `<span style="aspect-ratio:1;background:${v ? `rgba(214,39,24,${(0.15 + 0.85 * v / mx).toFixed(2)})` : '#ece6da'}"></span>`).join('')).join('')}</div>`;
  const genres = [...d.arts.flatMap((a) => a.g).reduce((m, g) => m.set(g, (m.get(g) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  sp.push(`<div class="spread"><div class="pg L">${rh('When I listen', heatSrc)}
      <div style="position:absolute;left:7cqw;top:10cqw;font-family:var(--body);font-weight:900;font-size:6cqw">언제 듣나</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:24cqw">${H}</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:66cqw"><div class="jt" style="font-size:13cqw;line-height:1;color:#d62718">${DAYS[peak[0]]} ${peak[1]}시</div>
      <div class="body2" style="font-size:2.6cqw;margin-top:2cqw"><p class="ni">가장 많이 들은 칸. ${peak[1] < 5 ? '모두가 잠든 시간에 가장 깨어 있는 귀다.' : peak[1] < 10 ? '하루를 음악으로 여는 사람이다.' : peak[1] < 18 ? '한낮의 배경음까지 직접 고르는 사람이다.' : '하루를 음악으로 닫는 사람이다.'} (${esc(heatSrc)})</p></div></div>${folio(6)}</div>
    <div class="pg R">${rh('Artists', 'Spotify 최근 4주')}
      <div style="position:absolute;left:7cqw;top:10cqw;font-family:var(--body);font-weight:900;font-size:6cqw">아티스트 다섯</div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:22cqw">${d.arts.slice(0, 5).map((a, i) => `<div style="display:grid;grid-template-columns:7cqw 13cqw 1fr;gap:2.4cqw;align-items:center;border-top:.2cqw solid #141414;padding:1.6cqw 0"><span class="jt" style="font-size:6cqw;color:#1f2a8a">${i + 1}</span><span style="width:13cqw;height:13cqw;background:#ddd url('${esc(a.img)}') center/cover"></span><span><b style="font-family:var(--ui);font-weight:900;font-size:3.2cqw">${esc(a.n)}</b><span class="cap" style="display:block">${esc(a.g.slice(0, 2).join(' · '))}</span></span></div>`).join('')}</div>
      ${genres.length ? `<div style="position:absolute;left:7cqw;right:7cqw;bottom:10cqw;display:flex;flex-wrap:wrap;gap:1.2cqw">${genres.map(([g, n]) => `<span style="font-family:var(--ui);font-weight:700;font-size:${(1.9 + n * .25).toFixed(2)}cqw;background:#141414;color:#f4efe6;padding:.6cqw 1.6cqw">${esc(g)}</span>`).join('')}</div>` : ''}${folio(7)}</div></div>`);

  /* 04 허세 카드 */
  sp.push(`<div class="spread ray"><div style="position:absolute;left:3cqw;top:2.6cqw;background:#141414;color:#ffd84d;padding:.4cqw 1.6cqw .8cqw"><span class="jt" style="font-size:4.6cqw">BRAG CARDS</span></div>
    <div style="position:absolute;left:3.2cqw;top:10.6cqw;font-family:var(--body);font-weight:900;font-size:2.2cqw;color:#fff;text-shadow:.2cqw .2cqw 0 #141414">허세 카드 — 이번 달, 당신의 귀를 자랑할 근거들</div>
    <div style="position:absolute;left:3cqw;right:3cqw;top:15.5cqw;bottom:3cqw;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:1.6cqw">
    ${B.map((b, i) => `<div style="background:${['#f6f1e7', '#ffd84d', '#f6f1e7', '#f6f1e7', '#f6f1e7', '#ffd84d'][i]};box-shadow:.6cqw .6cqw 0 #141414;padding:1.8cqw;display:flex;flex-direction:column;gap:.8cqw;transform:rotate(${[-1.2, .8, -.4, .9, -.8, .5][i]}deg)"><div class="jt" style="font-size:4.6cqw;line-height:1;color:#d62718">${esc(b.big)}</div><div style="font-family:var(--body);font-weight:900;font-size:1.45cqw;line-height:1.5;color:#141414">${b.line}</div><div style="margin-top:auto;font-family:var(--mono);font-size:.95cqw;color:#6b665e">근거: ${esc(b.src)}</div></div>`).join('')}
    </div></div>`);

  /* 05 부록 */
  const tracks = d.tops.slice(0, 5).map((t) => ({ t: t.n, a: t.a, uri: t.uri, img: t.img }));
  sp.push(`<div class="spread"><div class="pg L">${rh('Supplement', '부록')}
      <div class="jt" style="position:absolute;left:6cqw;top:9cqw;font-size:12cqw;line-height:1;color:#d62718">SUPPLEMENT</div>
      <div class="body2" style="position:absolute;left:7cqw;right:7cqw;top:24cqw;font-size:2.4cqw"><p class="ni">이달의 TOP 5를 LP 한 장에 담아 투명 비닐째 붙였다. 테이프를 떼면 Spotify에 플레이리스트가 만들어지고, T/L/L 출판 크레이트에 한 장으로 꽂힌다.</p></div>
      <div style="position:absolute;left:7cqw;right:7cqw;top:42cqw">${tracks.map((t, i) => `<div style="display:grid;grid-template-columns:8cqw 1fr;gap:2cqw;border-top:.15cqw solid rgba(18,18,18,.18);padding:2cqw 0"><span style="font-family:var(--mono);font-size:2.6cqw;color:#d62718">${i < 3 ? 'A' : 'B'}${i < 3 ? i + 1 : i - 2}</span><span><b style="font-family:var(--body);font-weight:900;font-size:3.2cqw">${esc(t.t)}</b><span class="cap" style="display:block">${esc(t.a)}</span></span></div>`).join('')}</div>${folio(10)}</div>
    <div class="pg R" style="background:#f2eee4">${bigSingle(`33⅓ ${mon} — 부록 LP`, tracks, 12, 22, -3, 74)}${folio(11)}</div></div>`);
  return { sp, tracks };
}
