// The one-file Converge page on claude.ai syncs through the viewer's private per-user record (db + user capabilities).
// Simulates that platform store, a desktop browser that already holds lots from before sync existed, a phone that
// opens the page fresh, live updates both ways, and Copy my data -> Import data into a copy with no sync at all.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] || 'dist/converge.html');
const out = path.resolve(process.argv[3] || 'tmp-pagesync');
fs.mkdirSync(out, { recursive: true });
const STORE = new Map(); let writes = 0;
const errs = [];
const check = (label, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) errs.push('FAIL ' + label); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function device(name, viewport, { claude = true, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
  await ctx.exposeBinding('__dbGet', (_, p) => STORE.has(p) ? JSON.parse(STORE.get(p)) : null);
  await ctx.exposeBinding('__dbSet', (_, p, v) => { STORE.set(p, JSON.stringify(v)); writes++; return true; });
  if (seed) await ctx.addInitScript((s) => { if (!localStorage.getItem('converge.v1')) localStorage.setItem('converge.v1', s); }, JSON.stringify(seed));
  await ctx.addInitScript((enabled) => {
    if (!enabled) { window.claude = { use: () => Promise.resolve(null) }; return; }
    const ref = (p) => ({
      id: p.split('/').pop(), path: p,
      get: async () => { const d = await window.__dbGet(p); return { id: p, exists: !!d, data: () => d || undefined, metadata: { fromCache: false, hasPendingWrites: false } }; },
      set: async (v) => { await window.__dbSet(p, v); },
      onSnapshot: (fn) => { let last = null; const t = setInterval(async () => { const d = await window.__dbGet(p); const k = JSON.stringify(d); if (k !== last) { last = k; fn({ id: p, exists: !!d, data: () => d || undefined, metadata: { fromCache: false, hasPendingWrites: false } }); } }, 400); return () => clearInterval(t); }
    });
    const db = { doc: ref };
    const user = { id: async () => 'u_owner_1', me: async () => ({ id: 'u_owner_1', name: '', email: null, isOwner: true, canEdit: true }), isOwner: async () => true };
    window.claude = { use: (n) => Promise.resolve(n === 'db' ? db : n === 'user' ? user : null) };
  }, claude);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(name + ' pageerror: ' + e.message));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForSelector('.nav');
  return { name, ctx, page };
}
const lots = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('converge.v1') || '{}').lots || []).map((l) => `${l.t}|${l.shares}|${l.price}`).sort());
const waitLots = async (page, n, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await lots(page)).length === n) return true; await page.waitForTimeout(250); } return false; };

// 1. the desktop browser where holdings were entered before sync existed (old format: no sync stamps)
const oldState = { watchlist: ['AAPL', 'NVDA', 'MSFT', 'AMZN', 'TSLA'], lots: [{ id: 'old1', t: 'MSFT', shares: 20, price: 410.25, date: '2026-09-02', status: 'open', thesis: { title: 'Azure keeps taking share', pins: [], target: 520 } }, { id: 'old2', t: 'AMZN', shares: 15, price: 182.4, date: '2026-09-15', status: 'open' }], watchTheses: {}, signal: false, range: '3M' };
const Dk = await device('desktop', { width: 1366, height: 860 }, { seed: oldState });
await Dk.page.waitForTimeout(1500);
const doc = STORE.get('data/users/u_owner_1/state');
check('desktop uploaded its existing holdings on first open: ' + (doc ? JSON.parse(JSON.parse(doc).json).lots.map((l) => l.t).join(', ') : 'nothing'), !!doc && JSON.parse(JSON.parse(doc).json).lots.length === 2);

// 2. phone opens the same page with the same Claude login
const Ph = await device('phone', { width: 390, height: 844 });
check('phone shows the desktop holdings: ' + (await lots(Ph.page)).join(' ; '), await waitLots(Ph.page, 2));
const wl = await Ph.page.evaluate(() => JSON.parse(localStorage.getItem('converge.v1')).watchlist.join(','));
check('phone has the desktop watchlist and range: ' + wl, wl.includes('TSLA') && await Ph.page.evaluate(() => JSON.parse(localStorage.getItem('converge.v1')).range) === '3M');
await Ph.page.click('[data-act="tab"][data-tab="vault"]'); await Ph.page.waitForTimeout(250);
await Ph.page.screenshot({ path: path.join(out, 'phone-vault.png') });
check('phone Vault lists MSFT and AMZN with the thesis', await Ph.page.$eval('#main', (e) => /MSFT/.test(e.innerText) && /AMZN/.test(e.innerText) && /Azure keeps taking share/.test(e.innerText)));

