// Cross-device parity: one account used on 5 devices (iPhone SE + iPhone Pro Max as the iOS app, Pixel as the Android app,
// iPad and a desktop browser as the website). A simulated Supabase keeps accounts, profiles and the synced user_state
// with the same row rules as supabase/schema.sql. Checks that lots, theses, watchlist and settings match everywhere,
// that changes flow both ways, that accounts stay isolated, and that every screen fits each screen size.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const www = path.resolve('www');
const out = path.resolve(process.argv[2] || 'tmp-parity');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = {"supabaseUrl":"https://fake.supabase.co","supabaseKey":"anon-key"};\n');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = path.join(www, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8101);

// ---------------- simulated Supabase
const USERS = {
  'premium.user@converge.example': { id: 'u-prem', pw: 'test-password-2', name: 'PremiumPro', tier: 'premium' },
  'free.user@converge.example': { id: 'u-free', pw: 'test-password-1', name: 'FreeTrader', tier: 'free' }
};
const byTok = {}, STATE = {}, stats = { pulls: 0, pushes: 0 };
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });
  const me = byTok[(req.headers().authorization || '').replace('Bearer ', '')];
  const userJson = (x) => ({ id: x.id, email: x.email, user_metadata: { display_name: x.name } });
  if (u.pathname === '/auth/v1/token') {
    const x = USERS[body.email]; if (!x || x.pw !== body.password) return json(400, { error_description: 'Invalid login credentials' });
    const tok = 'tok-' + x.id + '-' + Math.random().toString(36).slice(2); byTok[tok] = Object.assign(x, { email: body.email });
    return json(200, { access_token: tok, refresh_token: 'r', expires_in: 3600, user: userJson(x) });
  }
  if (u.pathname === '/auth/v1/user') {
    if (!me) return json(401, { msg: 'not signed in' });
    if (req.method() === 'PUT') { if (body.data && body.data.display_name) me.name = body.data.display_name; if (body.password) me.pw = body.password; }
    return json(200, userJson(me));
  }
  if (u.pathname === '/auth/v1/logout') return json(204);
  if (u.pathname === '/rest/v1/profiles') return json(200, me ? [{ tier: me.tier, premium_until: null }] : []);
  if (u.pathname === '/rest/v1/forum_posts') return json(200, []);
  if (u.pathname === '/rest/v1/user_state') {
    if (!me) return json(401, { message: 'JWT required' });
    if (req.method() === 'GET') { stats.pulls++; const want = u.searchParams.get('user_id').replace('eq.', ''); return json(200, want === me.id && STATE[me.id] ? [STATE[me.id]] : []); } // RLS: own row only
    if (req.method() === 'POST') { stats.pushes++; if (body.user_id !== me.id) return json(403, { message: 'new row violates row-level security policy' }); STATE[me.id] = { data: JSON.parse(JSON.stringify(body.data)), device: body.device, updated_at: body.updated_at }; return json(201); }
  }
  return json(404, {});
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const DEVICES = [
  { key: 'iphone-se', label: 'iPhone SE · iOS app', viewport: { width: 375, height: 667 }, dpr: 2, ua: IOS_UA, mobile: true, native: 'ios' },
  { key: 'iphone-pro-max', label: 'iPhone Pro Max · iOS app', viewport: { width: 430, height: 932 }, dpr: 3, ua: IOS_UA, mobile: true, native: 'ios' },
  { key: 'pixel-7', label: 'Pixel 7 · Android app', viewport: { width: 412, height: 915 }, dpr: 2.6, ua: ANDROID_UA, mobile: true, native: 'android' },
  { key: 'ipad', label: 'iPad · Safari (website)', viewport: { width: 820, height: 1180 }, dpr: 2, ua: IOS_UA.replace('iPhone', 'iPad'), mobile: true },
  { key: 'desktop', label: 'Desktop · Chrome (website)', viewport: { width: 1440, height: 900 }, dpr: 1, mobile: false }
];
const errs = [];
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) errs.push('FAIL ' + label); };
async function open(d) {
  const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.dpr, userAgent: d.ua, isMobile: d.mobile, hasTouch: d.mobile });
  if (d.native) await ctx.addInitScript((plat) => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => plat, Plugins: {} }; }, d.native);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(d.key + ' pageerror: ' + e.message));
  await page.route('https://raw.githubusercontent.com/**', (r) => r.abort());
  await page.route('https://query1.finance.yahoo.com/**', (r) => r.abort()); // native live data offline -> bundled snapshot
  await page.route('https://fake.supabase.co/**', supabase);
  await page.goto('http://localhost:8101/');
  await page.waitForSelector('.nav');
  return { d, ctx, page };
}
const click = async (page, sel) => { await page.click(sel); await page.waitForTimeout(180); };
async function signIn(page, email, pw) {
  await click(page, '[data-act="settings"]');
  await click(page, '#main [data-act="forum-auth"]');
  await page.fill('#au-email', email); await page.fill('#au-pass', pw);
  await click(page, '[data-act="forum-auth-go"]');
  await page.waitForFunction(() => document.querySelector('#syncstat') && /Synced/.test(document.querySelector('#syncstat').textContent), null, { timeout: 8000 });
  await click(page, '[data-act="back"]');
}
const syncNow = (page) => page.evaluate(() => window.__convergeSyncNow('manual'));
async function snapshot(page) {
  return page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('converge.v1') || '{}');
    const lots = (st.lots || []).map((l) => [l.t, l.shares, l.price, l.status, l.thesis ? l.thesis.title : null].join('|')).sort();
    return { lots, watch: (st.watchlist || []).slice().sort().join(','), signal: st.signal, range: st.range, civ: st.prefs && st.prefs.civ, csig: st.prefs && st.prefs.csig, user: st.auth && st.auth.user && st.auth.user.email };
  });
}
async function portfolioText(page) {
  await click(page, '[data-act="tab"][data-tab="command"]');
  return page.evaluate(() => { const b = document.querySelector('.big'); return b ? b.textContent : 'no portfolio'; });
}
async function fit(dev, name) {
  const r = await dev.page.evaluate(() => {
    const W = window.innerWidth, doc = document.scrollingElement.scrollWidth, main = document.getElementById('main');
    const over = [];
    document.querySelectorAll('#main *').forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && (b.right > W + 1 || b.left < -1) && !e.closest('.wl, .tick-row, .civ, .tbl-wrap, .tblwrap, .chips, .hscroll, .ranges, .scroll, svg')) over.push(e.className || e.tagName); });
    const nav = document.querySelector('.nav'), nb = nav && nav.getBoundingClientRect();
    return { W, doc, mainOver: main ? main.scrollWidth - main.clientWidth : 0, over: [...new Set(over)].slice(0, 5), nav: nav ? nav.querySelectorAll('button').length : 0, navVisible: !!nb && nb.bottom <= window.innerHeight + 1 && nb.top >= 0 };
  });
  check(`${dev.d.key} ${name}: fits ${r.W}px (page ${r.doc}px, main overflow ${r.mainOver}px${r.over.length ? ', overflowing: ' + r.over.join(' / ') : ''}), nav ${r.nav} tabs ${r.navVisible ? 'visible' : 'HIDDEN'}`, r.doc <= r.W + 1 && r.mainOver <= 1 && !r.over.length && (name === 'settings' || (r.nav === 5 && r.navVisible)));
  await dev.page.screenshot({ path: path.join(out, `${dev.d.key}-${name}.png`) });
}

