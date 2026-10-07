// Symbol directory + daily price history for every S&P 500 stock and every Nasdaq-listed stock (no OTC).
// Writes into <dir> (a checkout of the `history` branch):
//   symbols.json  — searchable directory: [ticker, name, exchange, inS&P500, sector, marketCap, price, change%]
//   h/<T>.json    — about 2 years of completed daily bars { t[], o[], h[], l[], c[], v[] } (t = Unix seconds)
// Each run refreshes the directory, backfills missing histories first, then tops up stale ones, within a time budget.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] || 'hist-out');
const BUDGET_S = +(process.argv[3] || 1500);
fs.mkdirSync(path.join(DIR, 'h'), { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(), errors = [];
const left = () => BUDGET_S * 1000 - (Date.now() - t0);

async function get(url, { headers = {}, json = false, tries = 3, timeout = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(timeout) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return json ? await r.json() : await r.text();
    } catch (e) { last = e; if (e.fatal) break; await sleep(1500 * (i + 1)); }
  }
  throw last;
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
const num = (s) => { const x = +String(s ?? '').replace(/[^0-9.\-]/g, ''); return isFinite(x) && String(s ?? '').trim() !== '' ? x : null; };
const yh = (t) => t.replace('.', '-');
const etDay = (sec) => new Date((sec - 4 * 3600) * 1000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- directory
const symPath = path.join(DIR, 'symbols.json');
const prev = fs.existsSync(symPath) ? JSON.parse(fs.readFileSync(symPath, 'utf8')) : null;
const dir = new Map(); // t -> row
let spOk = false, nasOk = false;
try {
  const csv = csvRows(await get('https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'));
  const hd = csv[0], c = (n) => hd.indexOf(n);
  for (const r of csv.slice(1)) { const t = (r[c('Symbol')] || '').trim(); if (t) dir.set(t, { t, n: r[c('Security')], ex: 'NYSE', sp: 1, sec: r[c('GICS Sector')] || '', mc: null, p: null, ch: null }); }
  spOk = dir.size > 400;
} catch (e) { errors.push('sp500: ' + e.message); }
// Nasdaq-listed common stocks (warrants, rights, units, notes and preferreds left out)
const JUNK = /\b(warrants?|rights?|units?|notes? due|subordinated|debentures?|preferred|perpetual|% (series|fixed|senior))\b/i;
const NH = { Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
try {
  const j = await get('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&exchange=nasdaq&download=true', { json: true, headers: NH });
  for (const r of j?.data?.rows || []) {
    const t = String(r.symbol || '').trim().replace('/', '.'); const n = String(r.name || '').trim();
    if (!/^[A-Z]{1,5}(\.[A-Z])?$/.test(t) || JUNK.test(n)) continue;
    const row = dir.get(t) || { t, n: n.replace(/\s+(Common Stock|Ordinary Shares|Class [A-Z] Ordinary Shares|American Depositary Shares|Common Shares|New York Registry Shares|Sponsored ADR).*$/i, '').replace(/\s+-\s*$/, '').trim() || n, sp: 0, sec: r.sector || '' };
    row.ex = 'NASDAQ'; row.mc = num(r.marketCap); row.p = num(r.lastsale); row.ch = num(r.pctchange); if (!row.sec) row.sec = r.sector || '';
    dir.set(t, row);
  }
  nasOk = [...dir.values()].filter((r) => r.ex === 'NASDAQ').length > 1500;
  // prices for the NYSE-listed S&P 500 members from the full table
  const all = await get('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true', { json: true, headers: NH });
  for (const r of all?.data?.rows || []) { const t = String(r.symbol || '').trim().replace('/', '.'); const row = dir.get(t); if (row && row.p == null) { row.mc = num(r.marketCap); row.p = num(r.lastsale); row.ch = num(r.pctchange); } }
} catch (e) { errors.push('nasdaq: ' + e.message); }
if ((!spOk || !nasOk) && prev) { // keep yesterday's directory rather than shrink it
  for (const r of prev.rows) { const t = r[0]; if (!dir.has(t)) dir.set(t, { t, n: r[1], ex: r[2], sp: r[3], sec: r[4], mc: r[5], p: r[6], ch: r[7] }); }
}
const rows = [...dir.values()].sort((a, b) => (b.mc || 0) - (a.mc || 0));
console.log(`directory: ${rows.length} stocks (S&P 500 ${rows.filter((r) => r.sp).length}, Nasdaq-listed ${rows.filter((r) => r.ex === 'NASDAQ').length})`);

// ---------------------------------------------------------------- daily history
async function chart(t, range) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yh(t))}?range=${range}&interval=1d&includePrePost=false`, { json: true });
  const r = j?.chart?.result?.[0]; if (!r) throw new Error('no chart ' + t);
  const q = r.indicators?.quote?.[0] || {}, o = { t: [], o: [], h: [], l: [], c: [], v: [] };
  const rd = (x) => +(x >= 1000 ? x.toFixed(2) : x >= 1 ? x.toFixed(3) : x.toFixed(4));
  (r.timestamp || []).forEach((x, k) => { if (q.close?.[k] != null && q.open?.[k] != null) { o.t.push(x); o.o.push(rd(q.open[k])); o.h.push(rd(q.high[k] ?? q.close[k])); o.l.push(rd(q.low[k] ?? q.close[k])); o.c.push(rd(q.close[k])); o.v.push(q.volume?.[k] || 0); } });
  return o;
}
const spy = await chart('SPY', '1mo');
const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
const afterClose = nowET.getHours() * 60 + nowET.getMinutes() >= 16 * 60 + 20 || [0, 6].includes(nowET.getDay());
const lastDay = etDay(spy.t.at(-1)), todayET = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;
const completed = lastDay === todayET && !afterClose ? etDay(spy.t.at(-2)) : lastDay;
const KEEP = 520;
const fileOf = (t) => path.join(DIR, 'h', t + '.json');
const read = (t) => { try { return JSON.parse(fs.readFileSync(fileOf(t), 'utf8')); } catch { return null; } };
const missing = rows.filter((r) => !fs.existsSync(fileOf(r.t)));
const stale = rows.filter((r) => { const h = read(r.t); return h && h.t.length && etDay(h.t.at(-1)) < completed; });
console.log(`history: completed session ${completed}; ${missing.length} to backfill, ${stale.length} to update`);
let done = 0, filled = 0, updated = 0, failed = 0;
async function work(list, range, merge) {
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < list.length && left() > 60000) {
      const r = list[i++];
      try {
        const b = await chart(r.t, range);
        // completed sessions only
        while (b.t.length && etDay(b.t.at(-1)) > completed) for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) b[k].pop();
        if (b.t.length < 5) throw new Error('too short ' + r.t);
        let out = b;
        if (merge) {
          const old = read(r.t); const cut = old.t.findIndex((x) => x >= b.t[0]);
          const keep = cut < 0 ? old.t.length : cut;
          out = {}; for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) out[k] = old[k].slice(0, keep).concat(b[k]);
        }
        for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) out[k] = out[k].slice(-KEEP);
        fs.writeFileSync(fileOf(r.t), JSON.stringify({ t: out.t, o: out.o, h: out.h, l: out.l, c: out.c, v: out.v }));
        if (merge) updated++; else filled++;
      } catch (e) { failed++; if (errors.length < 40) errors.push(r.t + ': ' + String(e.message).slice(0, 80)); }
      done++; if (done % 250 === 0) console.log(`  ${done} done, ${Math.round((Date.now() - t0) / 1000)}s`);
      await sleep(90);
    }
  }));
}
await work(missing, '2y', false);
await work(stale, '1mo', true);
const have = rows.filter((r) => fs.existsSync(fileOf(r.t))).length;
fs.writeFileSync(symPath, JSON.stringify({
  app: 'Converge', kind: 'symbols', generatedAt: new Date().toISOString(), barsThrough: completed, count: rows.length, withHistory: have,
  cols: ['t', 'n', 'ex', 'sp', 'sec', 'mc', 'p', 'ch'],
  rows: rows.map((r) => [r.t, r.n, r.ex, r.sp ? 1 : 0, r.sec || '', r.mc, r.p, r.ch == null ? null : +r.ch.toFixed(2)])
}));
console.log(`history: +${filled} new, ${updated} updated, ${failed} failed; ${have}/${rows.length} stocks have history; ${Math.round((Date.now() - t0) / 1000)}s`);
if (errors.length) console.log('errors:', errors.slice(0, 15).join(' | '));
if (rows.length < 400) process.exit(1);
