// Headless walkthrough of every screen (local testing only).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = path.join(www, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8099);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|CORS/.test(m.text())) errs.push('console: ' + m.text()); });
await page.route('https://raw.githubusercontent.com/**', (r) => r.abort());
await page.goto('http://localhost:8099/');
await page.waitForSelector('.nav');
let n = 0;
const shot = async (name) => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png'), fullPage: false }); };
const click = async (sel, o) => { await page.click(sel, o); await page.waitForTimeout(120); };
const fill = async (sel, v) => { await page.fill(sel, v); };

await shot('command-empty');
// add a lot with thesis
await click('[data-act="add"]');
await click('[data-act="pick"][data-mode="draft"]');
await fill('#pickq', 'AAP');
await click('[data-act="picked"][data-t="AAPL"]');
await fill('#f-shares', '120');
await fill('#f-price', '150');
await fill('#f-date', '2026-03-14');
await shot('add-step1');
await click('[data-act="draft-next"]');
await shot('lot-saved-no-thesis');
await click('[data-act="thesis-lot"]');
await fill('#f-title', 'Services keep compounding faster than hardware');
await fill('#f-why', 'Installed base passes 2.3B devices');
await click('[data-act="pinsheet"][data-type="article"]');
await shot('pin-article-sheet');
await click('[data-act="pin-art"][data-i="0"]');
await click('[data-act="pinsheet"][data-type="excerpt"]');
await fill('#pin-txt', 'Services gross margin hit a record this quarter');
await fill('#pin-src', 'Q3 call, CFO');
await click('[data-act="pin-save"]');
await fill('#f-target', '240');
await click('[data-act="horizon"][data-h="12M"]');
await fill('#f-kill', 'Services growth below 10% two quarters running');
await shot('thesis-prompt');
await click('[data-act="draft-save"]');
await shot('command-with-lot');
await page.evaluate(() => document.getElementById('main').scrollTo(0, 9999));
await shot('command-bottom');
await click('[data-act="signal"]');
await shot('command-signal-on');
await click('[data-act="signal"]');
// feed
await click('[data-act="tab"][data-tab="feed"]');
await shot('feed');
await click('[data-act="toponly"]');
await shot('feed-top-only');
// source profile
await click('.acc');
await shot('source');
await click('[data-act="back"]');
// briefing
await click('[data-act="briefing"]');
await shot('briefing');
await click('[data-act="brief-add"]'); await page.waitForTimeout(250);
await click('[data-act="brief-skip"]'); await page.waitForTimeout(250);
await click('[data-act="brief-add"]'); await page.waitForTimeout(250);
await shot('briefing-curated');
await click('[data-act="back"]');
// battleground
await click('[data-act="tab"][data-tab="battle"]');
await shot('battle');
await click('[data-act="side"][data-side="bear"]');
await page.evaluate(() => document.getElementById('main').scrollTo(0, 500));
await shot('battle-bear-scrolled');
// vault
await click('[data-act="tab"][data-tab="scan"]');
await page.waitForSelector('.tbl');
await shot('scanner');
await page.selectOption('#scan-signal', 'gainers');
await click('[data-act="scan-group"][data-g="Technical"]');
await page.selectOption('#sf-rsi', { label: 'Not Overbought (<60)' });
await shot('scanner-filtered');
await click('[data-act="scan-view"][data-v="technical"]');
await click('[data-act="scan-reset"]');
await click('[data-act="scan-toggle"]');
await shot('scanner-technical');
await click('[data-act="scan-sort"][data-k="rsi"]');
await click('.tbl tbody tr');
await shot('scanner-row');
await click('[data-act="sheet-bg"]', { position: { x: 10, y: 10 } }).catch(() => {});
await page.mouse.click(10, 10);
await click('[data-act="tab"][data-tab="vault"]');
await shot('vault');
await click('[data-act="lot"]');
await shot('lot');
await click('[data-act="sell"]');
await click('[data-act="reason"][data-r="Price dropped"]');
await shot('sell-reflect');
await click('[data-act="reason"][data-r="Hit target"]');
await click('[data-act="sell-confirm"]');
await shot('lot-closed');
await click('[data-act="back"]');
await click('[data-act="vtab"][data-v="perf"]');
await shot('vault-perf');
// alert (inject one into data to exercise the screen)
await click('[data-act="tab"][data-tab="command"]'); if (await page.$('.alert')) { await click('.alert'); await shot('alert'); await click('[data-act="back"]'); }
await click('[data-act="tab"][data-tab="command"]');
await click('[data-act="settings"]');
await shot('settings');
await click('[data-act="back"]');
await click('[data-act="pick"][data-mode="watch"]');
await shot('watch-picker');

console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close();
