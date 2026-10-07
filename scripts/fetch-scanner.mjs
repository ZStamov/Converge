// Builds <out>/scanner.json: Finviz-style screener rows for the S&P 500.
// Sources: S&P 500 list (datasets/s-and-p-500-companies on GitHub), Yahoo Finance chart API
// (daily bars, cached; refreshed once per trading day), Yahoo spark (latest prices, hourly),
// Nasdaq screener API (volume, market cap, country), SEC XBRL frames (fundamentals, optional).
import fs from 'node:fs';
import path from 'node:path';
import * as S from './lib/scanner.mjs';

const OUT = path.resolve(process.argv[2] || 'data-out');
fs.mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(new URL('../config/universe.json', import.meta.url)));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const UA_SEC = process.env.SEC_USER_AGENT || 'Converge ZStamov@users.noreply.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const t0 = Date.now();

async function get(url, { headers = {}, json = false, tries = 3, timeout = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(timeout) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return json ? await r.json() : await r.text();
    } catch (e) { last = e; if (e.fatal) break; await sleep(1000 * (i + 1)); }
  }
  throw last;
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; errors.push(String(e.message || e).slice(0, 120)); } } }));
  return out;
}
function csvRows(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const yh = (t) => t.replace('.', '-');
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---- universe ----
const csv = csvRows(await get('https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'));
const head = csv[0];
const col = (n) => head.indexOf(n);
const universe = csv.slice(1).filter((r) => r[col('Symbol')]).map((r) => ({ t: r[col('Symbol')].trim(), n: r[col('Security')], sec: r[col('GICS Sector')], ind: r[col('GICS Sub-Industry')], cik: +r[col('CIK')] || null }));
const DJIA = new Set(cfg.djia || []);
console.log('universe', universe.length);

// ---- daily bars cache ----
const cachePath = path.join(OUT, 'prices-cache.json');
let cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : { asOf: null, bars: {} };
async function bars(t) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yh(t))}?range=1y&interval=1d`, { json: true });
  const r = j?.chart?.result?.[0]; if (!r) throw new Error('no chart ' + t);
  const q = r.indicators?.quote?.[0] || {}; const ts = r.timestamp || [];
  const out = { d: [], c: [], h: [], l: [], v: [], ex: S.exchangeName(r.meta?.exchangeName), cur: r.meta?.currency };
  ts.forEach((x, i) => { if (q.close?.[i] != null) { out.d.push(isoDay(x * 1000)); out.c.push(+q.close[i].toFixed(4)); out.h.push(+(q.high?.[i] ?? q.close[i]).toFixed(4)); out.l.push(+(q.low?.[i] ?? q.close[i]).toFixed(4)); out.v.push(q.volume?.[i] ?? 0); } });
  // keep cache compact: full closes/dates, recent highs/lows/volumes
  out.h = out.h.slice(-30); out.l = out.l.slice(-30); out.v = out.v.slice(-70);
  return out;
}
// refresh the cache at most once per completed trading day (SPY tells us the last session)
const spy = await bars('SPY');
const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
const afterClose = nowET.getHours() * 60 + nowET.getMinutes() >= 16 * 60 + 30 || [0, 6].includes(nowET.getDay());
const todayET = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;
const completed = spy.d.at(-1) === todayET && !afterClose ? spy.d.at(-2) : spy.d.at(-1);
const stale = !cache.asOf || cache.asOf < completed || universe.some((u) => !cache.bars[u.t]);
if (stale) {
  console.log('refreshing daily bars for', universe.length, 'tickers');
  const todo = cache.asOf && cache.asOf >= completed ? universe.filter((u) => !cache.bars[u.t]) : universe;
  const got = await pool(todo, 6, async (u) => { const b = await bars(u.t); await sleep(120); return b; });
  todo.forEach((u, i) => { if (got[i]) cache.bars[u.t] = got[i]; });
  cache.bars.SPY = spy; cache.asOf = completed;
  // drop the in-progress session from the cache so hourly updates add it live
  for (const b of Object.values(cache.bars)) if (b.d.at(-1) > completed) { b.d.pop(); b.c.pop(); b.h.pop(); b.l.pop(); b.v.pop(); }
  fs.writeFileSync(cachePath, JSON.stringify(cache));
}
console.log('bars ready', Object.keys(cache.bars).length, 'in', Math.round((Date.now() - t0) / 1000), 's');

// ---- live prices (Yahoo spark, 20 per request) ----
const live = {};
const chunks = []; for (let i = 0; i < universe.length; i += 20) chunks.push(universe.slice(i, i + 20));
await pool(chunks, 3, async (ch) => {
  const j = await get(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${ch.map((u) => encodeURIComponent(yh(u.t))).join(',')}&range=1d&interval=1d`, { json: true });
  for (const r of j?.spark?.result || []) {
    const m = r.response?.[0]?.meta; if (!m) continue;
    const t = universe.find((u) => yh(u.t) === r.symbol)?.t || r.symbol;
    live[t] = { price: m.regularMarketPrice, day: m.regularMarketTime ? isoDay(m.regularMarketTime * 1000) : null, volume: m.regularMarketVolume ?? null };
  }
});
console.log('live prices', Object.keys(live).length);

