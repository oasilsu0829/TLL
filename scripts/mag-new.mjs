#!/usr/bin/env node
// 새 호 뼈대 만들기. 잡지를 빨리 쓰기 위한 첫 단계(.claude/skills/mag-issue/SKILL.md).
//   node scripts/mag-new.mjs <drop|fb|cy> [--date YYYY-MM-DD] [--dry] [--force]
// 하는 일
//   1. 발행일 계산: --date(없으면 오늘, 한국 시각) 당일이나 그 뒤 첫 발행 요일(Drop 금 · feedback 월 · Cypher 수)
//   2. 차례 검사(system.md 1장): 기준 주 2026-11-09, n%3 → 0 Drop · 1 feedback · 2 Cypher. 차례가 아니면 이유를 말하고 끝(종료 코드 3)
//   3. 같은 잡지·같은 날짜 호가 index.json에 있으면 끝(종료 코드 4)
//   4. 다음 호 id(drop-NN …)로 docs/magazine/issues/<id>/ 에 articles.md · notes.md · pages.html 뼈대를 만든다
//      뼈대의 'TODO:'는 mag-check가 오류로 잡는다(다 채워야 발행)
//   5. 읽을 것(바이블·기억·연재 다음 회)을 출력
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const mag = args.find((a) => !a.startsWith('--'));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry');
const FORCE = args.includes('--force'); // 사용자가 차례 밖 호를 따로 요청했을 때만: 차례·같은 날짜 검사를 건너뜀
const ROOT = resolve('.');

const MAGS = {
  drop: {
    name: 'Drop', vol: 'Vol.', day: 5, dayKo: '금', bible: 'drop', publisher: '드롭 레코드', color: '#f59ad6',
    crate: { id: 'c-pub-drop', name: '드롭 레코드', o: 901 }, accent: '#f59ad6', accent2: '#b3337f',
    font: 'Archivo Black', fontQ: 'Archivo+Black&family=Black+Han+Sans', writer: '고한석',
    serial: { id: 'drop-canon', title: '정전 해부' },
    arts: [
      ['letter', '편집장의 글', '고한석'],
      ['briefs', '이번 주 단평', '단평 데스크'],
      ['cover', '이번 주의 한 장', '고한석'],
      ['origin', '원본을 들어라', '고한석'],
      ['serial', "연재 '정전 해부'", '고한석'],
      ['live', '공연·발매 소식', '편집부'],
      ['desk', '편집 노트', '편집부'],
    ],
  },
  fb: {
    name: 'feedback', vol: 'vol.', day: 1, dayKo: '월', bible: 'feedback', publisher: '피드백 프레스', color: '#2bb3d9',
    crate: { id: 'c-pub-fb', name: '피드백 프레스', o: 902 }, accent: '#2bb3d9', accent2: '#137a99',
    font: 'Alfa Slab One', fontQ: 'Alfa+Slab+One', writer: '노암 갤러거',
    serial: { id: 'fb-rooms', title: '방' },
    arts: [
      ['letter', '편집장의 글', '노암 갤러거'],
      ['briefs', '이번 주 밴드', '편집부'],
      ['cover', '커버 스토리', '노암 갤러거'],
      ['night', '이 판과 어울리는 밤', '노암 갤러거'],
      ['serial', "연재 '방'", '노암 갤러거'],
      ['front', '앞줄', '앞줄'],
      ['live', '공연 소식', '편집부'],
      ['desk', '편집 노트', '편집부'],
    ],
  },
  cy: {
    name: 'Cypher', vol: 'Vol.', day: 3, dayKo: '수', bible: 'cypher', publisher: '사이퍼 미디어', color: '#b0201e',
    crate: { id: 'c-pub-cy', name: '사이퍼 미디어', o: 903 }, accent: '#e2372f', accent2: '#b0201e',
    font: 'Archivo Black', fontQ: 'Archivo+Black&family=Jost:wght@700;900&family=Black+Han+Sans', writer: '돈까스',
    serial: { id: 'cy-chron', title: '언더그라운드 연대기' },
    arts: [
      ['letter', '편집장의 글', '돈까스'],
      ['briefs', '이번 주 단신', '편집부'],
      ['cover', '커버', '돈까스'],
      ['map', '피처링 지도 · 샘플 추적', '편집부'],
      ['serial', "연재 '언더그라운드 연대기'", '돈까스'],
      ['scene', '씬 리포트', '씬 리포트 데스크'],
      ['live', '공연 소식', '편집부'],
      ['desk', '편집 노트', '편집부'],
    ],
  },
};
const ORDER = ['drop', 'fb', 'cy'];
const M = MAGS[mag];
if (!M) { console.error('사용법: node scripts/mag-new.mjs <drop|fb|cy> [--date YYYY-MM-DD] [--dry]'); process.exit(2); }

