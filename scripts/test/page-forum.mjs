// The claude.ai page's per-stock discussion (shared db collection forum/<T>/posts) and the
// politicians / hedge funds / insiders panels, with three simulated viewers.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] || 'dist/converge.html');
const out = path.resolve(process.argv[3] || 'tmp-pageforum');
fs.mkdirSync(out, { recursive: true });
const DOCS = new Map(); let seq = 0;
const errs = [];
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) errs.push('FAIL ' + l); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const NAMES = { u_owner: 'Zhivo', u_friend: 'Maria Lopez', u_viewer: 'Public Viewer' };

async function viewer(uid, { canWrite = true, owner = false, viewport = { width: 390, height: 844 } } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.exposeBinding('__get', (_, p) => DOCS.has(p) ? JSON.parse(DOCS.get(p)) : null);
  await ctx.exposeBinding('__set', (_, p, v, who) => { if (!p.startsWith('data/users/') && !canWrite) return { error: 'not_granted' }; DOCS.set(p, JSON.stringify(v)); return { ok: true }; });
  await ctx.exposeBinding('__del', (_, p) => { if (!canWrite) return { error: 'not_granted' }; DOCS.delete(p); return { ok: true }; });
  await ctx.exposeBinding('__list', (_, coll) => [...DOCS.entries()].filter(([k]) => k.startsWith(coll + '/') && k.split('/').length === coll.split('/').length + 1).map(([k, v]) => ({ id: k.split('/').pop(), data: JSON.parse(v) })));
  await ctx.exposeBinding('__newId', () => 'p' + (++seq).toString(36) + Math.random().toString(36).slice(2, 6));
  await ctx.addInitScript(({ uid, owner, names }) => {
    const snapDoc = (id, d) => ({ id, exists: !!d, data: () => d || undefined, metadata: { fromCache: false, hasPendingWrites: false } });
    const fail = (r) => { if (r && r.error) { const e = new Error(r.error); e.code = r.error; throw e; } };
    const docRef = (p) => ({ id: p.split('/').pop(), path: p, get: async () => snapDoc(p, await window.__get(p)), set: async (v) => fail(await window.__set(p, v)), delete: async () => fail(await window.__del(p)),
      onSnapshot: (fn) => { let last; const t = setInterval(async () => { const d = await window.__get(p); const k = JSON.stringify(d); if (k !== last) { last = k; fn(snapDoc(p, d)); } }, 300); return () => clearInterval(t); } });
    const query = (coll, ord, lim) => ({
      orderBy: (f, dir) => query(coll, [f, dir || 'asc'], lim), limit: (n) => query(coll, ord, n), where: () => query(coll, ord, lim),
      get: async () => run(),
      onSnapshot: (fn) => { let last; const tick = async () => { const s = await run(); const k = JSON.stringify(s.docs.map((d) => [d.id, d.data()])); if (k !== last) { last = k; fn(s); } }; tick(); const t = setInterval(tick, 300); return () => clearInterval(t); }
    });
    async function runQ(coll, ord, lim) { let rows = await window.__list(coll); if (ord) rows.sort((a, b) => (ord[1] === 'desc' ? -1 : 1) * String(a.data[ord[0]]).localeCompare(String(b.data[ord[0]]))); if (lim) rows = rows.slice(0, lim); const docs = rows.map((r) => snapDoc(r.id, r.data)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; }
    const collection = (coll) => { const q = query(coll); let state = { ord: null, lim: null }; const make = (ord, lim) => ({ ...q, orderBy: (f, d) => make([f, d || 'asc'], lim), limit: (n) => make(ord, n), get: () => runQ(coll, ord, lim), onSnapshot: (fn) => { let last; const tick = async () => { const s = await runQ(coll, ord, lim); const k = JSON.stringify(s.docs.map((d) => [d.id, d.data()])); if (k !== last) { last = k; fn(s); } }; tick(); const t = setInterval(tick, 300); return () => clearInterval(t); } });
      return { ...make(null, null), path: coll, doc: (id) => docRef(coll + '/' + (id || 'x')), add: async (v) => { const id = await window.__newId(); await docRef(coll + '/' + id).set(v); return docRef(coll + '/' + id); } }; };
    function run() { return { docs: [] }; }
    const db = { doc: docRef, collection };
    const user = { id: async () => uid, isOwner: async () => owner, can: async () => null, profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: names[i] || '', isMe: i === uid }])), me: async () => ({ id: uid }) };
    window.claude = { use: (n) => Promise.resolve(n === 'db' ? db : n === 'user' ? user : null) };
  }, { uid, owner, names: NAMES });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(uid + ' pageerror: ' + e.message));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForSelector('.nav');
  return { uid, ctx, page, canWrite };
}
const openTicker = async (v, t) => {
  await v.page.click('[data-act="tab"][data-tab="battle"]'); await v.page.waitForTimeout(200);
  if (await v.page.$(`.chip[data-t="${t}"]`)) await v.page.click(`.chip[data-t="${t}"]`);
  else { await v.page.click('[data-act="pick"][data-mode="battle"]'); await v.page.fill('#pickq', t); await v.page.waitForTimeout(200); await v.page.click(`[data-t="${t}"]`); }
  await v.page.waitForSelector('#forumbox', { timeout: 8000 }); await v.page.waitForTimeout(500);
  await v.page.evaluate(() => document.getElementById('forumbox').scrollIntoView());
};
const posts = (v) => v.page.$$eval('#forumbox .post', (a) => a.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));

