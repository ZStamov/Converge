// Headless test: buy/sell signals on candles, the backtest card, full screen, pinch and wheel zoom, testing-mode unlock.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-shots6');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"","supabaseKey":""};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8100);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
// mock history branch: a small directory + 2 years of daily bars for PLTR (built from AAPL's shape)
const C = JSON.parse(fs.readFileSync(path.join(www, 'data', 'candles.json'), 'utf8'));
const base = C.tickers.AAPL.d1;
const pltr = { t: base.t, o: base.o.map((x) => +(x / 2.1).toFixed(3)), h: base.h.map((x) => +(x / 2.1).toFixed(3)), l: base.l.map((x) => +(x / 2.1).toFixed(3)), c: base.c.map((x) => +(x / 2.1).toFixed(3)), v: base.v };
const symbols = { app: 'Converge', kind: 'symbols', generatedAt: new Date().toISOString(), barsThrough: '2026-10-07', count: 4, rows: [['AAPL', 'Apple Inc.', 'NASDAQ', 1, 'Technology', 4e12, 336, 0.9], ['PLTR', 'Palantir Technologies Inc. Class A', 'NASDAQ', 1, 'Technology', 3e11, 160, 2.1], ['PLUG', 'Plug Power Inc.', 'NASDAQ', 0, 'Industrials', 2e9, 2.1, -1.5], ['PLD', 'Prologis, Inc.', 'NYSE', 1, 'Real Estate', 1e11, 120, 0.3]] };
await page.route('https://raw.githubusercontent.com/**', (r) => {
  const u = r.request().url();
  if (u.includes('/history/symbols.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(symbols) });
  if (u.includes('/history/h/PLTR.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pltr) });
  return r.abort();
});
await page.goto('http://localhost:8100/');
await page.waitForSelector('.nav');
let n = 0;
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(200); };
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) errs.push('FAIL ' + label); };
const cnt = (sel) => page.$$eval(sel, (a) => a.length);

await click('[data-act="tab"][data-tab="battle"]');
await page.waitForSelector('#cwrap');
for (const iv of ['1D', '5m', '1h', '1W', '1m']) {
  await click(`[data-act="civ"][data-iv="${iv}"]`);
  const m = await cnt('#cwrap .slab'); const bt = await page.$eval('#btbox', (e) => e.innerText.replace(/\s+/g, ' '));
  check(`${iv}: ${m} signal markers; backtest card: ${bt.slice(0, 110)}`, m > 0 && /Strategy return/.test(bt));
}
await click('[data-act="civ"][data-iv="1D"]');
await page.evaluate(() => document.getElementById('cwrap').scrollIntoView({ block: 'center' }));
await shot('candles-signals-1D');
// tap a candle that carries a signal
const labels = await page.$$eval('#cwrap .slab text', (a) => [...new Set(a.map((e) => e.textContent))]);
check('chart labels are words: ' + labels.join(', '), labels.includes('BUY') && labels.includes('SELL') && !(await page.$('#cwrap path')));
const ticks = await cnt('#cwrap .cax.tick');
check(ticks + ' price-scale ticks on the right', ticks >= 3 && await page.$eval('#cwrap .cax.tick', (e) => { const w = document.getElementById('cwrap').getBoundingClientRect(); return e.getBoundingClientRect().right >= w.right - 2; }));
check('backtest strip under the chart', /Backtest · 1D/.test(await page.$eval('.btstrip', (e) => e.innerText)));
const hitInfo = await page.evaluate(() => { const p = document.querySelector('#cwrap .slab rect'); const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: document.getElementById('cwrap').getBoundingClientRect().top + 40 }; });
await page.mouse.click(hitInfo.x, hitInfo.y);
await page.waitForTimeout(200);
check('tapping a marked candle names the rule: ' + (await page.$eval('#candlebox', (e) => (e.querySelector('.sigline') || {}).innerText || 'none')), !!(await page.$('#candlebox .sigline')));
await shot('candle-signal-readout');
await page.evaluate(() => document.getElementById('btbox').scrollIntoView());
await shot('backtest-card');
await click('#btbox [data-act="sig-info"][data-id="flag"]');
await page.evaluate(() => document.querySelector('#btbox .bttbl').scrollIntoView());
await shot('backtest-rules');
// full screen
await page.evaluate(() => document.getElementById('cwrap').scrollIntoView({ block: 'center' }));
await click('[data-act="cfull"]');
check('full-screen overlay open', !!(await page.$('.cfull #cwrap')));
check('full screen shows backtest results', /Strategy return/.test(await page.$eval('#btfull', (e) => e.innerText)));
const n0 = await page.$eval('#cwrap', (e) => +e.dataset.n);
await shot('fullscreen-portrait');
// pinch in (fingers apart) with synthetic touch pointers
async function pinch(from, to) {
  await page.evaluate(([from, to]) => {
    const box = document.getElementById('candlebox'), r = document.getElementById('cwrap').getBoundingClientRect(), cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    const ev = (type, id, x) => box.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: cy, bubbles: true, cancelable: true, isPrimary: id === 1 }));
    ev('pointerdown', 1, cx - from); ev('pointerdown', 2, cx + from);
    for (let k = 1; k <= 6; k++) { const d = from + (to - from) * k / 6; ev('pointermove', 1, cx - d); ev('pointermove', 2, cx + d); }
    ev('pointerup', 1, cx - to); ev('pointerup', 2, cx + to);
  }, [from, to]);
  await page.waitForTimeout(150);
}
await pinch(40, 140);
const n1 = await page.$eval('#cwrap', (e) => +e.dataset.n);
check(`pinch out zooms in: ${n0} -> ${n1} candles`, n1 < n0);
await shot('fullscreen-pinched-in');
await pinch(150, 30);
const n2 = await page.$eval('#cwrap', (e) => +e.dataset.n);
check(`pinch in zooms out: ${n1} -> ${n2} candles`, n2 > n1);
// wheel zoom in full screen
const r = await page.$eval('#cwrap', (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 60 }; });
await page.mouse.move(r.x, r.y); await page.mouse.wheel(0, -400); await page.waitForTimeout(200);
const n3 = await page.$eval('#cwrap', (e) => +e.dataset.n);
check(`wheel zooms in: ${n2} -> ${n3}`, n3 < n2);
await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400);
const lay = await page.evaluate(() => { const a = document.getElementById('btfull').getBoundingClientRect(), c = document.getElementById('cwrap').getBoundingClientRect(); return { bt: [a.left, a.right], ch: [c.left, c.right] }; });
check('landscape: backtest on the left, price chart on the right ' + JSON.stringify(lay), lay.bt[1] <= lay.ch[0] + 1);
await shot('fullscreen-landscape');
await page.evaluate(() => { document.getElementById('btfull').scrollTop = 400; });
await shot('fullscreen-landscape-bt-scrolled');
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
await click('[data-act="cfull-close"]');
check('full screen closes', !(await page.$('.cfull')));
// search any S&P 500 / Nasdaq stock
await click('[data-act="pick"][data-mode="battle"]');
await page.fill('#pickq', 'pl'); await page.waitForTimeout(300);
const found = await page.$$eval('[data-act="picked-ext"]', (a) => a.map((e) => e.dataset.t));
check('search "pl" finds directory stocks: ' + found.join(','), found.includes('PLTR') && found.includes('PLUG') && found.includes('PLD'));
await shot('search-all-stocks');
await click('[data-act="picked-ext"][data-t="PLTR"]');
await page.waitForSelector('#cwrap .slab', { timeout: 8000 });
check('PLTR quote page has chart, signals and backtest', /Palantir/.test(await page.$eval('#main', (e) => e.innerText)) && /Strategy return/.test(await page.$eval('#btbox', (e) => e.innerText)));
await shot('quote-pltr');
await click('[data-act="civ"][data-iv="5m"]');
check('web: intraday explains the apps have it', /Android and iOS/.test(await page.$eval('#candlebox', (e) => e.innerText)));
await click('[data-act="civ"][data-iv="1W"]');
check('PLTR weekly from daily history', (await cnt('#cwrap rect')) > 20);
await click('[data-act="civ"][data-iv="1D"]');
await click('[data-act="back"]');
// testing mode: presets unlocked without an account
await click('[data-act="tab"][data-tab="scan"]');
await page.waitForSelector('.preset');
await click('[data-act="preset"][data-id="swing"]');
check('testing mode: strategy toggle works without Premium', await page.$eval('[data-act="preset"][data-id="swing"]', (e) => e.getAttribute('aria-pressed') === 'true') && !(await page.$('.plan-cmp')));
await shot('scanner-unlocked');
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close();
process.exit(errs.length ? 1 : 0);