/* ── 날짜 ── */
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const D = (s) => new Date(s + 'T00:00:00Z');
const ymd = (d) => d.toISOString().slice(0, 10);
const base = D(opt('--date') || kstToday());
const pub = new Date(base); while (pub.getUTCDay() !== M.day) pub.setUTCDate(pub.getUTCDate() + 1);
const mon = new Date(pub); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7));
const n = Math.round((mon - D('2026-11-09')) / 864e5 / 7);
const turn = ORDER[((n % 3) + 3) % 3];
const dot = ymd(pub).replace(/-/g, '.');
console.log(`발행일 ${ymd(pub)}(${M.dayKo}) · 그 주 월요일 ${ymd(mon)} · n=${n} → 이번 주 차례 ${MAGS[turn].name}`);
if (turn !== mag && !FORCE) { console.log(`이번 주는 ${MAGS[turn].name} 차례. 아무것도 만들지 않음`); process.exit(3); }

/* ── 호 id ── */
const index = JSON.parse(readFileSync(join(ROOT, 'public/mag/issues/index.json'), 'utf8'));
if (!FORCE && index.issues.some((x) => x.mag === mag && x.date === dot)) { console.log(`${M.name} ${dot} 호가 이미 있음. 끝`); process.exit(4); }
const nums = index.issues.filter((x) => x.mag === mag).map((x) => +(x.id.match(/-(\d+)$/) || [0, 0])[1]);
const NN = String(Math.max(0, ...nums) + 1).padStart(2, '0');
const id = `${mag}-${NN}`, vol = `${M.vol}${NN}`;
const dir = join(ROOT, 'docs/magazine/issues', id);
if (existsSync(dir) && existsSync(join(dir, 'articles.md'))) { console.log(`${dir} 가 이미 있음(이어서 작업할 것). 덮어쓰지 않음`); process.exit(4); }

const serials = JSON.parse(readFileSync(join(ROOT, 'public/mag/serials.json'), 'utf8')).serials;
const ser = serials.find((s) => s.id === M.serial.id);
const sn = ser ? ser.episodes.length + 1 : 1;
const prev = index.issues.filter((x) => x.mag === mag && x.fmt === 2).at(-1);