// ---- Nasdaq bulk table: volume, market cap, country ----
const nas = {};
try {
  const j = await get('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true', { json: true, headers: { Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' } });
  for (const r of j?.data?.rows || []) nas[String(r.symbol).replace('/', '.').trim()] = { mc: +String(r.marketCap || '').replace(/[^0-9.]/g, '') || null, v: +String(r.volume || '').replace(/[^0-9]/g, '') || null, ctry: r.country || null, p: +String(r.lastsale || '').replace(/[^0-9.]/g, '') || null };
} catch (e) { errors.push('nasdaq: ' + e.message); }
console.log('nasdaq rows', Object.keys(nas).length);

// ---- SEC frames (optional fundamentals) ----
const F = {}; let secOk = false, quarter = null;
async function frame(tag, unit, period) {
  const j = await get(`https://data.sec.gov/api/xbrl/frames/us-gaap/${tag}/${unit}/${period}.json`, { json: true, headers: { 'User-Agent': UA_SEC }, tries: 2 });
  return new Map((j.data || []).map((x) => [x.cik, x.val]));
}
async function frameAny(tags, unit, period) {
  const m = new Map();
  for (const t of tags) { try { const f = await frame(t, unit, period); for (const [k, v] of f) if (!m.has(k)) m.set(k, v); secOk = true; } catch (e) { if (!/404/.test(e.message)) errors.push(`sec ${t} ${period}: ${e.message}`); } await sleep(150); }
  return m;
}
{
  const Y = new Date().getUTCFullYear() - 1;
  const REV = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'];
  F.rev = await frameAny(REV, 'USD', 'CY' + Y);
  if (secOk) {
    F.revPrev = await frameAny(REV, 'USD', 'CY' + (Y - 1));
    F.ni = await frameAny(['NetIncomeLoss'], 'USD', 'CY' + Y);
    F.gp = await frameAny(['GrossProfit'], 'USD', 'CY' + Y);
    F.op = await frameAny(['OperatingIncomeLoss'], 'USD', 'CY' + Y);
    F.eps = await frameAny(['EarningsPerShareDiluted'], 'USD-per-shares', 'CY' + Y);
    F.epsPrev = await frameAny(['EarningsPerShareDiluted'], 'USD-per-shares', 'CY' + (Y - 1));
    F.div = await frameAny(['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'], 'USD', 'CY' + Y);
    F.dps = await frameAny(['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'], 'USD-per-shares', 'CY' + Y);
    const I = `CY${Y}Q4I`;
    F.eq = await frameAny(['StockholdersEquity'], 'USD', I);
    F.assets = await frameAny(['Assets'], 'USD', I);
    F.ac = await frameAny(['AssetsCurrent'], 'USD', I);
    F.lc = await frameAny(['LiabilitiesCurrent'], 'USD', I);
    F.ltd = await frameAny(['LongTermDebtNoncurrent', 'LongTermDebt'], 'USD', I);
    F.ocf = await frameAny(['NetCashProvidedByUsedInOperatingActivities'], 'USD', 'CY' + Y);
    F.capex = await frameAny(['PaymentsToAcquirePropertyPlantAndEquipment'], 'USD', 'CY' + Y);
    F.buyback = await frameAny(['PaymentsForRepurchaseOfCommonStock'], 'USD', 'CY' + Y);
    // latest quarter with broad coverage, compared with the same quarter a year earlier
    const now = new Date(); let qy = now.getUTCFullYear(), qn = Math.floor(now.getUTCMonth() / 3); // last completed quarter
    if (qn === 0) { qy--; qn = 4; }
    for (let tries = 0; tries < 3; tries++) {
      const cur = await frameAny(REV, 'USD', `CY${qy}Q${qn}`);
      if (cur.size >= 250) {
        F.qrev = cur; F.qrevPrev = await frameAny(REV, 'USD', `CY${qy - 1}Q${qn}`);
        F.qeps = await frameAny(['EarningsPerShareDiluted'], 'USD-per-shares', `CY${qy}Q${qn}`);
        F.qepsPrev = await frameAny(['EarningsPerShareDiluted'], 'USD-per-shares', `CY${qy - 1}Q${qn}`);
        quarter = `Q${qn} ${qy}`; break;
      }
      qn--; if (qn === 0) { qy--; qn = 4; }
    }
  }
}
console.log('sec fundamentals', secOk ? 'yes' : 'no');

// ---- rows ----
const bench = cache.bars.SPY;
const rows = [];
for (const u of universe) {
  const b = cache.bars[u.t]; if (!b || b.c.length < 30) continue;
  const lv = live[u.t] || (nas[u.t]?.p ? { price: nas[u.t].p, volume: nas[u.t].v } : null);
  if (lv && nas[u.t]?.v && lv.volume == null) lv.volume = nas[u.t].v;
  const tech = S.technicals(b, lv, bench);
  const mc = nas[u.t]?.mc || null;
  const fund = secOk && u.cik ? S.fundamentals(u.cik, F, tech.p, mc) : {};
  rows.push({ t: u.t, n: u.n, sec: u.sec, ind: u.ind, ctry: nas[u.t]?.ctry || 'USA', ex: b.ex, idx: ['S&P 500', ...(DJIA.has(u.t) ? ['DJIA'] : [])], mc, ...fund, ...tech });
}
const out = {
  app: 'Converge', kind: 'scanner', generatedAt: new Date().toISOString(), barsAsOf: cache.asOf,
  universe: 'S&P 500', count: rows.length, fundamentals: secOk, quarter,
  sources: ['S&P 500 constituents (datasets/s-and-p-500-companies)', 'Yahoo Finance (daily bars, live prices)', 'Nasdaq screener (volume, market cap, country)', ...(secOk ? ['SEC EDGAR XBRL frames (fundamentals)'] : [])],
  rows, errors: errors.slice(0, 30)
};
fs.writeFileSync(path.join(OUT, 'scanner.json'), JSON.stringify(out));
console.log(`scanner: ${rows.length} rows, fundamentals=${secOk}, ${errors.length} errors, ${Math.round((Date.now() - t0) / 1000)}s`);
if (rows.length < 50) process.exit(1);
