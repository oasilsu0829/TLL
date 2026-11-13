#!/usr/bin/env node
// 발행 전 검사. 예약 편집 세션은 이 검사를 통과해야만 발행한다(사용자 결정 2026-11-13: 검수 없이 바로 발행).
//   node scripts/mag-check.mjs <호 id>            예: node scripts/mag-check.mjs fb-03
//   --shots <폴더>  쪽마다 스크린숏(기본 /tmp/mag-check/<id>)   --no-browser  브라우저 검사 건너뜀(발행 금지)
// 확인하는 것
//   구조: index.json 항목·판형 2·부록 곡·크레이트, issue.html 쪽 수·기사·이어 읽기 버튼이 가리키는 기사/문단, 처리 못 한 {{ }}
//   글: 바이블 금지어, 점수 표기(개편 뒤 점수 없음), 따옴표 속 영어 문장(가사 의심), 출처 수, 상상 장면 표시, '당신' 횟수(feedback)
//   연재: serials.json 회차가 실제 호·기사를 가리키는지
//   화면: 폰 390×844 · 태블릿 1180×820에서 모든 쪽의 글이 쪽 밖으로 넘치지 않는지, 기사마다 읽기 모드가 열리는지, 스크립트 오류
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, extname, resolve } from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id) { console.error('사용법: node scripts/mag-check.mjs <호 id>'); process.exit(2); }
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve('.');
const PUB = join(ROOT, 'public');
const errs = [], warns = [];
const E = (m) => errs.push(m), W = (m) => warns.push(m);

/* ── 구조 ── */
const index = JSON.parse(readFileSync(join(PUB, 'mag/issues/index.json'), 'utf8'));
const it = index.issues.find((x) => x.id === id);
if (!it) { console.error(`index.json에 ${id}가 없다`); process.exit(1); }
for (const k of ['dir', 'mag', 'name', 'vol', 'date', 'title', 'publisher', 'color', 'crate']) if (!it[k]) E(`index.json ${id}: ${k} 없음`);
if (it.fmt !== 2) E(`index.json ${id}: fmt 2가 아님(새 호는 판형 2)`);
if (!Array.isArray(it.tracks) || it.tracks.length < 3) E('부록 곡(tracks)이 3곡보다 적다');
if (it.tracks && it.singles !== it.tracks.length) W(`singles(${it.singles}) ≠ tracks 수(${it.tracks.length})`);
if (index.issues.filter((x) => x.id === id).length > 1) E('같은 id가 두 번 있다');
if (index.issues.some((x) => x.id !== id && x.mag === it.mag && x.vol === it.vol)) E(`${it.name} ${it.vol}가 이미 있다`);

