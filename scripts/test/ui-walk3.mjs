// Headless test for the market-pulse banner and the free / premium tiers (simulated Supabase + pulse feed).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-shots5');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"https://fake.supabase.co","supabaseKey":"anon-key","premiumUrl":"","premiumPrice":""};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8099);

// mock pulse: a session that dips then rallies, ending now
function mockPulse(drift) {
  const now = Math.floor(Date.now() / 1000), n = 60;
  const series = (base, vol, dr) => { const o = { t: [], o: [], h: [], l: [], c: [], v: [] }; let p = base; for (let i = 0; i < n; i++) { const nx = p * (1 + dr / n + Math.sin(i / 6) * vol); o.t.push(now - (n - 1 - i) * 300); o.o.push(p); o.c.push(nx); o.h.push(Math.max(p, nx) * 1.0005); o.l.push(Math.min(p, nx) * 0.9995); o.v.push(1e6); p = nx; } o.prevClose = base; o.price = p; o.time = now; return o; };
  const sec = {}; ['XLK', 'XLF', 'XLV', 'XLY', 'XLP', 'XLE', 'XLI', 'XLU', 'XLB', 'XLRE', 'XLC'].forEach((s, i) => { const x = series(100, 0.0006, drift * (i % 3 ? 1 : -0.5)); sec[s] = { name: s, prevClose: 100, price: x.price, c: x.c }; });
  return { app: 'Converge', kind: 'pulse', generatedAt: new Date().toISOString(), source: 'Mock 5-minute bars', index: { SPY: series(580, 0.0008, drift), QQQ: series(500, 0.001, drift * 1.2), DIA: series(430, 0.0006, drift * 0.8), IWM: series(220, 0.001, drift * 0.5), '^VIX': series(16, 0.004, -drift * 6) }, sectors: sec };
}
let pulseDrift = 0.009, pulseHits = 0;
const users = { 'free.user@converge.example': { id: 'u-free', tier: 'free', name: 'FreeTrader' }, 'premium.user@converge.example': { id: 'u-prem', tier: 'premium', name: 'PremiumPro' } };
const tokens = {};
const posts = [{ id: 1, ticker: 'AAPL', user_id: 'u-other', display_name: 'ValueHunter', body: 'Services margin is the story here.', created_at: new Date(Date.now() - 3600e3).toISOString() }];
let nextId = 2;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.route('https://raw.githubusercontent.com/**', (r) => {
  if (r.request().url().includes('/pulse/pulse.json')) { pulseHits++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPulse(pulseDrift)) }); }
  return r.abort();
});
await page.route('https://fake.supabase.co/**', async (route) => {
  const req = route.request(), u = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const who = tokens[(req.headers().authorization || '').replace('Bearer ', '')];
  if (u.pathname === '/auth/v1/token') { const usr = users[body.email]; if (!usr) return json(400, { error_description: 'Invalid login credentials' }); const tok = 'tok-' + usr.id; tokens[tok] = usr; return json(200, { access_token: tok, refresh_token: 'ref', expires_in: 3600, user: { id: usr.id, email: body.email, user_metadata: { display_name: usr.name } } }); }
  if (u.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
  if (u.pathname === '/rest/v1/profiles') return json(200, who ? [{ tier: who.tier, premium_until: null }] : []);
  if (u.pathname === '/rest/v1/forum_posts' && req.method() === 'GET') return json(200, posts.filter((p) => p.ticker === 'AAPL'));
  if (u.pathname === '/rest/v1/forum_posts' && req.method() === 'POST') {
    if (!who || who.tier !== 'premium') return json(400, { message: 'Posting is a Premium feature.' });
    const row = { id: nextId++, ticker: body.ticker, user_id: who.id, display_name: body.display_name, body: body.body, created_at: new Date().toISOString() };
    posts.unshift(row); return json(201, [row]);
  }
  return json(404, {});
});
await page.clock.install();
await page.goto('http://localhost:8099/');
await page.waitForSelector('.nav');
await page.waitForSelector('#pulsebox .pulse-mood');
let n = 0;
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(200); };
const text = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim());
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) errs.push('FAIL ' + label); };

