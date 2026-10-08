// Probe: shape of Nasdaq's ETF screener and Yahoo index symbols (prints a short sample).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const NH = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
async function show(label, url, headers) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }); const t = await r.text();
    console.log(`== ${label} HTTP ${r.status} ${t.length} bytes`);
    try { const j = JSON.parse(t); console.log(JSON.stringify(j, (k, v) => Array.isArray(v) && v.length > 3 ? [...v.slice(0, 3), `…(${v.length})`] : v).slice(0, 1500)); } catch { console.log(t.slice(0, 500)); }
  } catch (e) { console.log(`== ${label} ERROR ${e.message}`); }
}
await show('etf screener', 'https://api.nasdaq.com/api/screener/etf?tableonly=true&limit=10000&offset=0&download=true', NH);
for (const s of ['^GSPC', '^SPX', '^NDX', '^DJI', '^RUT', '^VIX', '^IXIC', 'SPY']) await show('yahoo ' + s, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=5d&interval=1d`, { 'User-Agent': UA });