// ---------------- 1. phone (iOS app): sign in, add a lot with a thesis, watch a ticker, change settings
const A = await open(DEVICES[0]);
await signIn(A.page, 'premium.user@converge.example', 'test-password-2');
await click(A.page, '[data-act="tab"][data-tab="command"]');
await click(A.page, '[data-act="add"]');
await click(A.page, '[data-act="pick"][data-mode="draft"]');
await click(A.page, '[data-act="picked"][data-t="NVDA"]');
await A.page.fill('#f-shares', '12'); await A.page.fill('#f-price', '180.5');
await click(A.page, '[data-act="draft-next"]');
await A.page.waitForTimeout(300);
await A.page.evaluate(() => { const l = JSON.parse(localStorage.getItem('converge.v1')).lots; return l.length; });
// lot detail -> add a thesis on the screen where it lives
await click(A.page, '[data-act="tab"][data-tab="vault"]');
await A.page.click('#main [data-act="lot"]').catch(() => {});
await A.page.waitForTimeout(200);
const hasThesisBtn = await A.page.$('[data-act="thesis-lot"]');
if (hasThesisBtn) { await hasThesisBtn.click(); await A.page.waitForTimeout(200); if (await A.page.$('#f-title')) { await A.page.fill('#f-title', 'AI data-center demand keeps compounding'); await A.page.fill('#f-target', '240'); await click(A.page, '[data-act="draft-save"]'); } }
await click(A.page, '[data-act="tab"][data-tab="command"]');
await click(A.page, '[data-act="signal"]');
await click(A.page, '[data-act="settings"]');
await A.page.selectOption('[data-pref="range"]', '1Y'); await A.page.selectOption('[data-pref="civ"]', '1W');
await click(A.page, '[data-act="back"]');
await A.page.waitForTimeout(1500); await syncNow(A.page);
const sA = await snapshot(A.page);
console.log('iPhone SE state:', JSON.stringify(sA));
check('cloud copy written from the iPhone', !!STATE['u-prem'] && STATE['u-prem'].data.lots.length === sA.lots.length && sA.lots.length >= 1);