const A = await viewer('u_owner', { owner: true });
const B = await viewer('u_friend', { viewport: { width: 1280, height: 860 } });
const C = await viewer('u_viewer', { canWrite: false });
await openTicker(A, 'NVDA'); await openTicker(B, 'NVDA'); await openTicker(C, 'NVDA');
await A.page.fill('#forum-text', 'Data-center demand still looks strong into next quarter.');
await A.page.click('[data-act="pforum-post"]'); await A.page.waitForTimeout(900);
check('owner posts under NVDA: ' + (await posts(A))[0], /You .*Data-center demand/.test((await posts(A))[0] || ''));
check('a second viewer sees it live with the author’s name: ' + (await posts(B))[0], /Zhivo .*Data-center demand/.test((await posts(B))[0] || ''));
await B.page.fill('#forum-text', 'Agree, but the valuation is stretched.'); await B.page.click('[data-act="pforum-post"]'); await B.page.waitForTimeout(900);
check('replies show newest first for everyone: ' + (await posts(A)).map((p) => p.split(' ')[0]).join(', '), /^Maria/.test((await posts(A))[0] || ''));
await B.page.fill('#forum-text', 'what a sh1tshow'); await B.page.click('[data-act="pforum-post"]'); await B.page.waitForTimeout(300);
check('foul language is blocked', /isn’t allowed/.test(await B.page.$eval('#forumbox', (e) => e.innerText)) && (await posts(A)).length === 2);
// read-only viewer
await C.page.fill('#forum-text', 'Can I post?').catch(() => {});
if (await C.page.$('[data-act="pforum-post"]')) { await C.page.click('[data-act="pforum-post"]'); await C.page.waitForTimeout(500); }
check('a read-only viewer can read but not post: ' + (await C.page.$eval('#forumbox', (e) => (e.querySelector('.note') || {}).innerText || '')), /invited/.test(await C.page.$eval('#forumbox', (e) => e.innerText)) && (await posts(C)).length === 2);
// boards are per stock
await openTicker(B, 'AAPL');
check('each stock has its own board (AAPL empty)', (await posts(B)).length === 0 && /No comments yet/.test(await B.page.$eval('#forumbox', (e) => e.innerText)));
await B.page.screenshot({ path: path.join(out, 'desktop-aapl.png') });
// any stock from search gets a board too
await B.page.click('[data-act="pick"][data-mode="battle"]'); await B.page.fill('#pickq', 'SOFI'); await B.page.waitForTimeout(250);
await B.page.click('[data-act="picked-ext"][data-t="SOFI"]'); await B.page.waitForTimeout(500);
check('a searched stock page has the discussion and the three panels', !!(await B.page.$('#forumbox')) && !!(await B.page.$('#smartbox')));
// owner can delete
await A.page.evaluate(() => document.querySelector('#forumbox [data-act="pforum-del"]').click()); await A.page.waitForTimeout(900);
check('owner can remove a post (moderation)', (await posts(A)).length === 1 && (await posts(B.page ? A : A)).length === 1);
// panels in the page for a tracked ticker
await A.page.evaluate(() => document.getElementById('smartbox').scrollIntoView()); await A.page.waitForTimeout(200);
const sm = await A.page.$eval('#smartbox', (e) => e.innerText.replace(/\s+/g, ' '));
const cols = await A.page.$$eval('#smartbox .ocol', (a) => a.map((e) => e.querySelector('.ot').textContent));
check('three ownership columns under the discussion: ' + cols.join(' | '), cols.join('|') === 'Politicians|Hedge funds|Insiders');
for (const k of ['f', 'i', 'c']) { await A.page.click(`#smartbox [data-act="own-tab"][data-k="${k}"]`); await A.page.waitForTimeout(150); }
await A.page.click('#smartbox [data-act="own-tab"][data-k="f"]'); await A.page.waitForTimeout(150);
check('tapping a column shows its detail: ' + (await A.page.$eval('#smartbox', (e) => e.innerText.replace(/\s+/g, ' '))).slice(0, 120), /HEDGE FUNDS &/i.test(await A.page.$eval('#smartbox', (e) => e.innerText)) && !/STOCK Act/.test(await A.page.$eval('#smartbox', (e) => e.innerText)));
await A.page.click('#smartbox [data-act="own-tab"][data-k="c"]'); await A.page.waitForTimeout(150);
await A.page.screenshot({ path: path.join(out, 'phone-nvda-panels.png'), fullPage: false });
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); process.exit(errs.length ? 1 : 0);