/* ── articles.md ── */
const art = (a, title, by, body) => `@art ${a} | ${title} | ${by}\n\n${body.trim()}\n\n`;
const T = (s) => `TODO: ${s}`;
const coverBody = `
#s0
${T('장면으로 열기. 상상이면 문장 안에서 밝힌다("이건 내가 그려 본 장면이다"). 300~500자')}

#s1 왜 지금
${T('발매일·레이블·곡 수 등 사실(노트 id). 이 잡지가 왜 이 판을 골랐나')}

#s2 ${T('소제목')}
${T('전개 1 — 출신·시작')}

#s3 ${T('소제목')}
${T('전개 2 — 경력 속 전환점')}

#s4 ${T('소제목')}
${T('전개 3 — 이 판이 만들어진 과정(녹음 장소·사람·기간)')}

#s5 ${T('소제목')}
${T('이 판이 기대는 과거(곡 목록·크레딧·원본)')}

#s6 아쉬움에 대하여
${T('가장 강한 반론과 답(출처 있는 것만)')}

#s7 ${T('이 아티스트가 지키는 것')}
${T('바이블 핵심 철학과 잇기')}

#s8 ${T('처음 장면으로 돌아오기')}
${T('s0의 장면을 되받는 짧은 끝')}
`;
const bodies = {
  letter: `#a\n${T('편집장의 글 600~900자. 이번 호를 고른 이유 한 가지')}\n\n#b\n${T('둘째 문단')}`,
  briefs: `#b0\n${T('단신 1 — 아티스트 [앨범] (레이블). 사실 + 들을 이유 한 줄')}\n\n※ ${T('이럴 때 들을 것')}\n\n#b1\n${T('단신 2')}\n\n#b2\n${T('단신 3(없으면 이 묶음을 지움)')}`,
  cover: coverBody,
  origin: `#o0\n${T('이 판이 기대는 정전 한 장. 무엇이 같고 무엇이 다른지 사실로')}\n\n#o1\n${T('둘째 문단')}`,
  night: `#n0\n${T('이 판과 어울리는 밤(상상 장면이면 밝힘)')}\n\n#n1\n${T('둘째 문단')}`,
  map: `#m0\n${T('피처링 지도·샘플 추적 설명(데이터 그래픽 쪽의 본문). 확인된 크레딧만')}`,
  serial: `#r0\n${T(`첫 줄로 지난 회를 잇는다(연재 '${M.serial.title}' ${sn}회${ser?.next?.title ? `, 지난 예고: ${ser.next.title}` : ''})`)}\n\n#r1\n${T('본문')}\n\n#r2\n※ 다음 회 예고: ${T('다음 회 제목과 한 줄')}`,
  front: `#f0\n${T('앞줄 소개 한 문단')}\n\n#f1\n${T('신인 1 (출처 2곳 이상)')}\n\n#f2\n${T('신인 2')}`,
  scene: `#c0\n${T('씬 리포트(공연·크루·지역)')}\n\n#c1\n${T('둘째 문단')}`,
  live: `#l0\n- ${T('날짜 · 장소 · 아티스트 (확인된 것만, 출처는 편집 노트에)')}`,
  desk: `#d0\n${T('이번 호를 만든 방법 한 문단: 출처 수, 지운 사실 수, 소리 묘사 수, 상상 장면 수')}\n\n#d1\n사진: ${T('사진마다 저작자 · 라이선스 · 출처(credits.json과 같게). 사진이 없으면 이유')}\n\n#d2 출처\n- ${T('제목 https://주소 (호 전체 10곳 이상, 커버 8곳 이상)')}`,
};
const titles = { cover: `${T('커버 제목')} — ${T('아티스트')}`, serial: `연재 '${M.serial.title}' ${sn}회 — ${T('부제')}` };
let articles = `<!--
${M.name} ${vol} 원고 (${dot} 발행). scripts/mag-new.mjs가 만든 뼈대. 'TODO:'를 모두 채우거나 지운다(mag-check가 잡음).
문법(fb-02와 같음): "@art <id> | <제목> | <필자>" 로 기사 시작. "#<묶음 id> <소제목>" 로 묶음 시작.
빈 줄로 문단. "> " 풀쿼트 · "- " 목록 · "※ " 덧붙임. 문단 id = <묶음>.<번호>(예: s2.1).
지면에서 {{p cover s2.1-2}} 로 가져오고 {{more cover s2.3 글자}} 로 이어 읽기 버튼.
사실마다 notes.md의 id가 있어야 한다. 노트에 없는 고유명사·숫자·날짜는 데스크에서 지운다.
-->

`;
for (const [a, t, by] of M.arts) articles += art(a, titles[a] || t, by, bodies[a] || `#${a[0]}0\n${T('본문')}`);

/* ── notes.md ── */
const notes = `# ${M.name} ${vol} — 취재 노트 · 설계도 · 데스크 기록

${dot} 발행. 원고 \`articles.md\`, 지면 \`pages.html\`, 결과 \`public/mag/issues/${id}/issue.html\`. 순서는 .claude/skills/mag-issue/SKILL.md.

## 편성
- 그 주 신보 후보(출처): TODO:
- 커버 = TODO: (이유 · 커버 출처 수)
- 뺀 후보와 이유: TODO:
- 연재 '${M.serial.title}' ${sn}회: ${ser?.next ? `지난 예고 "${ser.next.title}" — ${ser.next.note || ''}` : '첫 회'}

## 사진
| 파일 | 무엇 | 저작자 / 라이선스 | 출처 | 쪽 |
|---|---|---|---|---|
| TODO: | | | | |

## 취재 노트 (커버)
| id | 사실 | 출처 | conf |
|---|---|---|---|
| f1 | TODO: | | high/med |

## 설계도 (커버)
- thesis: TODO:
- because: ① ② ③ (사실 id)
- 가장 강한 반론과 답: TODO:
- 바이블 핵심 철학 줄마다 어디서 지키나: TODO:

## 데스크 기록
- 지운 사실: TODO:
- 고친 것: TODO:
`;