// ---------------- 2. every other device signs in with the same credentials and sees the same thing
const devs = [A];
for (const d of DEVICES.slice(1)) {
  const X = await open(d); devs.push(X);
  await signIn(X.page, 'premium.user@converge.example', 'test-password-2');
  const sX = await snapshot(X.page);
  check(`${d.label}: same lots (${sX.lots.join('; ')})`, JSON.stringify(sX.lots) === JSON.stringify(sA.lots));
  check(`${d.label}: same watchlist, Signal Mode ${sX.signal}, range ${sX.range}, default interval ${sX.civ}`, sX.watch === sA.watch && sX.signal === sA.signal && sX.range === sA.range && sX.civ === sA.civ);
}
const vals = [];
for (const X of devs) vals.push(await portfolioText(X.page));
check('portfolio value identical on all 5 devices: ' + vals.join(' | '), vals.every((v) => v === vals[0]) && /\$/.test(vals[0]));

// ---------------- 3. changes flow back: Android adds a lot and edits the watchlist, desktop deletes nothing yet
const P = devs[2].page;
await click(P, '[data-act="tab"][data-tab="vault"]'); await click(P, '.top [data-act="add"]'); await click(P, '[data-act="pick"][data-mode="draft"]'); await click(P, '[data-act="picked"][data-t="AAPL"]');
await P.fill('#f-shares', '3'); await P.fill('#f-price', '300'); await click(P, '[data-act="draft-next"]');
await click(P, '[data-act="tab"][data-tab="command"]');
await click(P, '[data-act="pick"][data-mode="watch"]'); await click(P, '[data-act="picked"][data-t="TSLA"]'); await P.keyboard.press('Escape');
await P.waitForTimeout(1500); await syncNow(P);
for (const X of devs) await syncNow(X.page);
const after = await Promise.all(devs.map((X) => snapshot(X.page)));
check('Android edits reach every device: ' + after.map((x) => x.lots.length + ' lots/' + x.watch).join(' · '), after.every((x) => JSON.stringify(x.lots) === JSON.stringify(after[2].lots) && x.watch === after[2].watch && x.lots.length === sA.lots.length + 1));
// iPad deletes the AAPL lot; iPhone Pro Max changes the chart-signal preference at the same time
const I = devs[3].page;
await click(I, '[data-act="tab"][data-tab="vault"]');
const aaplLot = await I.evaluate(() => JSON.parse(localStorage.getItem('converge.v1')).lots.find((l) => l.t === 'AAPL').id);
await I.evaluate((id) => { const b = document.querySelector(`[data-act="lot"][data-id="${id}"]`); if (b) b.click(); }, aaplLot); await I.waitForTimeout(200);
if (await I.$('[data-act="del-lot"]')) { await click(I, '[data-act="del-lot"]'); await click(I, '[data-act="del-lot"]'); }
await click(devs[1].page, '[data-act="settings"]'); await click(devs[1].page, '[data-act="csig"]'); await click(devs[1].page, '[data-act="back"]');
await I.waitForTimeout(1500);
for (const X of devs) await syncNow(X.page);
for (const X of devs) await syncNow(X.page);
const fin = await Promise.all(devs.map((X) => snapshot(X.page)));
check('iPad delete + Pro Max setting merge everywhere: ' + fin.map((x) => x.lots.length + ' lots, signals ' + (x.csig === false ? 'off' : 'on')).join(' · '), fin.every((x) => JSON.stringify(x.lots) === JSON.stringify(fin[0].lots) && !x.lots.some((l) => l.startsWith('AAPL|')) && x.csig === false));

