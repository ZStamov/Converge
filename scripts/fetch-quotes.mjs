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

async function get(url, headers, ms = 25000) { const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
async function snapshot() {
  const q = {}; let n = 0; const errs = [];
  for (const ex of ['nasdaq', 'nyse', 'amex']) {
    try {
      const j = await get(`https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&exchange=${ex}&download=true`, NH);
      for (const r of j?.data?.rows || []) { const t = String(r.symbol || '').trim().replace('/', '.'); const p = num(r.lastsale), c = num(r.pctchange); if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(t) && p != null) { q[t] = [p, c == null ? null : +c.toFixed(3)]; n++; } }
    } catch (e) { errs.push(ex + ': ' + e.message); }
  }
  try {
    const j = await get('https://api.nasdaq.com/api/screener/etf?tableonly=true&limit=10000&offset=0&download=true', NH);
    for (const r of j?.data?.data?.rows || j?.data?.rows || []) { const t = String(r.symbol || '').trim().replace('/', '.'); const p = num(r.lastSalePrice), c = num(r.percentageChange); if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(t) && p != null && !q[t]) { q[t] = [p, c == null ? null : +c.toFixed(3)]; n++; } }
  } catch (e) { errs.push('etf: ' + e.message); }
  try {
    const j = await get(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${Object.values(IDX).map(encodeURIComponent).join(',')}&range=1d&interval=5m`, { 'User-Agent': UA });
    for (const r of j?.spark?.result || []) { const m = r.response?.[0]?.meta; const t = Object.keys(IDX).find((k) => IDX[k] === r.symbol); if (m && t && m.regularMarketPrice != null) { const pc = m.chartPreviousClose ?? m.previousClose; q[t] = [m.regularMarketPrice, pc ? +((m.regularMarketPrice / pc - 1) * 100).toFixed(3) : null]; n++; } }
  } catch (e) { errs.push('indexes: ' + e.message); }
  return { q, n, errs };
}
const key = (d) => d.toISOString().slice(0, 16).replace(/[-:T]/g, ''); // YYYYMMDDHHmm
let rounds = 0;
while (Date.now() < UNTIL) {
  const start = Date.now(), now = new Date();
  const { q, n, errs } = await snapshot();
  if (n > 1000) {
    const k = key(now), body = JSON.stringify({ app: 'Converge', kind: 'quotes', at: now.toISOString(), minute: k, source: 'Nasdaq last sale (stocks, ETFs), Yahoo Finance (indexes)', n, q });
    fs.writeFileSync(path.join(DIR, 'q', k + '.json'), body);
    fs.writeFileSync(path.join(DIR, 'latest.json'), JSON.stringify({ minute: k, at: now.toISOString(), n }));
    // keep the last 15 minutes
    const files = fs.readdirSync(path.join(DIR, 'q')).sort(); for (const f of files.slice(0, Math.max(0, files.length - 15))) fs.unlinkSync(path.join(DIR, 'q', f));
    if (PUSH) {
      try {
        execFileSync('bash', ['-c', `cd "${DIR}" && rm -rf .git && git init -q -b quotes && git config user.name converge-bot && git config user.email 41898282+github-actions[bot]@users.noreply.github.com && git add -A && git commit -qm "Quotes ${k}" && git push -qf "https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git" quotes`], { stdio: 'inherit' });
      } catch (e) { console.log('push failed', e.message); }
    }
    rounds++; console.log(`${k}: ${n} quotes${errs.length ? ' · ' + errs.join(' | ') : ''} · ${Math.round((Date.now() - start) / 1000)}s`);
  } else console.log(`${key(now)}: only ${n} quotes, skipped · ${errs.join(' | ')}`);
  // wait for the next minute boundary
  const next = Math.ceil((Date.now() + 1000) / 60000) * 60000 + 2000;
  await sleep(Math.max(1000, next - Date.now()));
}
console.log('done after', rounds, 'minutes');