/* ── pages.html ── */
const fb = readFileSync(join(ROOT, 'docs/magazine/issues/fb-02/pages.html'), 'utf8');
let css = fb.slice(fb.indexOf('<style>') + 7, fb.indexOf('</style>'));
css = css.replace(/:root\{[\s\S]*?\n\}/, `:root{
  --paper:#f4efe6; --ink:#141414; --mute:#6d675e; --rule:rgba(20,20,20,.18);
  --cy:${M.accent}; --cy2:${M.accent2}; --red:#d23a26; --kraft:#c49a63; --kraft2:#a97d47; --night:#0f1724; --pink:#ef9fb4;
  --mono:'IBM Plex Mono',monospace; --serif:'Noto Serif KR',Georgia,serif; --sans:'Noto Sans KR',system-ui,sans-serif; --it:'Instrument Serif',Georgia,serif; --slab:'${M.font}',serif;
  --rd-bg:#f6f1e7; --rd-ink:#1b1a18; --rd-accent:${M.accent2}; --rd-rule:rgba(20,20,20,.14); --rd-on:#fff; --rd-hit:${M.accent}38;
}`);
css += `
/* ── 이 잡지 색으로 (mag-new.mjs가 붙임) ── */
.x2 .x-toc li{padding:.8cqw 0}
.x2 .x-toc li small{margin-top:.3cqw}
.x2 .x-how{background:color-mix(in srgb,var(--cy) 12%,#fff);color:var(--ink);padding:2.4cqw 3cqw}
/* ── 사진 (mag-new.mjs가 붙임) ── */
.x2 .x-ph{position:absolute;margin:0;overflow:hidden;background:#d9d2c4}
.x2 .x-ph img{display:block;width:100%;height:100%;object-fit:cover}
.x2 .x-ph figcaption,.x2 .x-cr{position:absolute;right:1.6cqw;bottom:1.2cqw;max-width:80%;font:400 1.9cqw/1.3 var(--mono);color:#fff;text-shadow:0 0 .6cqw rgba(0,0,0,.8);text-align:right}
.x2 .x-ph.full{inset:0}
.x2 .x-ph.top{left:0;right:0;top:0;height:64cqw}
.x2 .x-cvmast{position:absolute;left:6cqw;right:6cqw;top:6cqw;font:400 20cqw/.86 var(--slab);letter-spacing:-.04em;color:#fff;mix-blend-mode:normal;z-index:2;text-shadow:0 .4cqw 2cqw rgba(0,0,0,.25)}
.x2 .x-cvbot{position:absolute;left:6cqw;right:6cqw;bottom:7cqw;z-index:2;color:#fff;text-shadow:0 0 1.4cqw rgba(0,0,0,.6)}
.x2 .x-cvbot .x-h{font-size:9.6cqw}
.x2 .x-cvbot .x-kick{color:${M.accent}}
.x2 .x-cvshade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.35),transparent 30%,transparent 55%,rgba(0,0,0,.65))}
`;
const page = (body, attrs = '') => `<template class="pg"><div class="x2"${attrs}>\n${body}\n</div></template>\n`;
const rh = (b, s) => `  <div class="x-rh"><b>${b}</b><span>${s}</span></div>`;
const folio = (i, s) => `  <div class="x-folio"><span>${i}</span><span>${s}</span></div>`;
const artPage = (i, a, sec, kick, title, s, more = 'cover') => page(`${rh(kick, `${M.name} ${vol}`)}
  <div class="x-in">
    <div class="x-kick">${kick}</div>
    <h2 class="x-h2" style="margin-top:1.4cqw">${title}</h2>
    <div class="x-txt" style="margin-top:3cqw">{{p ${a} ${sec}.1-2}}</div>
    {{more ${a} ${sec}.1 계속 읽기}}
  </div>
${folio(i, s)}`, ` data-art="${a}" data-at="${sec}"`);