check('pulse banner is the first card on Command', await page.$eval('#main > *:first-child', (e) => e.id === 'pulsebox' || !!e.querySelector('#pulsebox')));
check('bullish mood on a rally: ' + await text('.pulse-mood'), /Bullish/.test(await text('.pulse-mood')));
await shot('pulse-bullish');
await click('[data-act="pulse-open"]');
await shot('pulse-details');
// 5-minute refresh: the market turns down
pulseDrift = -0.012; const before = pulseHits;
await page.clock.runFor(5 * 60 * 1000 + 1000); await page.waitForTimeout(400);
check('re-fetched after 5 minutes (' + before + ' -> ' + pulseHits + ')', pulseHits > before);
check('mood updated to bearish: ' + await text('.pulse-mood'), /Bearish/.test(await text('.pulse-mood')));
await shot('pulse-bearish-after-refresh');
pulseDrift = -0.0065; await page.clock.runFor(5 * 60 * 1000 + 1000); await page.waitForTimeout(400);
check('neutral (yellow) on a flat tape: ' + await text('.pulse-mood'), /Neutral/.test(await text('.pulse-mood')));
await click('[data-act="pulse-open"]');
await shot('pulse-neutral');

// signed out: scanner preset -> subscribe sheet
await click('[data-act="tab"][data-tab="scan"]');
await page.waitForSelector('.preset');
await shot('scanner-locked');
await click('[data-act="preset"][data-id="swing"]');
check('signed-out preset tap opens Premium sheet', !!(await page.$('.plan-cmp')));
await shot('subscribe-sheet-signed-out');
await click('[data-act="sheet-bg"] [data-act="forum-auth"]');
await page.fill('#au-email', 'free.user@converge.example'); await page.fill('#au-pass', 'test-password-1');
await click('[data-act="forum-auth-go"]'); await page.waitForTimeout(400);
// free user
await click('[data-act="preset"][data-id="swing"]');
check('free user: preset still locked', !!(await page.$('.plan-cmp')));
await shot('subscribe-sheet-free');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
await click('[data-act="tab"][data-tab="battle"]');
await page.waitForSelector('#forumbox'); await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
check('free user: no comment box, subscribe prompt shown', !(await page.$('#forum-text')) && !!(await page.$('#forumbox .upsell')));
await shot('forum-free-user');
await click('#forumbox .upsell');
check('free user: chat prompt opens Premium sheet', /Commenting in the stock discussions/.test(await text('.panel')));
await shot('subscribe-from-forum');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
// switch to premium
await click('[data-act="tab"][data-tab="command"]');
await click('[data-act="settings"]');
check('settings shows Free plan for the free user', /Plan: Free/.test(await text('#main')));
await shot('settings-free');
await click('[data-act="forum-signout"]');
await click('[data-act="back"]');
await click('[data-act="tab"][data-tab="battle"]');
await page.waitForSelector('#forumbox');
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
await shot('forum-signed-out');
await click('#forumbox [data-act="forum-auth"]');
await page.fill('#au-email', 'premium.user@converge.example'); await page.fill('#au-pass', 'test-password-2');
await click('[data-act="forum-auth-go"]'); await page.waitForTimeout(500);
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
check('premium user: comment box shown', !!(await page.$('#forum-text')));
await page.fill('#forum-text', 'Premium take: services growth carries the multiple.');
await click('[data-act="forum-post"]'); await page.waitForTimeout(400);
await page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
check('premium user: post published', posts[0].display_name === 'PremiumPro');
await shot('forum-premium-posted');
await click('[data-act="tab"][data-tab="scan"]');
await click('[data-act="preset"][data-id="swing"]');
check('premium user: preset switches on', await page.$eval('[data-act="preset"][data-id="swing"]', (e) => e.getAttribute('aria-pressed') === 'true'));
await shot('scanner-premium-swing');
await click('[data-act="tab"][data-tab="command"]');
await click('[data-act="settings"]');
check('settings shows plan: ' + (await text('#main')).match(/Plan: \w+/)?.[0], /Plan: Premium/.test(await text('#main')));
await shot('settings-premium');
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close();
process.exit(errs.length ? 1 : 0);
