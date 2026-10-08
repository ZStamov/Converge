// Screenshot the Who owns section for a ticker on a phone (one-file page).
import { chromium } from 'playwright-core';
import path from 'node:path';
const file = path.resolve(process.argv[2] || 'dist/converge.html'), out = process.argv[3] || 'tmp-shot', t = process.argv[4] || 'NVDA';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route(/^https?:/, (r) => r.abort());
await p.goto('file://' + file); await p.waitForSelector('.nav');
await p.click('[data-act="tab"][data-tab="battle"]'); await p.waitForTimeout(200);
await p.click('[data-act="pick"][data-mode="battle"]'); await p.fill('#pickq', t); await p.waitForTimeout(200); await p.click(`.pickrow[data-t="${t}"]`);
await p.waitForSelector('#smartbox'); await p.waitForTimeout(400);
for (const k of ['c', 'f', 'i']) {
  const tabSel = await p.$(`#smartbox [data-act="own-tab"][data-k="${k}"]`); if (tabSel) await tabSel.click(); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#smartbox .own').scrollIntoView()); await p.waitForTimeout(100);
  await p.screenshot({ path: `${out}/smart-${k}.png` });
}
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