let pages = `<!--
${M.name} ${vol} 지면 (판형 2: 2:3, 쪽마다 <template class="pg">). scripts/mag-new.mjs가 만든 뼈대.
CSS는 fb-02 골격 + 이 잡지 색(--cy · --cy2)·제호 글꼴(--slab) + 사진(.x-ph). 클래스는 x- 접두어, .x2/.x2r 아래에만.
사진: <figure class="x-ph top"><img src="photo-이름.webp" alt="…"><figcaption>저작자 · 라이선스</figcaption></figure>
      (파일은 python3 scripts/mag-photos.py get … 가 public/mag/issues/${id}/ 에 넣는다. 경로는 issue.html 기준 상대 경로)
빌드: python3 scripts/mag-issue.py docs/magazine/issues/${id}  ·  검사: node scripts/mag-check.mjs ${id}
-->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${M.fontQ}&family=IBM+Plex+Mono:wght@400;600&family=Instrument+Serif:ital@0;1&family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;600;900&display=swap">
<style>${css}</style>
<!-- 0 표지: 사진 전면 -->
<template class="pg"><div class="x2 x-cover" data-art="cover" data-at="s0" style="background:#111">
  <figure class="x-ph full"><img src="photo-cover.webp" alt="TODO: 사진 설명"><figcaption>TODO: 저작자 · 라이선스</figcaption></figure>
  <div class="x-cvshade"></div>
  <div class="x-cvmast" aria-label="${M.name}">${M.name}</div>
  <div class="x-cvbot">
    <div class="x-kick">${M.dayKo.toUpperCase()} ${dot} · ${vol.toUpperCase()} · ${M.publisher} · 부록 LP 1장</div>
    <h1 class="x-h">TODO: 커버 문구</h1>
    <p class="x-dek" style="color:#f2efe9">TODO: 한 줄</p>
  </div>
</div></template>
<!-- 1 차례 -->
${page(`${rh('contents', `${M.name} ${vol}`)}
  <div class="x-in">
    <h2 class="x-h" style="font-size:8cqw;margin-top:0">차례 <span class="x-en">contents</span></h2>
    <ol class="x-toc">
${M.arts.map(([a, t]) => `      <li><b>TODO:</b><span>${t}<small>TODO: 부제</small></span></li>`).join('\n')}
      <li><b>TODO:</b><span>부록 LP<small>이 호에서 이름이 나온 노래</small></span></li>
    </ol>
    <div class="x-how"><b>읽는 법</b> 지면은 넘겨 보고, 긴 글은 쪽 아래의 <b>▶ 계속 읽기</b>를 누르세요. 큰 글씨 본문이 위로 올라옵니다.</div>
  </div>
