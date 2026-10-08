// "Smart money" for every US-listed stock, written to <dir> (a checkout of the `smart` branch):
//   congress.json   every stock trade disclosed by members of Congress in the last 2 years
//                   (official STOCK Act Periodic Transaction Reports: House Clerk PDFs + Senate eFD)
//   s/<T>.json      per stock: politicians' trades, 13F fund holders (hedge funds picked out, biggest buyers/sellers),
//                   insider (Form 4) trades — the last two from Nasdaq's public company pages
//   cache/*.json    parsed filings and refresh times, so each run only fetches what's new
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseHousePtr, parseSenatePtr } from './lib/congress.mjs';

const DIR = path.resolve(process.argv[2] || 'smart-out');
const BUDGET = (+process.argv[3] || 2700) * 1000;
const t0 = Date.now(), left = () => BUDGET - (Date.now() - t0);
for (const d of ['s', 'cache', 'tmp']) fs.mkdirSync(path.join(DIR, d), { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const NH = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const readJ = (p, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, p), 'utf8')); } catch { return d; } };
const writeJ = (p, v) => fs.writeFileSync(path.join(DIR, p), JSON.stringify(v));
async function get(url, { headers = { 'User-Agent': UA }, as = 'text', tries = 3, timeout = 30000, method = 'GET', body } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers, method, body, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return as === 'json' ? await r.json() : as === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { last = e; if (e.fatal) break; await sleep(1500 * (i + 1)); }
  }
  throw last;
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length && left() > 90000) { const k = i++; try { await fn(items[k], k); } catch (e) { if (errors.length < 60) errors.push(String(e.message || e).slice(0, 120)); } } })); }
const num = (s) => { if (s == null) return null; const x = +String(s).replace(/[^0-9.\-]/g, ''); return String(s).trim() === '' || !isFinite(x) ? null : x; };
const isoUS = (d) => { const m = String(d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; };
const Y = new Date().getUTCFullYear(), SINCE = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10);

// ---------------------------------------------------------------- members of Congress (party, state, district)
const LEG = [];
try {
  for (const u of ['https://unitedstates.github.io/congress-legislators/legislators-current.json', 'https://unitedstates.github.io/congress-legislators/legislators-historical.json']) {
    const j = await get(u, { as: 'json', timeout: 60000 });
    for (const p of j) { const term = p.terms[p.terms.length - 1]; if (term.end < '2023-01-01') continue; LEG.push({ last: (p.name.last || '').toLowerCase(), first: (p.name.first || '').toLowerCase(), nick: (p.name.nickname || '').toLowerCase(), type: term.type, state: term.state, district: term.district, party: term.party }); }
  }
} catch (e) { errors.push('legislators: ' + e.message); }
const P1 = { Democrat: 'D', Republican: 'R', Independent: 'I' };
function member(chamber, last, first, stateDst) {
  const L = String(last || '').toLowerCase().replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/, '').trim(), F = String(first || '').toLowerCase().split(/\s+/)[0];
  const st = stateDst ? stateDst.slice(0, 2) : null;
  let c = LEG.filter((p) => p.type === (chamber === 'House' ? 'rep' : 'sen') && (p.last === L || L.endsWith(' ' + p.last) || p.last.endsWith(L)) && (!st || p.state === st));
  if (c.length > 1 && F) { const c2 = c.filter((p) => p.first.startsWith(F) || p.nick.startsWith(F) || F.startsWith(p.first)); if (c2.length) c = c2; }
  const p = c[0]; return p ? { party: P1[p.party] || (p.party || '').slice(0, 1), state: p.state, district: p.district } : { party: null, state: st, district: stateDst ? +stateDst.slice(2) || null : null };
}