const ihPath = join(PUB, 'mag/issues', it.dir, 'issue.html');
if (!existsSync(ihPath)) { console.error(`${ihPath} 없음`); process.exit(1); }
const ih = readFileSync(ihPath, 'utf8');
const pages = [...ih.matchAll(/<template class="pg">([\s\S]*?)<\/template>/g)].map((m) => m[1]);
const arts = Object.fromEntries([...ih.matchAll(/<template class="art" data-id="([^"]+)" data-title="([^"]*)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], { title: m[2], html: m[3] }]));
if (pages.length < 8) E(`쪽이 ${pages.length}쪽뿐(8쪽 이상)`);
if (pages.length > 40) W(`쪽이 ${pages.length}쪽(폰 메모리 주의)`);
if (!Object.keys(arts).length) E('읽기 모드 기사(<template class="art">)가 없다');
if (ih.includes('{{')) E('처리 못 한 {{ }}가 있다');
const todo = [ih, JSON.stringify(it)].join('').match(/TODO:[^<\n"]{0,40}/g);
if (todo) E(`뼈대(mag-new.mjs)의 TODO가 ${todo.length}곳 남음: ${todo.slice(0, 3).join(' / ')}`);
/* 사진: 지면이 부르는 파일이 있고, 크레딧이 있고, 한 장 400KB · 한 호 8장 이하 */
const imgs = [...new Set([...ih.matchAll(/<img[^>]+src="([^":]+\.(?:webp|jpg|png))"/g)].map((m) => m[1]))];
const credPath = join(ROOT, 'docs/magazine/issues', it.dir, 'credits.json');
const creds = existsSync(credPath) ? JSON.parse(readFileSync(credPath, 'utf8')) : [];
for (const f of imgs) {
  const fp = join(PUB, 'mag/issues', it.dir, f);
  if (!existsSync(fp)) { E(`사진 ${f} 파일 없음`); continue; }
  if (statSync(fp).size > 400 * 1024) W(`사진 ${f} ${Math.round(statSync(fp).size / 1024)}KB(400KB 이하)`);
  if (!creds.some((c) => c.file === f)) E(`사진 ${f} 크레딧 없음(credits.json — mag-photos.py/mag-photo.py로 넣을 것)`);
  else if (!ih.includes(creds.find((c) => c.file === f).credit.split(' / ')[0].slice(0, 20))) W(`사진 ${f} 저작자 이름이 지면에 안 보임`);
}
if (imgs.length > 8) E(`사진 ${imgs.length}장(한 호 8장 이하, 아이폰 메모리)`);
if (!imgs.length) W('사진 0장 — 사진을 못 구한 이유를 편집 노트에 적었는지 확인');
if (!/class="single7 bigs"/.test(pages.at(-1) || '') && !/class="single7 bigs"/.test(pages.at(-2) || '')) E('마지막 두 쪽 안에 부록 LP(single7 bigs)가 없다');
for (const [i, pg] of pages.entries()) {
  for (const m of pg.matchAll(/data-read="([^"]+)" data-at="([^"]+)"/g)) {
    const a = arts[m[1]];
    if (!a) E(`${i}쪽: 기사 ${m[1]} 없음`);
    else if (!a.html.includes(`data-p="${m[2]}"`)) E(`${i}쪽: ${m[1]}에 문단 ${m[2]} 없음`);
  }
  const da = pg.match(/data-art="([^"]+)"/);
  if (da && !arts[da[1]]) E(`${i}쪽: data-art ${da[1]} 기사 없음`);
}

/* ── 글 ── */
const BIBLE = { drop: 'drop', fb: 'feedback', cy: 'cypher', mo: '33' }[it.mag];
const bible = BIBLE && existsSync(join(ROOT, `docs/magazine/mags/${BIBLE}.md`)) ? readFileSync(join(ROOT, `docs/magazine/mags/${BIBLE}.md`), 'utf8') : '';
const banned = ((bible.match(/금지어:?\*{0,2}\s*([^\n]+)/) || [])[1] || '').split(/[,·]/).map((w) => w.replace(/\*|\(.*?\)/g, '').trim()).filter((w) => w && w.length < 12);
const srcDir = join(ROOT, 'docs/magazine/issues', it.dir);
const md = existsSync(join(srcDir, 'articles.md')) ? readFileSync(join(srcDir, 'articles.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '') : '';
if (!md) E(`원고 docs/magazine/issues/${it.dir}/articles.md 없음`);
const text = md || ih.replace(/<[^>]+>/g, ' ');
for (const w of banned) if (text.includes(w)) E(`금지어 '${w}'`);
const scoreRe = [/볼륨\s*\d+\s*\/\s*11/, /\d\.\d\s*점/, /★/, /\b\d{1,2}\s*\/\s*11\b/, /\d(\.\d)?\s*\/\s*10\b/];
for (const r of scoreRe) { const m = text.match(r); if (m) E(`점수 표기 '${m[0]}' (개편 뒤 점수 없음)`); }
const quotes = [...text.matchAll(/["“]([^"”\n]{12,240})["”]/g)].map((m) => m[1]).filter((q) => /[A-Za-z]/.test(q) && q.trim().split(/\s+/).length >= 3);
if (quotes.length > 2) E(`따옴표 속 영어 문장 ${quotes.length}개 — 가사나 긴 인용인지 확인(직접 인용은 아티스트 한 문장씩만): ${quotes.slice(0, 3).join(' / ')}`);
else for (const q of quotes) W(`직접 인용 확인: "${q}"`);
const urls = new Set((text.match(/https?:\/\/[^\s)>\]]+/g) || []).map((u) => u.replace(/[.,]$/, '')));
if (urls.size < 10) E(`출처 URL ${urls.size}곳(호 전체 10곳 이상)`);
if (/이건 내가 그려 본|상상/.test(text) === false && it.mag === 'fb') E('feedback인데 상상 장면 표시가 없다');
if (it.mag === 'fb') for (const m of md.matchAll(/@art (\w+)[^\n]*\n([\s\S]*?)(?=\n@art |$)/g)) { const n = (m[2].match(/당신/g) || []).length; if (n > 1) E(`${m[1]}: '당신' ${n}번(한 글에 한 번까지)`); }
if (md) {
  const cover = md.match(/@art cover[^\n]*\n([\s\S]*?)(?=\n@art |$)/);
  const len = cover ? cover[1].replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim().length : 0;
  if (!cover) W('커버 스토리(@art cover)가 없다');
  else if (len < 4500) W(`커버 스토리 ${len}자(목표 6천~1만, 출처가 모자라면 줄여도 됨)`);
}

/* ── 연재 ── */
const serials = JSON.parse(readFileSync(join(PUB, 'mag/serials.json'), 'utf8')).serials;
for (const s of serials) for (const e of s.episodes) {
  const iss = index.issues.find((x) => x.id === e.issue);
  if (!iss) { E(`연재 ${s.id} ${e.n}회: 호 ${e.issue} 없음`); continue; }
  if (e.issue === id && !arts[e.art]) E(`연재 ${s.id} ${e.n}회: 기사 ${e.art} 없음`);
}
for (const s of serials) { const ns = s.episodes.map((e) => e.n); if (ns.some((n, i) => n !== i + 1)) E(`연재 ${s.id} 회차가 1부터 이어지지 않음: ${ns}`); }

/* ── 화면 ── */
async function browser() {
  let pw;
  try { pw = createRequire(import.meta.url)('playwright'); } catch { E('playwright를 불러오지 못했다(브라우저 검사 실패 = 발행 금지)'); return; }
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const HARNESS = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#333"><script type="module">import * as M from '/mag/mag.js'; window.M = M; localStorage.setItem('mag.opened', JSON.stringify({'${id}':1})); await M.openIssue('${id}'); window.ready = true;</script>`;
  const srv = createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/__magcheck.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(HARNESS); return; }
    const f = join(PUB, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(PUB) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const shots = opt('--shots') || `/tmp/mag-check/${id}`; mkdirSync(shots, { recursive: true });
  const b = await pw.chromium.launch();
  try {
    for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 1180, height: 820 }]]) {
      const p = await b.newPage({ viewport: vp });
      p.on('pageerror', (e) => E(`${name}: 스크립트 오류 ${e.message}`));
      await p.goto(base + '/__magcheck.html');
      await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
      await p.waitForTimeout(1500); // 글꼴
      const n = await p.evaluate(() => document.getElementById('magRoot').shadowRoot.querySelectorAll('.leaf').length);
      const over = new Set();
      for (let i = 0; i < n; i++) {
        await p.waitForTimeout(950);
        const ov = await p.evaluate(() => {
          const sh = document.getElementById('magRoot').shadowRoot, out = [];
          for (const pg of sh.querySelectorAll('.leaf:not(.far) .x2')) {
            const f = pg.querySelector('.x-folio'), fr = pg.getBoundingClientRect(), lim = f ? f.getBoundingClientRect().top - 2 : fr.bottom;
            const no = (pg.querySelector('.x-folio span') || {}).textContent || '?';
            for (const el of pg.querySelectorAll('.x-in > *, .x-in p, .x-in li, .x-in h2, .x-in h3')) {
              const r = el.getBoundingClientRect();
              if (!r.height) continue;
              if (r.bottom > lim + 1) out.push(`${no}쪽 아래로 ${Math.round(r.bottom - lim)}px (${el.className || el.tagName})`);
              if (r.right > fr.right + 1) out.push(`${no}쪽 옆으로 ${Math.round(r.right - fr.right)}px (${el.className || el.tagName})`);
            }
          }
          return out;
        });
        ov.forEach((x) => over.add(x));
        await p.screenshot({ path: join(shots, `${name}-${String(i).padStart(2, '0')}.png`) });
        await p.keyboard.press('ArrowRight');
      }
      for (const x of over) E(`${name}: 글이 넘침 — ${x}`);
      for (const aid of Object.keys(arts)) {
        if (!pages.some((pg) => pg.includes(`data-read="${aid}"`))) W(`기사 ${aid}로 가는 이어 읽기 버튼이 지면에 없다(다음 기사로만 닿음)`);
        const ok = await p.evaluate(async ([id, aid]) => {
          const sh = document.getElementById('magRoot').shadowRoot;
          await window.M.openArticle(id, aid);
          await new Promise((r) => setTimeout(r, 400));
          const open = !sh.querySelector('#rd').hidden, ps = sh.querySelectorAll('#rdCol [data-p]').length;
          sh.querySelector('#rdClose').click(); await new Promise((r) => setTimeout(r, 450));
          return open && ps ? 'ok' : `open=${open} p=${ps}`;
        }, [id, aid]);
        if (ok !== 'ok') E(`${name}: 읽기 모드 ${aid} 안 열림 (${ok})`);
      }
      await p.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`스크린숏: ${shots}`);
}
if (!args.includes('--no-browser')) await browser(); else E('브라우저 검사를 건너뜀(--no-browser) — 발행 금지');

for (const w of new Set(warns)) console.log('경고 ', w);
for (const e of errs) console.log('오류 ', e);
console.log(errs.length ? `실패: 오류 ${errs.length}개 — 발행하지 말 것` : `통과: ${id} (${pages.length}쪽, 기사 ${Object.keys(arts).length}편, 출처 ${urls.size}곳, 경고 ${warns.length}개)`);
process.exit(errs.length ? 1 : 0);
