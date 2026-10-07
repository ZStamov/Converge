// Offline test for fetch-scanner.mjs with synthetic responses (local testing only).
const DAY = 86400000;
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const syms = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'XOM', 'KO', 'BRK.B', 'TSLA', 'AMD', 'WMT', 'LLY', 'PFE'];
const sectors = ['Information Technology', 'Information Technology', 'Information Technology', 'Financials', 'Energy', 'Consumer Staples', 'Financials', 'Consumer Discretionary', 'Information Technology', 'Consumer Staples', 'Health Care', 'Health Care'];
let csv = 'Symbol,Security,GICS Sector,GICS Sub-Industry,Headquarters Location,Date added,CIK,Founded\n';
syms.forEach((s, i) => { csv += `${s},${s} Corp,${sectors[i]},"Sub, ${i % 3}","City, ST",2000-01-01,${1000 + i},1990\n`; });
function chart(sym) {
  const ts = [], c = [], h = [], l = [], v = []; let p = 50 + rnd() * 400; const drift = (rnd() - 0.45) * 0.004;
  for (let d = 365; d >= 0; d--) {
    const day = new Date(Date.now() - d * DAY); if ([0, 6].includes(day.getUTCDay())) continue;
    p *= 1 + drift + (rnd() - 0.5) * 0.03; ts.push(Math.floor(day.getTime() / 1000)); c.push(p); h.push(p * (1 + rnd() * 0.02)); l.push(p * (1 - rnd() * 0.02)); v.push(Math.round(1e6 + rnd() * 9e6));
  }
  return { chart: { result: [{ meta: { exchangeName: sym === 'JPM' || sym === 'XOM' ? 'NYQ' : 'NMS' }, timestamp: ts, indicators: { quote: [{ close: c, high: h, low: l, volume: v }] } }] } };
}
const frames = (tag) => ({ data: syms.map((s, i) => ({ cik: 1000 + i, val: tag.includes('PerShare') ? 2 + i * 0.7 : tag.includes('Equity') ? 5e10 + i * 1e9 : 1e10 * (1 + i / 3) })) });
globalThis.fetch = async (url) => {
  const u = decodeURIComponent(String(url));
  const ok = (b, j) => ({ ok: true, status: 200, json: async () => b, text: async () => (j ? JSON.stringify(b) : b) });
  if (u.includes('constituents.csv')) return ok(csv);
  if (u.includes('/v8/finance/chart/')) return ok(chart(u.split('/chart/')[1].split('?')[0]), true);
  if (u.includes('/v7/finance/spark')) {
    const list = u.match(/symbols=([^&]+)/)[1].split(',');
    return ok({ spark: { result: list.map((s) => ({ symbol: s, response: [{ meta: { regularMarketPrice: 100 + rnd() * 50, regularMarketTime: Math.floor(Date.now() / 1000), regularMarketVolume: 5e6 } }] })) } }, true);
  }
  if (u.includes('api.nasdaq.com')) return ok({ data: { rows: syms.map((s) => ({ symbol: s.replace('.', '/'), marketCap: String(Math.round(1e10 + rnd() * 3e12)), volume: '4000000', country: 'United States', lastsale: '$120.00' })) } }, true);
  if (u.includes('/frames/')) return ok(frames(u.split('/frames/us-gaap/')[1]), true);
  return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};
const real = globalThis.setTimeout; globalThis.setTimeout = (f, ms, ...a) => real(f, 0, ...a);
process.argv[2] = 'tmp-mock';
await import('../fetch-scanner.mjs');
