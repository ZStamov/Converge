// Scanner: tapping a stock collapses the filters (with Edit), and the stock pop-up opens its chart.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-scanner');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"","supabaseKey":""};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(8102);
const C = JSON.parse(fs.readFileSync(path.join(www, 'data', 'candles.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.route('https://raw.githubusercontent.com/**', (r) => { const u = r.request().url(); if (u.includes('/history/h/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(C.tickers.AAPL.d1) }); return r.abort(); });
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) errs.push('FAIL ' + l); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(200); };
let n = 0; const shot = async (nm) => { await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + nm + '.png') }); };
await page.goto('http://localhost:8102/'); await page.waitForSelector('.nav');
await click('[data-act="tab"][data-tab="scan"]'); await page.waitForSelector('.tbl');
await click('[data-act="preset"][data-id="mswing"]');
await click('[data-act="preset"][data-id="swing"]');
const onNow = await page.$$eval('[data-act="preset"][aria-pressed="true"]', (a) => a.map((e) => e.dataset.id));
check('only one strategy toggle on at a time: ' + onNow.join(','), onNow.length === 1 && onNow[0] === 'swing');
await click('[data-act="scan-toggle"]');
await page.selectOption('[data-scanf="sec"]', { index: 1 }).catch(() => {});
await page.waitForTimeout(200);
await shot('filters-open');
const tracked = JSON.parse(fs.readFileSync('config/universe.json', 'utf8')).tickers;
const rows = await page.$$eval('tr[data-act="scan-row"]', (a) => a.map((e) => e.dataset.t));
check('scanner shows results: ' + rows.slice(0, 8).join(','), rows.length > 0);
const other = rows.find((t) => !tracked.includes(t));
// tap a stock outside the tracked list
await click(`tr[data-act="scan-row"][data-t="${other}"]`);
check('tapping a stock hides the filter panel and strategy toggles', !(await page.$('.fgrid')) && !(await page.$('.preset')));
check('a summary with Edit replaces them: ' + await page.$eval('.scan-sum', (e) => e.innerText.replace(/\s+/g, ' ')), /Edit/.test(await page.$eval('.scan-sum', (e) => e.innerText)) && /Short-term swing/.test(await page.$eval('.scan-sum', (e) => e.innerText)));
await shot('stock-sheet');
await click('[data-act="open-chart"]');
await page.waitForSelector('#cwrap', { timeout: 8000 }).catch(() => {});
check(`"Open chart" takes you to ${other}'s chart (no sheet left open)`, !!(await page.$('#cwrap')) && !(await page.$('.sheet')) && (await page.$eval('.subhead .ttl', (e) => e.textContent)) === other);
await shot('stock-chart');
await click('[data-act="back"]');
check('Back returns to the scanner with filters still collapsed', !!(await page.$('.scan-sum')) && !(await page.$('.fgrid')));
// tracked stock -> Battleground
const mine = rows.find((t) => tracked.includes(t)) || 'AAPL';
if (rows.includes(mine)) {
  await click(`tr[data-act="scan-row"][data-t="${mine}"]`);
  await click('[data-act="open-chart"]');
  check(`tracked stock ${mine} opens in Battleground with the pop-up closed`, !(await page.$('.sheet')) && await page.$eval('[data-act="tab"][data-tab="battle"]', (e) => e.getAttribute('aria-current') === 'page') && await page.$eval(`.chip[data-t="${mine}"]`, (e) => e.getAttribute('aria-pressed') === 'true'));
  await shot('battleground');
  await click('[data-act="tab"][data-tab="scan"]');
}
await click('.scan-sum [data-act="scan-edit"]');
check('Edit brings the filters and toggles back', !!(await page.$('.fgrid')) && !!(await page.$('.preset')) && await page.$eval('[data-act="preset"][data-id="swing"]', (e) => e.getAttribute('aria-pressed') === 'true'));
await shot('edit-again');
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close(); process.exit(errs.length ? 1 : 0);
