// Offline test harness: replaces fetch with synthetic responses shaped like the real
// sources, then runs the pipeline into ./tmp-mock. Used only for local testing.
import fs from 'node:fs';
const DAY = 86400000;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function chart(t) {
  const ts = [], cl = []; let p = 100 + (t.charCodeAt(0) % 50) * 3;
  const start = Date.now() - 365 * DAY;
  for (let d = 0; d < 365; d++) {
    const day = new Date(start + d * DAY); if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    p *= 1 + (rnd() - 0.48) * 0.03; ts.push(Math.floor(day.getTime() / 1000) + 72000); cl.push(+p.toFixed(2));
  }
  if (t === 'NVDA') for (let i = cl.length - 5; i < cl.length; i++) cl[i] = +(cl[i - 1] * 0.985).toFixed(2);
  return { chart: { result: [{ meta: { regularMarketPrice: cl.at(-1), regularMarketTime: ts.at(-1), longName: t + ' Holdings Inc.' }, timestamp: ts, indicators: { quote: [{ close: cl }] } }] } };
}
const heads = ['{t} beats estimates as revenue jumps', '{t} shares fall after analyst downgrade', 'Is {t} a buy right now?', '{t} announces new buyback program', '{t} faces antitrust probe in Europe', '{t} stock rises on record demand', 'Analyst raises price target on {t}', '{t} warns of slowdown in key market'];
const srcs = ['Reuters', 'CNBC', 'The Motley Fool', 'Bloomberg', 'MarketWatch', 'Zacks', 'Barron\'s'];
function gnews(t) {
  let items = '';
  for (let i = 0; i < 40; i++) {
    const h = heads[i % heads.length].replace('{t}', t) + (i > 8 ? ' ' + i : '');
    const s = srcs[i % srcs.length];
    const d = new Date(Date.now() - i * 0.7 * DAY).toUTCString();
    items += `<item><title>${h} - ${s}</title><link>https://news.google.com/rss/articles/x${i}</link><pubDate>${d}</pubDate><description>&lt;a&gt;x&lt;/a&gt;</description><source url="https://example.com">${s}</source></item>`;
  }
  return `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
}
function yrss(t) {
  return `<rss><channel><item><title><![CDATA[${t} beats estimates as revenue jumps]]></title><link>https://finance.yahoo.com/news/x.html</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
}
const tickersJson = { 0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' }, 1: { cik_str: 1045810, ticker: 'NVDA', title: 'NVIDIA CORP' }, 2: { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' } };
const sub = { filings: { recent: { form: ['8-K', '4', '10-Q', '4', '4', '4'], filingDate: [0, 1, 3, 4, 5, 6].map((n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10)), accessionNumber: Array(6).fill('0000320193-26-000001'), primaryDocument: Array(6).fill('doc.htm'), items: ['2.02,9.01', '', '', '', '', ''] } } };
const facts = { facts: { 'us-gaap': {
  Revenues: { units: { USD: [{ start: '2024-01-01', end: '2024-12-31', val: 380e9, frame: 'CY2024', form: '10-K' }, { start: '2025-01-01', end: '2025-12-31', val: 415e9, frame: 'CY2025', form: '10-K' }] } },
  NetIncomeLoss: { units: { USD: [{ start: '2025-01-01', end: '2025-12-31', val: 105e9, frame: 'CY2025' }] } },
  EarningsPerShareDiluted: { units: { 'USD/shares': [{ start: '2025-01-01', end: '2025-12-31', val: 7.1, frame: 'CY2025' }] } }
} } };

globalThis.fetch = async (url) => {
  const u = String(url);
  const ok = (body, json) => ({ ok: true, status: 200, json: async () => body, text: async () => (json ? JSON.stringify(body) : body) });
  if (u.includes('/v8/finance/chart/') && /range=(5d|5y|max)/.test(u)) {
    const step = u.includes('range=5d') ? 900 : u.includes('range=5y') ? 7 * 86400 : 30 * 86400, n = u.includes('range=5d') ? 130 : u.includes('range=5y') ? 260 : 400;
    const now = Math.floor(Date.now() / 1000), ts = [], cl = []; let p = 50;
    for (let i = n; i > 0; i--) { p *= 1 + (rnd() - 0.47) * 0.02; ts.push(now - i * step); cl.push(+p.toFixed(2)); }
    return ok({ chart: { result: [{ meta: {}, timestamp: ts, indicators: { quote: [{ close: cl }] } }] } }, true);
  }
  if (u.includes('/v8/finance/chart/')) return ok(chart(decodeURIComponent(u.split('/chart/')[1].split('?')[0])), true);
  if (u.includes('news.google.com')) { const d = decodeURIComponent(u); const m = d.match(/OR (\w+) stock/) || d.match(/"([A-Za-z]+)/); return ok(gnews(m ? m[1] : 'AAPL')); }
  if (u.includes('search.cnbc.com')) return ok(gnews('Apple').replace(/ - [^<]+<\/title>/g, '</title>'));
  if (u.includes('api.stocktwits.com')) return ok({ symbol: { watchlist_count: 123456 }, messages: Array.from({ length: 30 }, (_, i) => ({ created_at: new Date(Date.now() - i * 600000).toISOString(), entities: { sentiment: i % 3 ? { basic: 'Bullish' } : i % 2 ? { basic: 'Bearish' } : null } })) }, true);
  if (u.includes('feeds.finance.yahoo.com')) return ok(yrss(u.match(/s=(\w+)/)[1]));
  if (u.includes('company_tickers.json')) return ok(tickersJson, true);
  if (u.includes('/submissions/')) return ok(sub, true);
  if (u.includes('companyfacts')) return ok(facts, true);
  return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};
// speed up: no sleeps
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, 0, ...a);
process.argv[2] = 'tmp-mock';
await import('../fetch-data.mjs');
