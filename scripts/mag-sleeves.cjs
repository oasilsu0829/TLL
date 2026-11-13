const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[2];
  for (const m of ['drop', 'fb', 'cy', 'mo']) for (const part of ['cover', 'label']) {
    const sz = part === 'cover' ? 1000 : 600;
    const p = await (await b.newContext({ viewport: { width: sz, height: sz } })).newPage();
    await p.goto(`file://${__dirname}/mag-sleeves.html?m=${m}&part=${part}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${m}${part === 'label' ? '-l' : ''}.png`, omitBackground: part === 'label' });
    await p.close();
  }
  await b.close();
})();