// ---------------------------------------------------------------- House: Clerk index + PTR PDFs
const house = readJ('cache/house.json', {});
let houseNew = 0;
for (const yr of [Y - 1, Y]) {
  try {
    const zip = await get(`https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${yr}FD.zip`, { as: 'buf', timeout: 60000 });
    fs.writeFileSync(path.join(DIR, 'tmp', 'fd.zip'), zip);
    execFileSync('unzip', ['-o', '-q', path.join(DIR, 'tmp', 'fd.zip'), '-d', path.join(DIR, 'tmp')]);
    const rows = fs.readFileSync(path.join(DIR, 'tmp', `${yr}FD.txt`), 'utf8').split(/\r?\n/).slice(1).map((l) => l.split('\t')).filter((c) => c[4] === 'P' && c[8]);
    const todo = rows.filter((c) => !house[c[8]]);
    console.log(`house ${yr}: ${rows.length} PTRs, ${todo.length} new`);
    await pool(todo, 4, async (c) => {
      const id = c[8], url = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${c[6]}/${id}.pdf`;
      const pdf = await get(url, { as: 'buf', timeout: 40000 });
      const f = path.join(DIR, 'tmp', id + '.pdf'); fs.writeFileSync(f, pdf);
      let text = ''; try { text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { text = ''; }
      fs.unlinkSync(f);
      const trades = parseHousePtr(text);
      house[id] = { last: c[1], first: c[2], sd: c[5], filed: isoUS(c[7]), url, scan: text.replace(/\s/g, '').length < 400, trades };
      houseNew++;
    });
  } catch (e) { errors.push(`house ${yr}: ` + e.message); }
}
writeJ('cache/house.json', house);

// ---------------------------------------------------------------- Senate: eFD search + report pages
const senate = readJ('cache/senate.json', {});
let senateNew = 0;
try {
  const jar = {};
  const setC = (r) => { for (const sc of r.headers.getSetCookie ? r.headers.getSetCookie() : []) { const kv = sc.split(';')[0], i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
  const ck = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
  let r = await fetch('https://efdsearch.senate.gov/search/home/', { headers: { 'User-Agent': UA } }); setC(r);
  const tok = ((await r.text()).match(/name="csrfmiddlewaretoken" value="([^"]+)"/) || [])[1];
  r = await fetch('https://efdsearch.senate.gov/search/home/', { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ck(), Referer: 'https://efdsearch.senate.gov/search/home/', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ prohibition_agreement: '1', csrfmiddlewaretoken: tok }) }); setC(r);
  const [sy, sm, sd] = SINCE.split('-');
  const list = [];
  for (let start = 0; start < 5000; start += 100) {
    const body = new URLSearchParams({ start: String(start), length: '100', report_types: '[11]', filer_types: '[]', submitted_start_date: `${sm}/${sd}/${sy} 00:00:00`, submitted_end_date: '', candidate_state: '', senator_state: '', office_id: '', first_name: '', last_name: '', csrfmiddlewaretoken: jar.csrftoken });
    const j = await get('https://efdsearch.senate.gov/search/report/data/', { method: 'POST', as: 'json', headers: { 'User-Agent': UA, Cookie: ck(), Referer: 'https://efdsearch.senate.gov/search/', 'X-CSRFToken': jar.csrftoken, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    for (const row of j.data || []) { const m = String(row[3]).match(/\/search\/view\/(ptr|paper)\/([0-9a-f-]+)\//); if (m) list.push({ kind: m[1], id: m[2], first: row[0], last: row[1], filed: isoUS(row[4]) }); }
    if (!j.data || j.data.length < 100) break;
    await sleep(300);
  }
  const todo = list.filter((x) => !senate[x.id]);
  console.log(`senate: ${list.length} reports since ${SINCE}, ${todo.length} new`);
  await pool(todo, 3, async (x) => {
    const url = `https://efdsearch.senate.gov/search/view/${x.kind}/${x.id}/`;
    if (x.kind === 'paper') { senate[x.id] = { ...x, url, scan: true, trades: [] }; return; }
    const html = await get(url, { headers: { 'User-Agent': UA, Cookie: ck() } });
    senate[x.id] = { ...x, url, trades: parseSenatePtr(html) }; senateNew++;
    await sleep(150);
  });
} catch (e) { errors.push('senate: ' + e.message); }
writeJ('cache/senate.json', senate);

// ---------------------------------------------------------------- one list of politicians' stock trades
const congress = [];
for (const f of Object.values(house)) for (const tr of f.trades || []) { const m = member('House', f.last, f.first, f.sd); congress.push({ ...tr, who: `${f.first} ${f.last}`.replace(/\b(Mr|Mrs|Ms|Dr|Hon)\.?(?=\s|$)/g, '').replace(/\s+/g, ' ').trim(), ch: 'House', party: m.party, state: m.state, district: m.district, filed: f.filed, url: f.url }); }
for (const f of Object.values(senate)) for (const tr of f.trades || []) { const m = member('Senate', f.last, f.first, null); congress.push({ ...tr, who: `${f.first} ${f.last}`.replace(/\s+/g, ' ').trim(), ch: 'Senate', party: m.party, state: m.state, district: null, filed: f.filed, url: f.url }); }
for (const x of congress) {
  const lim = x.filed || new Date().toISOString().slice(0, 10);
  if (x.date && x.date > lim) { const y1 = (+x.date.slice(0, 4) - 1) + x.date.slice(4); x.date = y1 <= lim ? y1 : lim; x.dateFixed = true; }
}
const recent = congress.filter((x) => x.date >= SINCE).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
writeJ('congress.json', { app: 'Converge', kind: 'congress', generatedAt: new Date().toISOString(), since: SINCE, sources: ['U.S. House Clerk Periodic Transaction Reports', 'U.S. Senate eFD Periodic Transaction Reports', 'unitedstates/congress-legislators'], count: recent.length, trades: recent });
const byT = {}; for (const x of recent) (byT[x.t] = byT[x.t] || []).push(x);
console.log(`congress: ${recent.length} stock trades (House +${houseNew}, Senate +${senateNew} new filings)`);

// ---------------------------------------------------------------- funds (13F) + insiders (Form 4), per stock
const HEDGE = /\b(?:renaissance tech|citadel advisors|bridgewater|two sigma|d\.?\s?e\.? shaw|millennium management|point72|aqr capital|tiger global|coatue|pershing square|third point|elliott (investment|management)|viking global|lone pine|baupost|appaloosa|soros fund|duquesne|greenlight capital|balyasny|marshall wace|maverick capital|dragoneer|whale rock|valueact|starboard value|icahn|trian fund|glenview|tudor investment|moore capital|paulson & co|scion asset|arrowstreet|man group|winton|squarepoint|schonfeld|exodus ?point|hudson bay|magnetar|sculptor|farallon|eminence capital|greenoaks|altimeter|d1 capital|durable capital|sachem head|jana partners|light street|egerton|lansdowne|ako capital|davidson kempner|king street|anchorage capital|holocene|walleye|qube research|g2 investment|caxton|graham capital|brevan howard|alkeon|jericho|bain capital (public|credit)|steadview|tci fund|children'?s investment|lansdowne|cantillon|maplelane|hound partners|soroban|light street|spruce house|abrams capital|ancora|engaged capital|land & buildings|politan|irenic|legion partners|cevian)/i;
const nas = readJ('cache/nasdaq.json', {});
const sym = await get('https://raw.githubusercontent.com/' + (process.env.GITHUB_REPOSITORY || 'ZStamov/Converge') + '/history/symbols.json', { as: 'json', timeout: 60000 }).catch(() => null);
const tracked = JSON.parse(fs.readFileSync(new URL('../config/universe.json', import.meta.url))).tickers;
const stocks = (sym ? sym.rows.filter((r) => ['NASDAQ', 'NYSE', 'NYSE American'].includes(r[2])) : []).map((r) => ({ t: r[0], sp: r[3], mc: r[5] || 0 }));
const prio = (s) => (tracked.includes(s.t) ? 2e15 : 0) + (s.sp ? 1e15 : 0) + s.mc;
stocks.sort((a, b) => prio(b) - prio(a));
const stale = stocks.filter((s) => !nas[s.t] || nas[s.t].v !== 4 || Date.now() - nas[s.t].at > 20 * 3600e3).sort((a, b) => ((nas[a.t] || {}).at || 0) - ((nas[b.t] || {}).at || 0) || prio(b) - prio(a));
console.log(`nasdaq: ${stocks.length} stocks, ${stale.length} due for refresh`);
let nOk = 0, nFail = 0, consecutiveFail = 0;
async function nasdaq(t) {
  const q = t.replace('.', '%25sl%25');
  const [ins, inst, insBuys] = await Promise.all([
    get(`https://api.nasdaq.com/api/company/${q}/insider-trades?limit=200&type=ALL&sortColumn=lastDate&sortOrder=DESC`, { headers: NH, as: 'json', tries: 2 }).catch(() => null),
    get(`https://api.nasdaq.com/api/company/${q}/institutional-holdings?limit=300&type=TOTAL&sortColumn=marketValue&sortOrder=DESC`, { headers: NH, as: 'json', tries: 2 }).catch(() => null),
    Promise.resolve(null)
  ]);
  const rec = { at: Date.now(), v: 4 };
  const rowsOf = (x) => ((x && x.data && x.data.transactionTable && x.data.transactionTable.table && x.data.transactionTable.table.rows) || []);
  const mapT = (r) => ({ who: r.insider, rel: r.relation, date: isoUS(r.lastDate), type: r.transactionType, own: r.ownType, shares: num(r.sharesTraded), price: num(r.lastPrice), held: num(r.sharesHeld) });
  const d1 = ins && ins.data;
  if (d1) {
    const cnt = {}; (d1.numberOfTrades && d1.numberOfTrades.rows || []).forEach((r) => { cnt[r.insiderTrade] = [num(r.months3), num(r.months12)]; });
    const sh = {}; (d1.numberOfSharesTraded && d1.numberOfSharesTraded.rows || []).forEach((r) => { sh[r.insiderTrade] = [num(r.months3), num(r.months12)]; });
    rec.insider = {
      buys: cnt['Number of Open Market Buys'] || null, sells: cnt['Number of Sells'] || null,
      sharesBought: sh['Number of Shares Bought'] || null, sharesSold: sh['Number of Shares Sold'] || null,
      trades: rowsOf(ins).slice(0, 40).map(mapT),
      buyTrades: rowsOf(ins).map(mapT).filter((x) => /buy|purchase/i.test(x.type || '')).slice(0, 25)
    };
  }
  const d2 = inst && inst.data;
  if (d2) {
    const pos = {}; [...((d2.activePositions && d2.activePositions.rows) || []), ...((d2.newSoldOutPositions && d2.newSoldOutPositions.rows) || [])].forEach((r) => { pos[r.positions] = [num(r.holders), num(r.shares)]; });
    const os = d2.ownershipSummary || {};
    const H = ((d2.holdingsTransactions && d2.holdingsTransactions.table && d2.holdingsTransactions.table.rows) || []).map((r) => ({ who: r.ownerName, date: isoUS(r.date), shares: num(r.sharesHeld), chg: num(r.sharesChange), chgPct: num(r.sharesChangePCT), value: num(r.marketValue) }));
    rec.funds = {
      instPct: num(os.SharesOutstandingPCT && os.SharesOutstandingPCT.value), shOut: num(os.ShareoutstandingTotal && os.ShareoutstandingTotal.value) != null ? Math.round(num(os.ShareoutstandingTotal.value) * 1e6) : null, holders: num(d2.holdingsTransactions && d2.holdingsTransactions.totalRecords),
      increased: pos['Increased Positions'] || null, decreased: pos['Decreased Positions'] || null, held: pos['Held Positions'] || null, newPos: pos['New Positions'] || null, soldOut: pos['Sold Out Positions'] || null,
      hedge: H.filter((h) => HEDGE.test(h.who)).slice(0, 20),
      buyers: H.filter((h) => h.chg > 0).sort((a, b) => b.chg - a.chg).slice(0, 6),
      sellers: H.filter((h) => h.chg < 0).sort((a, b) => a.chg - b.chg).slice(0, 6),
      top: H.slice(0, 6), scanned: H.length
    };
  }
  if (!rec.insider && !rec.funds) throw new Error('nasdaq: nothing for ' + t);
  return rec;
}
await pool(stale, 4, async (s) => {
  if (consecutiveFail > 40) { await sleep(60000); consecutiveFail = 0; }
  try { nas[s.t] = await nasdaq(s.t); nOk++; consecutiveFail = 0; } catch (e) { nFail++; consecutiveFail++; if (nas[s.t]) nas[s.t].at = Date.now() - 18 * 3600e3; else nas[s.t] = { at: Date.now() - 18 * 3600e3 }; }
  await sleep(120);
});
writeJ('cache/nasdaq.json', nas);
console.log(`nasdaq: ${nOk} refreshed, ${nFail} failed`);

// ---------------------------------------------------------------- per-stock files
let files = 0;
const all = new Set([...stocks.map((s) => s.t), ...Object.keys(byT)]);
for (const t of all) {
  const n = nas[t] || {}, c = (byT[t] || []).slice(0, 80);
  if (!c.length && !n.insider && !n.funds) continue;
  fs.writeFileSync(path.join(DIR, 's', t + '.json'), JSON.stringify({ t, generatedAt: new Date().toISOString(), nasdaqAt: n.at ? new Date(n.at).toISOString() : null, congress: c, insider: n.insider || null, funds: n.funds || null }));
  files++;
}
fs.rmSync(path.join(DIR, 'tmp'), { recursive: true, force: true });
writeJ('index.json', { app: 'Converge', kind: 'smart', generatedAt: new Date().toISOString(), files, congressTrades: recent.length, nasdaqFresh: Object.values(nas).filter((x) => x.insider || x.funds).length, errors: errors.slice(0, 30) });
console.log(`files: ${files}; ${Math.round((Date.now() - t0) / 1000)}s; errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 12).join('\n'));