// 3. phone adds a lot -> desktop picks it up live
await Ph.page.click('.top [data-act="add"]'); await Ph.page.waitForTimeout(200);
await Ph.page.click('[data-act="pick"][data-mode="draft"]'); await Ph.page.waitForTimeout(150);
await Ph.page.click('[data-act="picked"][data-t="NVDA"]'); await Ph.page.waitForTimeout(150);
await Ph.page.fill('#f-shares', '8'); await Ph.page.fill('#f-price', '175'); await Ph.page.click('[data-act="draft-next"]');
check('desktop receives the lot added on the phone', await waitLots(Dk.page, 3, 8000));
// desktop deletes AMZN -> phone drops it
await Dk.page.evaluate(() => { window.__amzn = JSON.parse(localStorage.getItem('converge.v1')).lots.find((l) => l.t === 'AMZN').id; });
await Dk.page.click('[data-act="tab"][data-tab="vault"]'); await Dk.page.waitForTimeout(200);
await Dk.page.evaluate(() => document.querySelector(`[data-act="lot"][data-id="${window.__amzn}"]`).click()); await Dk.page.waitForTimeout(200);
await Dk.page.click('[data-act="del-lot"]'); await Dk.page.click('[data-act="del-lot"]');
check('phone drops the lot deleted on the desktop', await waitLots(Ph.page, 2, 8000) && !(await lots(Ph.page)).some((l) => l.startsWith('AMZN')));
// settings show the sync source
await Ph.page.click('[data-act="tab"][data-tab="command"]'); await Ph.page.click('[data-act="settings"]'); await Ph.page.waitForTimeout(300);
const line = await Ph.page.$eval('#syncstat', (e) => e.textContent);
check('settings: ' + line, /Synced .*Claude account/.test(line));
await Ph.page.screenshot({ path: path.join(out, 'phone-settings.png') });

// 4. Copy my data -> Import data on a copy with no sync (e.g. the Android app before accounts are set up)
await Dk.page.click('[data-act="tab"][data-tab="command"]'); await Dk.page.click('[data-act="settings"]'); await Dk.page.waitForTimeout(200);
await Dk.page.click('[data-act="data-copy"]'); await Dk.page.waitForTimeout(200);
const txt = await Dk.page.$eval('#datacopy', (e) => e.value);
await Dk.page.screenshot({ path: path.join(out, 'desktop-copy.png') });
const Ap = await device('app-without-sync', { width: 412, height: 915 }, { claude: false });
await Ap.page.click('[data-act="settings"]'); await Ap.page.waitForTimeout(200);
await Ap.page.click('[data-act="data-import"]'); await Ap.page.waitForTimeout(150);
await Ap.page.fill('#dataimport', 'not json'); await Ap.page.click('[data-act="data-import-go"]'); await Ap.page.waitForTimeout(150);
check('import rejects junk with a clear message', /doesn’t look like Converge data/.test(await Ap.page.$eval('.panel', (e) => e.innerText)));
await Ap.page.fill('#dataimport', txt); await Ap.page.click('[data-act="data-import-go"]'); await Ap.page.waitForTimeout(300);
const imp = await lots(Ap.page);
check('import brings the holdings over: ' + imp.join(' ; '), JSON.stringify(imp) === JSON.stringify(await lots(Dk.page)));
await Ap.page.fill('#dataimport', '').catch(() => {});
await Ap.page.evaluate((t) => window.__convergeImport(t), txt);
check('importing the same data twice adds nothing', (await lots(Ap.page)).length === imp.length);
await Ap.page.click('[data-act="tab"][data-tab="command"]').catch(() => {}); await Ap.page.waitForTimeout(200);
await Ap.page.screenshot({ path: path.join(out, 'app-after-import.png') });
console.log('store writes:', writes);
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
process.exit(errs.length ? 1 : 0);