${folio(1, dot)}`)}`;
let pi = 2;
const later = [];
for (const [a, t] of M.arts) {
  if (a === 'desk') continue;
  if (a === 'cover') {
    pages += `<!-- ${pi} 커버 여는 쪽: 사진 위 · 제목 아래 -->\n` + page(`  <figure class="x-ph top"><img src="photo-open.webp" alt="TODO: 사진 설명"><figcaption>TODO: 저작자 · 라이선스</figcaption></figure>
  <div class="x-in" style="top:70cqw">
    <div class="x-kick">${t}</div>
    <h2 class="x-h" style="font-size:9cqw;margin-top:1.4cqw">TODO: 커버 제목</h2>
    <p class="x-dek">TODO: 덱</p>
    <p class="x-by">글 ${M.writer}</p>
    {{more cover s0.1 처음부터 읽기}}
  </div>
${folio(pi, t)}`, ' data-art="cover" data-at="s0"');
    pi++;
    for (const s of ['s1', 's2', 's3', 's4', 's5']) { pages += artPage(pi, 'cover', s, t, `TODO: ${s} 소제목`, t); pi++; }
    pages += `<!-- ${pi} 데이터 그래픽(연표·지도·곡 배치). 개략도면 그렇다고 적는다 -->\n` + page(`${rh('graphic', t)}
  <div class="x-in">
    <div class="x-kick">TODO: 그래픽 이름</div>
    <div style="flex:1;border:.3cqw dashed var(--rule);margin-top:3cqw;display:grid;place-items:center;font:400 3cqw var(--mono);color:var(--mute)">TODO: SVG/CSS 그래픽</div>
    {{more cover s5.1 이어 읽기}}
  </div>
${folio(pi, t)}`, ' data-art="cover" data-at="s5"');
    pi++;
    for (const s of ['s6', 's7', 's8']) { pages += artPage(pi, 'cover', s, t, `TODO: ${s} 소제목`, t); pi++; }
    continue;
  }
  const first = (bodies[a] || '').match(/^#(\w+)/m)?.[1] || `${a[0]}0`;
  pages += artPage(pi, a, first, t, a === 'serial' ? `${M.serial.title} ${sn}회 — TODO: 부제` : `TODO: ${t} 제목`, t);
  pi++;
}
pages += `<!-- ${pi} 편집 노트 · 판권 · 사진 저작자 전체 -->\n` + page(`${rh('desk notes', '편집 노트')}
  <div class="x-in">
    <h2 class="x-h2">이번 호를 만든 방법</h2>
    <div class="x-nums">
      <div><b>TODO:</b><span>출처</span></div><div><b>TODO:</b><span>지운 사실</span></div><div><b>0</b><span>가사 인용</span></div>
      <div><b>TODO:</b><span>사진</span></div><div><b>TODO:</b><span>상상한 장면</span></div><div><b>0</b><span>점수</span></div>
    </div>
    <div class="x-txt" style="font-size:3cqw">{{p desk d1}}</div>
    {{more desk d2 출처 전체 보기}}
    <div class="x-colo"><b>${M.name}</b> ${vol} · ${dot} 발행 · ${M.publisher}<br>편집장 ${M.writer}<br>모든 사실은 공개된 기사·인터뷰·레이블 자료에서 확인했다</div>
  </div>
${folio(pi, '판권')}`, ' data-art="desk" data-at="d0"');
pi++;
pages += `<!-- ${pi} 부록 LP (single7 bigs 구조 그대로 — mag.js가 LP 그림으로 바꾼다) -->\n` + page(`${rh('supplement', '부록 LP')}
  <div class="x-in">
    <div style="font:400 10cqw/1 var(--slab);letter-spacing:-.03em">supplement</div>
    <p class="x-cap" style="margin:2cqw 0 0">이 호에서 이름이 나온 노래를 LP 한 장에 담았다. 테이프를 떼면 처음부터 재생되고, ${M.publisher} 크레이트에 꽂힌다.</p>
  </div>
  <div class="single7 bigs" data-i="0" role="button" tabindex="0" aria-label="부록 LP. 눌러서 테이프를 떼고 재생" style="left:13cqw;top:46cqw;--r:-3deg;--w:74cqw"><span class="sl"></span><span class="bg"></span><span class="tp" style="left:-8%;top:5%;width:40%;transform:rotate(-12deg)"></span><span class="tp" style="left:64%;top:74%;width:30%;transform:rotate(22deg)"></span><span class="c2">이 호의 노래, 한 장에<small>테이프를 떼면 처음부터 재생</small></span></div>
${folio(pi, `${M.name} ${vol}`)}`, ' style="background:#efe9dd"');
pi++;
pages += `<!-- ${pi} 라이너 노트 -->\n` + page(`${rh('liner notes', '부록 수록곡')}
  <div class="x-in">
    <h2 class="x-h2">A면 · B면</h2>
    <p class="x-cap" style="margin:1cqw 0 0">기사에 나온 순서대로. index.json tracks와 같은 순서.</p>
    <ol class="x-lpl">
      <li><b>A1 · TODO:쪽</b><i>TODO: 곡</i><br>TODO: 아티스트 [앨범]</li>
    </ol>
  </div>
${folio(pi, M.publisher)}`);

/* ── 쓰기 ── */
const files = { 'articles.md': articles, 'notes.md': notes, 'pages.html': pages };
if (DRY) { console.log(`(dry) ${id} ${vol} · 쪽 ${pi + 1}`); process.exit(0); }
mkdirSync(dir, { recursive: true });
mkdirSync(join(ROOT, 'public/mag/issues', id), { recursive: true });
for (const [f, s] of Object.entries(files)) writeFileSync(join(dir, f), s);

const entry = { id, dir: id, mag, name: M.name, vol, date: dot, fmt: 2, title: 'TODO: 제목 — 아티스트 [앨범]', publisher: M.publisher, color: M.color, singles: 0, crate: M.crate, tracks: [] };
writeFileSync(join(dir, 'index-entry.json'), JSON.stringify(entry, null, 1) + '\n');

console.log(`
만듦: docs/magazine/issues/${id}/ (articles.md · notes.md · pages.html ${pi + 1}쪽 · index-entry.json)
호: ${M.name} ${vol} · ${dot}(${M.dayKo}) · 연재 '${M.serial.title}' ${sn}회${ser?.next ? ` (예고: ${ser.next.title})` : ''}
먼저 읽을 것:
  docs/magazine/mags/${M.bible}.md (맨 위 '개편')
  docs/magazine/memory/${M.bible}.md
  ${prev ? `docs/magazine/issues/${prev.id}/ (같은 잡지 판형 2 지난 호)` : 'docs/magazine/issues/fb-02/ (본보기)'}
다음: 편성 → 사진(python3 -I scripts/mag-photos.py search "…") → 취재 노트 → 원고 → 빌드·검사
발행할 때 index-entry.json을 public/mag/issues/index.json 의 ${M.name} 지난 호 뒤에 넣고 이 파일은 지운다.`);
