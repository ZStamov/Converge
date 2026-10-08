// Minute quotes for every US-listed stock and ETF (Nasdaq last-sale prices) plus the major indexes (Yahoo).
// Runs as a loop inside one GitHub Actions job: every minute it writes q/<YYYYMMDDHHmm>.json (UTC minute) and
// force-pushes the `quotes` branch. A new file name each minute sidesteps the 5-minute cache on raw.githubusercontent.com.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = path.resolve(process.argv[2] || 'quotes-out');
const UNTIL = Date.now() + (+process.argv[3] || 3480) * 1000; // stop after ~58 minutes; the next hourly job takes over
const PUSH = process.argv[4] !== 'nopush';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const NH = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => { const x = +String(s ?? '').replace(/[^0-9.\-]/g, ''); return String(s ?? '').trim() === '' || !isFinite(x) ? null : x; };
const IDX = { SPX: '^GSPC', NDX: '^NDX', DJI: '^DJI', IXIC: '^IXIC', RUT: '^RUT', VIX: '^VIX' };
fs.mkdirSync(path.join(DIR, 'q'), { recursive: true });

async function get(url, headers, ms = 25000) { const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); }
const ysym = (t) => IDX[t] || t.replace('.', '-');
// ---- universe: every symbol in the directory; "hot" ones refresh every minute, the rest in rotation
const POPULAR_ETF = ['SPY', 'QQQ', 'DIA', 'IWM', 'VOO', 'VTI', 'IVV', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'SMH', 'GLD', 'SLV', 'TLT', 'HYG', 'LQD', 'EEM', 'EFA', 'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB', 'XLRE', 'XLC', 'ARKK', 'SCHD', 'JEPI', 'VUG', 'VTV', 'IBIT', 'UVXY', 'KRE', 'XBI', 'GDX'];
let all = [], hot = [];
try {
  const sym = await get('https://raw.githubusercontent.com/' + (process.env.GITHUB_REPOSITORY || 'ZStamov/Converge') + '/history/symbols.json', { 'User-Agent': UA }, 60000);
  const tracked = (() => { try { return JSON.parse(fs.readFileSync(new URL('../config/universe.json', import.meta.url))).tickers; } catch { return []; } })();
  all = sym.rows.map((r) => r[0]);
  const hs = new Set([...tracked, ...Object.keys(IDX), ...POPULAR_ETF, ...sym.rows.filter((r) => r[3]).map((r) => r[0]), ...sym.rows.filter((r) => ['NASDAQ', 'NYSE', 'NYSE American'].includes(r[2])).slice(0, 700).map((r) => r[0])]);
  hot = [...hs];
} catch (e) { console.log('directory unavailable:', e.message); hot = Object.keys(IDX).concat(POPULAR_ETF); }
const cold = all.filter((t) => !hot.includes(t));
let coldPos = 0, coldPerMin = 1000, backoff = 0;
const Q = {}; // carried between minutes: last known [price, change%, unix time]
// start from Nasdaq's end-of-day table so every symbol has a price before the rotation reaches it
async function baseline() {
  for (const ex of ['nasdaq', 'nyse', 'amex']) {
    try { const j = await get(`https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&exchange=${ex}&download=true`, NH); for (const r of j?.data?.rows || []) { const t = String(r.symbol || '').trim().replace('/', '.'); const p = num(r.lastsale), c = num(r.pctchange); if (p != null && !Q[t]) Q[t] = [p, c == null ? null : +c.toFixed(3), 0]; } } catch (e) { console.log('baseline', ex, e.message); }
  }
  try { const j = await get('https://api.nasdaq.com/api/screener/etf?tableonly=true&limit=10000&offset=0&download=true', NH); for (const r of j?.data?.data?.rows || j?.data?.rows || []) { const t = String(r.symbol || '').trim().replace('/', '.'); const p = num(r.lastSalePrice), c = num(r.percentageChange); if (p != null && !Q[t]) Q[t] = [p, c == null ? null : +c.toFixed(3), 0]; } } catch (e) { console.log('baseline etf', e.message); }
}
async function spark(list) {
  let ok = 0, fail = 0, limited = 0, i = 0;
  const chunks = []; for (let k = 0; k < list.length; k += 20) chunks.push(list.slice(k, k + 20));
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < chunks.length) {
      const ch = chunks[i++];
      try {
        const j = await get(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${ch.map((t) => encodeURIComponent(ysym(t))).join(',')}&range=1d&interval=1d`, { 'User-Agent': UA }, 15000);
        for (const r of j?.spark?.result || []) {
          const m = r.response?.[0]?.meta; if (!m || m.regularMarketPrice == null) continue;
          const t = ch.find((x) => ysym(x) === r.symbol) || r.symbol, pc = m.chartPreviousClose ?? m.previousClose;
          Q[t] = [+(+m.regularMarketPrice).toFixed(4), pc ? +((m.regularMarketPrice / pc - 1) * 100).toFixed(3) : null, m.regularMarketTime || 0]; ok++;
        }
      } catch (e) { fail++; if (e.status === 429) limited++; }
    }
  }));
  return { ok, fail, limited };
}
async function snapshot() {
  const errs = [];
  const take = backoff > 0 ? [] : cold.slice(coldPos, coldPos + coldPerMin); coldPos = coldPos + take.length >= cold.length ? 0 : coldPos + take.length;
  const r1 = await spark(hot), r2 = take.length ? await spark(take) : { ok: 0, fail: 0, limited: 0 };
  const limited = r1.limited + r2.limited;
  if (limited) { backoff = 3; coldPerMin = Math.max(200, Math.round(coldPerMin * 0.6)); errs.push(`rate-limited ${limited}x, rotation now ${coldPerMin}/min`); }
  else { if (backoff > 0) backoff--; coldPerMin = Math.min(1500, coldPerMin + 50); }
  if (r1.fail + r2.fail) errs.push(`${r1.fail + r2.fail} batch errors`);
  const q = {}; let n = 0; for (const [t, v] of Object.entries(Q)) { q[t] = v[2] ? v : [v[0], v[1]]; n++; }
  return { q, n, errs, live: r1.ok + r2.ok };
}
await baseline();
console.log(`universe ${all.length}: ${hot.length} every minute, ${cold.length} in rotation; baseline ${Object.keys(Q).length}`);
const key = (d) => d.toISOString().slice(0, 16).replace(/[-:T]/g, ''); // YYYYMMDDHHmm
let rounds = 0;
while (Date.now() < UNTIL) {
  const start = Date.now(), now = new Date();
  const { q, n, errs, live } = await snapshot();
  if (n > 1000) {
    const k = key(now), body = JSON.stringify({ app: 'Converge', kind: 'quotes', at: now.toISOString(), minute: k, source: 'Yahoo Finance (live; S&P 500, popular ETFs and indexes every minute, others in rotation), Nasdaq end-of-day as fallback', n, live, q });
    fs.writeFileSync(path.join(DIR, 'q', k + '.json'), body);
    const hq = {}; for (const t of hot) if (q[t]) hq[t] = q[t];
    fs.mkdirSync(path.join(DIR, 'h'), { recursive: true });
    fs.writeFileSync(path.join(DIR, 'h', k + '.json'), JSON.stringify({ app: 'Converge', kind: 'quotes', at: now.toISOString(), minute: k, hot: true, n: Object.keys(hq).length, q: hq }));
    { const hf = fs.readdirSync(path.join(DIR, 'h')).sort(); for (const f of hf.slice(0, Math.max(0, hf.length - 15))) fs.unlinkSync(path.join(DIR, 'h', f)); }
    fs.writeFileSync(path.join(DIR, 'latest.json'), JSON.stringify({ minute: k, at: now.toISOString(), n }));
    // keep the last 15 minutes
    const files = fs.readdirSync(path.join(DIR, 'q')).sort(); for (const f of files.slice(0, Math.max(0, files.length - 15))) fs.unlinkSync(path.join(DIR, 'q', f));
    if (PUSH) {
      try {
        execFileSync('bash', ['-c', `cd "${DIR}" && rm -rf .git && git init -q -b quotes && git config user.name converge-bot && git config user.email 41898282+github-actions[bot]@users.noreply.github.com && git add -A && git commit -qm "Quotes ${k}" && git push -qf "https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git" quotes`], { stdio: 'inherit' });
      } catch (e) { console.log('push failed', e.message); }
    }
    rounds++; console.log(`${k}: ${n} quotes, ${live} live${errs.length ? ' · ' + errs.join(' | ') : ''} · ${Math.round((Date.now() - start) / 1000)}s`);
  } else console.log(`${key(now)}: only ${n} quotes, skipped · ${errs.join(' | ')}`);
  // wait for the next minute boundary
  const next = Math.ceil((Date.now() + 1000) / 60000) * 60000 + 2000;
  await sleep(Math.max(1000, next - Date.now()));
}
console.log('done after', rounds, 'minutes');
