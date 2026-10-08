// Minute quotes, any US stock in the watchlist and lots, and BUY/SELL signal alerts (simulated feeds).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-live');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"","supabaseKey":""};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(8103);
const C = JSON.parse(fs.readFileSync(path.join(www, 'data', 'candles.json'), 'utf8'));
const scale = (s, f) => ({ t: s.t, o: s.o.map((x) => +(x * f).toFixed(3)), h: s.h.map((x) => +(x * f).toFixed(3)), l: s.l.map((x) => +(x * f).toFixed(3)), c: s.c.map((x) => +(x * f).toFixed(3)), v: s.v });
const symbols = { app: 'Converge', kind: 'symbols', generatedAt: new Date().toISOString(), barsThrough: '2026-10-07', count: 3, rows: [['SOFI', 'SoFi Technologies Inc.', 'NASDAQ', 0, 'Finance', 2e10, 15.5, 1.2], ['PLTR', 'Palantir Technologies', 'NASDAQ', 1, 'Information Technology', 4.6e11, 190, 1.0], ['F', 'Ford Motor Company', 'NYSE', 1, 'Consumer Discretionary', 4e10, 11.2, -0.4]] };
let quotes = { AAPL: [340.0, 1.0], SOFI: [16.0, 3.2], PLTR: [200.0, 3.0], F: [11.5, 2.0] }, served = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { window.__notes = []; window.Notification = function (t, o) { window.__notes.push(t + ' | ' + (o && o.body)); }; window.Notification.permission = 'granted'; window.Notification.requestPermission = () => Promise.resolve('granted'); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.route('https://raw.githubusercontent.com/**', (r) => {
  const u = r.request().url();
  if (u.includes('/quotes/q/') || u.includes('/quotes/h/')) { served++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ app: 'Converge', kind: 'quotes', at: new Date().toISOString(), minute: u.match(/(\d{12})\.json/)[1], q: quotes }) }); }
  if (u.includes('/history/symbols.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(symbols) });
  const m = u.match(/\/history\/h\/([A-Z.]+)\.json/); if (m) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scale(C.tickers.AAPL.d1, m[1] === 'SOFI' ? 0.046 : m[1] === 'F' ? 0.033 : 0.58)) });
  return r.abort();
});
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) errs.push('FAIL ' + l); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(200); };
await page.clock.install();
await page.goto('http://localhost:8103/'); await page.waitForSelector('.nav'); await page.waitForTimeout(600);
check('minute quotes loaded: ' + served + ' fetch(es)', served > 0);
const aapl = await page.evaluate(() => window.__convergeTest.state().watchlist && document.querySelector('.wlc[data-t="AAPL"]')?.innerText.replace(/\s+/g, ' '));
check('tracked ticker shows the live quote: ' + aapl, /1\.0%/.test(aapl || ''));
// any stock into the watchlist
await click('[data-act="pick"][data-mode="watch"]');
await page.fill('#pickq', 'sofi'); await page.waitForTimeout(300);
await click('.pickrow[data-act="picked"][data-t="SOFI"]');
check('SOFI added to the watchlist from search', await page.evaluate(() => window.__convergeTest.state().watchlist.includes('SOFI')));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const chip = await page.$eval('.wlc[data-t="SOFI"]', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => 'missing');
check('SOFI chip on Command with its live change: ' + chip, /3\.2%/.test(chip));
await page.screenshot({ path: path.join(out, '01-watchlist.png') });
// any stock as a lot
await click('[data-act="add"]');
await click('[data-act="pick"][data-mode="draft"]');
await page.fill('#pickq', 'pltr'); await page.waitForTimeout(300);
await click('.pickrow[data-act="picked"][data-t="PLTR"]');
check('Add lot prefills PLTR’s live price: ' + await page.$eval('#f-price', (e) => e.value), (await page.$eval('#f-price', (e) => e.value)) === '200');
await page.fill('#f-shares', '10'); await page.fill('#f-price', '180'); await click('[data-act="draft-next"]');
await page.waitForTimeout(400);
await click('[data-act="tab"][data-tab="command"]');
const v1 = await page.$eval('.big', (e) => e.innerText);
check('portfolio values the PLTR lot at the live price: ' + v1, v1 === '$2,000.00');
// prices move -> one minute later the app shows it
quotes = { ...quotes, PLTR: [210.0, 8.1], SOFI: [16.4, 5.8] };
await page.clock.runFor(61000); await page.waitForTimeout(600);
const v2 = await page.$eval('.big', (e) => e.innerText);
check('a minute later the portfolio updates: ' + v1 + ' → ' + v2, v2 === '$2,100.00');
await page.screenshot({ path: path.join(out, '02-portfolio-live.png') });
// signal alerts
await click('.wlc[data-t="AAPL"]'); await click('[data-act="tab"][data-tab="battle"]'); await page.waitForSelector('#cwrap');
await click('[data-act="alert-open"]');
check('alert sheet opens for the chart: ' + (await page.$eval('.panel h2', (e) => e.innerText)), /Signal alert · AAPL · 1D/.test(await page.$eval('.panel h2', (e) => e.innerText)));
await page.screenshot({ path: path.join(out, '03-alert-sheet.png') });
await click('[data-act="alert-side"][data-v="buy"]');
await click('[data-act="alert-save"]'); await page.waitForTimeout(300);
const al = await page.evaluate(() => window.__convergeTest.state().sigAlerts);
check('alert saved (BUY only), starting from the current signal: ' + JSON.stringify(al.map((a) => [a.t, a.iv, a.side, !!a.last])), al.length === 1 && al[0].side === 'buy' && al[0].last);
await page.evaluate(() => window.__convergeTest.checkSignalAlerts()); await page.waitForTimeout(200);
check('no notification for signals that already existed', (await page.evaluate(() => window.__notes.length)) === 0);
// pretend the alert was set before the latest BUY -> the check fires once
await page.evaluate(() => { const a = window.__convergeTest.state().sigAlerts[0]; a.last = a.last - 30 * 86400; window.__convergeTest.checkSignalAlerts(); });
await page.waitForTimeout(300);
const notes = await page.evaluate(() => window.__notes);
check('new BUY signal notifies: ' + notes[0], notes.length === 1 && /AAPL · BUY signal \(1D\)/.test(notes[0]));
await page.evaluate(() => window.__convergeTest.checkSignalAlerts());
check('the same signal does not notify twice', (await page.evaluate(() => window.__notes.length)) === 1);
await click('[data-act="tab"][data-tab="command"]');
check('Command lists the alert and the signal it sent', /Signal alerts/i.test(await page.$eval('#main', (e) => e.innerText)) && /BUY/.test(await page.$eval('#main', (e) => e.innerText)));
await page.screenshot({ path: path.join(out, '04-command-alerts.png') });
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close(); process.exit(errs.length ? 1 : 0);
