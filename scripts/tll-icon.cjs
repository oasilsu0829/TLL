// scripts/tll-icon.html → 아이콘. node scripts/tll-icon.cjs <안 A|B|C|D> [미리보기.png]
// 안을 주면 public/icon-192.png · icon-512.png · icon-maskable-512.png · favicon 을 그 안으로 뽑는다
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const pick = process.argv[2] || 'B', preview = process.argv[3];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2400, height: 700 } });
  await p.goto('file://' + path.join(__dirname, 'tll-icon.html'));
  await p.evaluate(() => document.fonts.ready);
  if (preview) await p.locator('.sheet').screenshot({ path: preview });
  // 아이콘은 모서리 없이(런처가 깎는다). 시트에서 꺼내 맨몸으로 찍는다
  await p.evaluate((id) => { const el = document.getElementById(id); el.style.borderRadius = '0'; el.style.boxShadow = 'none'; el.style.margin = '0'; document.body.innerHTML = ''; document.body.appendChild(el); }, pick);
  const el = p.locator('#' + pick);
  const out = path.join(__dirname, '..', 'public');
  for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192]]) {
    await p.setViewportSize({ width: 512, height: 512 });
    await el.evaluate((e, s) => { e.style.zoom = s / 512; }, size);
    await el.screenshot({ path: path.join(out, name) });
  }
  // maskable: 안전 영역(가운데 80%)에 들어가게 줄이고 바탕을 채운다
  await el.evaluate((e) => { e.style.zoom = 1; const bg = getComputedStyle(e).background; const w = document.createElement('div'); w.id = 'mk'; w.style.cssText = `width:512px;height:512px;display:grid;place-items:center;background:${bg}`; e.parentNode.insertBefore(w, e); w.appendChild(e); e.style.transform = 'scale(.8)'; });
  await p.locator('#mk').screenshot({ path: path.join(out, 'icon-maskable-512.png') });
  await b.close();
})();
