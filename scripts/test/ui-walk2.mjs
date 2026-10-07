// Headless test for candles, strategy presets and the forum (with a simulated Supabase).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-shots4');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"https://fake.supabase.co","supabaseKey":"anon-key"};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8098);

const posts = [{ id: 1, ticker: 'AAPL', user_id: 'u-other', display_name: 'ValueHunter', body: 'Services margin is the story here.', created_at: new Date(Date.now() - 3600e3).toISOString() }];
let nextId = 2;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.route('https://raw.githubusercontent.com/**', (r) => r.abort());
await page.addInitScript(() => localStorage.setItem('converge.v1', JSON.stringify({ demoTier: 'premium' })));
await page.route('https://fake.supabase.co/**', async (route) => {
  const req = route.request(), u = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (u.pathname === '/auth/v1/token') return json(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u-me', email: body.email, user_metadata: { display_name: 'Zhivo' } } });
  if (u.pathname === '/auth/v1/signup') return json(200, { id: 'u-me' });
  if (u.pathname === '/rest/v1/profiles') return json(200, [{ tier: 'premium', premium_until: null }]);
  if (u.pathname === '/rest/v1/forum_posts' && req.method() === 'GET') return json(200, posts.filter((p) => p.ticker === 'AAPL'));
  if (u.pathname === '/rest/v1/forum_posts' && req.method() === 'POST') {
    if (/heck/i.test(body.body)) return json(400, { message: 'Post blocked: please keep the language civil.' }); // server-side block path
    const row = { id: nextId++, ticker: body.ticker, user_id: 'u-me', display_name: body.display_name, body: body.body, created_at: new Date().toISOString() };
    posts.unshift(row); return json(201, [row]);
  }
  if (u.pathname === '/rest/v1/forum_posts' && req.method() === 'DELETE') return route.fulfill({ status: 204, body: '' });
  return json(404, {});
});
await page.goto('http://localhost:8098/');
await page.waitForSelector('.nav');
let n = 0;
const shot = async (name) => { await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };

// profanity filter unit checks (client side)
const prof = await page.evaluate(() => ['Great quarter for Apple', 'this is sh1t', 'f u c k this', 'Scunthorpe assessment', 'fuuuck', 'class act', 'b!tch'].map((t) => t + ' => ' + window.__convergeTest.isProfane(t)));
console.log(prof.join('\n'));

await click('[data-act="tab"][data-tab="battle"]');
await page.waitForSelector('#candlebox');
await page.waitForTimeout(500);
await shot('candles-1D');
for (const iv of ['1m', '2m', '1h', '4h', '5h', '2D', '1W']) { await click(`[data-act="civ"][data-iv="${iv}"]`); await page.waitForTimeout(150); }
await shot('candles-1W');
await click('[data-act="civ"][data-iv="5m"]');
const box = await page.$('#cwrap'); const bb = await box.boundingBox();
await page.mouse.click(bb.x + bb.width * 0.5, bb.y + 60);
await shot('candles-5m-crosshair');
await page.mouse.move(bb.x + bb.width * 0.8, bb.y + 60); await page.mouse.down(); await page.mouse.move(bb.x + bb.width * 0.3, bb.y + 60, { steps: 6 }); await page.mouse.up();
await click('[data-act="czoom"][data-z="out"]');
await shot('candles-panned-zoomed');
// forum
await page.evaluate(() => { const f = document.getElementById('forumbox'); f.scrollIntoView(); });
await shot('forum-signed-out');
await click('[data-act="forum-auth"]');
await page.fill('#au-email', 'me@example.com'); await page.fill('#au-pass', 'secret123');
await shot('forum-signin-sheet');
await click('[data-act="forum-auth-go"]'); await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
await page.fill('#forum-text', 'what a sh1tty quarter');
await click('[data-act="forum-post"]');
await shot('forum-client-blocked');
await page.fill('#forum-text', 'heck no, valuation is stretched');
await click('[data-act="forum-post"]'); await page.waitForTimeout(300);
await shot('forum-server-blocked');
await page.fill('#forum-text', 'Holding through earnings. Services keep growing.');
await click('[data-act="forum-post"]'); await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
await shot('forum-posted');
// presets
await click('[data-act="tab"][data-tab="scan"]');
await page.waitForSelector('.tbl');
await click('[data-act="preset"][data-id="swing"]');
await shot('preset-swing');
await click('[data-act="preset"][data-id="swing"]');
await click('[data-act="preset-info"][data-id="value"]');
await shot('preset-value-info');
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close();