// ---------------- 4. account settings: display name changed on desktop shows on the phone
const Dk = devs[4].page;
await click(Dk, '[data-act="settings"]');
await Dk.fill('#ac-name', 'Zhivo Trades'); await click(Dk, '[data-act="acct-name"]');
check('desktop: name saved message', /Display name saved/.test(await Dk.$eval('#main', (e) => e.innerText)));
await click(A.page, '[data-act="settings"]'); await A.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await A.page.waitForTimeout(600);
check('phone shows the new display name after refocus', /Zhivo Trades/.test(await A.page.$eval('#main', (e) => e.innerText)));
await Dk.fill('#ac-pw1', 'short'); await Dk.fill('#ac-pw2', 'short'); await click(Dk, '[data-act="acct-pass"]');
check('password rule enforced', /at least 8/.test(await Dk.$eval('#main', (e) => e.innerText)));
await Dk.fill('#ac-pw1', 'new-password-123'); await Dk.fill('#ac-pw2', 'new-password-123'); await click(Dk, '[data-act="acct-pass"]');
check('password updated', /Password updated/.test(await Dk.$eval('#main', (e) => e.innerText)) && USERS['premium.user@converge.example'].pw === 'new-password-123');
USERS['premium.user@converge.example'].pw = 'test-password-2';
await click(Dk, '[data-act="back"]'); await click(A.page, '[data-act="back"]');

// ---------------- 5. isolation: the free account on the desktop sees none of it
const F = await open(DEVICES[4]);
await signIn(F.page, 'free.user@converge.example', 'test-password-1');
const sF = await snapshot(F.page);
check('another account sees only its own data: ' + (sF.lots.length ? sF.lots.join(';') : 'no lots'), sF.lots.length === 0 && sF.user === 'free.user@converge.example');
await F.ctx.close();

// ---------------- 6. layout parity per screen size
for (const X of devs) {
  await click(X.page, '[data-act="tab"][data-tab="command"]'); await fit(X, 'command');
  await click(X.page, '[data-act="tab"][data-tab="battle"]'); await X.page.waitForSelector('#cwrap', { timeout: 8000 }).catch(() => {}); await fit(X, 'battleground');
  const cw = await X.page.evaluate(() => { const c = document.getElementById('cwrap'); return c ? { w: c.clientWidth, vb: +c.dataset.w } : null; });
  check(`${X.d.key}: chart drawn at its real width (${cw && cw.w}px vs ${cw && cw.vb})`, cw && Math.abs(cw.w - cw.vb) <= 8);
  await click(X.page, '[data-act="tab"][data-tab="scan"]'); await fit(X, 'scanner');
  await click(X.page, '[data-act="tab"][data-tab="vault"]'); await fit(X, 'vault');
  await click(X.page, '[data-act="tab"][data-tab="feed"]'); await fit(X, 'feed');
  await click(X.page, '[data-act="tab"][data-tab="command"]'); await click(X.page, '[data-act="settings"]'); await fit(X, 'settings'); await click(X.page, '[data-act="back"]');
}
console.log(`sync traffic: ${stats.pulls} pulls, ${stats.pushes} pushes`);
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); srv.close();
process.exit(errs.length ? 1 : 0);
