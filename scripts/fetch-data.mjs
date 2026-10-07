// Converge data pipeline. Runs on a schedule in GitHub Actions and writes
//   <out>/market.json   – everything the app shows
//   <out>/history.json  – state carried between runs (source calls, last grades)
// Free sources only: Yahoo Finance chart API (Stooq CSV fallback), Google News RSS,
// Yahoo Finance RSS, SEC EDGAR submissions + XBRL company facts.
import fs from 'node:fs';
import path from 'node:path';
import * as A from './lib/analyze.mjs';
import * as N from './lib/narrate.mjs';

const OUT = path.resolve(process.argv[2] || 'data-out');
fs.mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(new URL('../config/universe.json', import.meta.url)));
const REPO = process.env.GITHUB_REPOSITORY || 'converge-app';
const UA_SEC = process.env.SEC_USER_AGENT || 'Converge ZStamov@users.noreply.github.com';
const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const errors = [];

async function get(url, { headers = {}, type = 'text', tries = 3 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA_WEB, ...headers }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
      if (!res.ok) { const e = new Error('HTTP ' + res.status); e.fatal = true; throw e; }
      return type === 'json' ? await res.json() : await res.text();
    } catch (e) { last = e; if (e.fatal) break; await sleep(800 * (i + 1)); }
  }
  throw last;
}

// ---- prices ----
async function yahooSeries(t) {
  const out = [];
  for (const host of ['query1', 'query2']) {
    try {
      const j = await get(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1y&interval=1d&includePrePost=false`, { type: 'json' });
      const r = j?.chart?.result?.[0]; if (!r) continue;
      const ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || [];
      const d = [], c = [];
      ts.forEach((x, i) => { if (cl[i] != null) { d.push(A.isoDay(x * 1000)); c.push(+cl[i].toFixed(4)); } });
      const live = r.meta?.regularMarketPrice;
      const liveDay = r.meta?.regularMarketTime ? A.isoDay(r.meta.regularMarketTime * 1000) : null;
      if (live && liveDay) { if (d.at(-1) === liveDay) c[c.length - 1] = live; else if (liveDay > d.at(-1)) { d.push(liveDay); c.push(live); } }
      if (c.length > 30) return { d, c, src: 'Yahoo Finance', name: r.meta?.longName || r.meta?.shortName, asOf: r.meta?.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : null };
    } catch (e) { out.push(host + ': ' + e.message); }
  }
  throw new Error(out.join('; ') || 'no data');
}
// extra ranges for charts: intraday (1D/1W), weekly 5 years, monthly full history
async function chartRaw(t, range, interval) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=${range}&interval=${interval}&includePrePost=false`, { type: 'json' });
  const r = j?.chart?.result?.[0]; if (!r) throw new Error('no data');
  const ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || [];
  const tt = [], c = [];
  ts.forEach((x, i) => { if (cl[i] != null) { tt.push(x); c.push(+cl[i].toFixed(2)); } });
  return { tt, c };
}
async function extraSeries(t) {
  const out = {};
  try { const a = await chartRaw(t, '5d', '15m'); out.intra = { t: a.tt, c: a.c }; } catch (e) { errors.push(`intraday ${t}: ${e.message}`); }
  try { const a = await chartRaw(t, '5y', '1wk'); out.w5 = { d: a.tt.map((x) => A.isoDay(x * 1000)), c: a.c }; } catch (e) { errors.push(`5y ${t}: ${e.message}`); }
  try { const a = await chartRaw(t, 'max', '1mo'); out.max = { d: a.tt.map((x) => A.isoDay(x * 1000)), c: a.c }; } catch (e) { errors.push(`max ${t}: ${e.message}`); }
  return out;
}
async function stooqSeries(t) {
  const csv = await get(`https://stooq.com/q/d/l/?s=${t.toLowerCase().replace('.', '-')}.us&i=d`);
  const rows = csv.trim().split('\n').slice(1).map((l) => l.split(','));
  const cut = A.isoDay(Date.now() - 370 * A.DAY);
  const d = [], c = [];
  for (const r of rows) if (r[0] >= cut && isFinite(+r[4])) { d.push(r[0]); c.push(+r[4]); }
  if (c.length < 30) throw new Error('stooq: too few rows');
  return { d, c, src: 'Stooq', asOf: d.at(-1) + 'T21:00:00Z' };
}
async function prices(t) {
  try { return await yahooSeries(t); } catch (e) {
    errors.push(`prices ${t} yahoo: ${e.message}`);
    return await stooqSeries(t);
  }
}

// ---- news ----
function relevant(t, title, name) {
  const al = [...(cfg.companies?.[t]?.aliases || [name.split(/[ ,.]/)[0]]), ...(t.length >= 3 ? [t] : [])];
  return al.some((a) => {
    const re = a.length <= 4 && a === a.toUpperCase() ? new RegExp(`(^|[^A-Za-z])\\$?${a}([^A-Za-z]|$)`) : new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i');
    return re.test(title);
  });
}
// source health, reported in market.json and shown in the app's Settings
const SRC = {};
const srcHit = (k, n) => { const x = (SRC[k] ||= { ok: 0, fail: 0, items: 0 }); x.ok++; x.items += n; };
const srcFail = (k) => { (SRC[k] ||= { ok: 0, fail: 0, items: 0 }).fail++; };

function gnewsItems(xml, via, forceSource) {
  const out = [];
  for (const it of A.parseRss(xml)) {
    let title = it.title, source = it.source;
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    else { const m = title.match(/^(.*) - ([^-]{2,60})$/); if (m) { title = m[1]; source ||= m[2]; } }
    out.push({ title, source: forceSource || source || 'Google News', url: it.link, pub: it.pubDate, via });
  }
  return out;
}
// CNBC publishes section feeds (not per ticker); fetched once and matched by company name
const CNBC_FEEDS = { 'Top News': 100003114, Markets: 20910258, Earnings: 15839135, Investing: 15839069, Technology: 19854910, Finance: 10000664 };
let cnbcPool = null;
async function cnbcItems() {
  if (cnbcPool) return cnbcPool;
  cnbcPool = [];
  for (const [label, id] of Object.entries(CNBC_FEEDS)) {
    try {
      const xml = await get(`https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=${id}`);
      const items = A.parseRss(xml).map((it) => ({ title: it.title, source: 'CNBC', url: it.link, pub: it.pubDate, via: 'CNBC RSS · ' + label }));
      cnbcPool.push(...items); srcHit('CNBC RSS', items.length);
    } catch (e) { srcFail('CNBC RSS'); errors.push(`cnbc ${label}: ${e.message}`); }
    await sleep(200);
  }
  return cnbcPool;
}
async function newsFor(t, name) {
  const items = [];
  const short = name.replace(/,? (Inc|Corp|Corporation|Co|Company|Ltd|Holdings|Platforms|Incorporated)\.?$/i, '');
  const q = encodeURIComponent(`"${short}" OR ${t} stock`);
  const gq = [
    ['Google News', `${q}+when:30d`, null],
    ['Reuters', `${encodeURIComponent(`"${short}" site:reuters.com`)}+when:30d`, 'Reuters'],
    ['CNBC', `${encodeURIComponent(`"${short}" site:cnbc.com`)}+when:30d`, 'CNBC']
  ];
  for (const [label, query, force] of gq) {
    try {
      const got = gnewsItems(await get(`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`), label === 'Google News' ? 'Google News' : label + ' via Google News', force);
      items.push(...got); srcHit(label === 'Google News' ? 'Google News' : label, got.length);
    } catch (e) { srcFail(label); errors.push(`news ${t} ${label}: ${e.message}`); }
    await sleep(250);
  }
  try {
    const xml = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${t}&region=US&lang=en-US`);
    const got = A.parseRss(xml).map((it) => ({ title: it.title, source: A.sourceFromUrl(it.link), url: it.link, pub: it.pubDate, via: 'Yahoo Finance RSS' }));
    items.push(...got); srcHit('Yahoo Finance', got.length);
  } catch (e) { srcFail('Yahoo Finance'); errors.push(`news ${t} yahoo: ${e.message}`); }
  items.push(...(await cnbcItems()));
  return items
    .filter((x) => x.title && x.pub && !isNaN(Date.parse(x.pub)) && relevant(t, x.title, name))
    .map((x) => {
      const date = new Date(Date.parse(x.pub)).toISOString();
      const s = A.scoreSentiment(x.title);
      return { id: A.hashStr(t + '|' + x.title.toLowerCase()), t, title: x.title, source: x.source, url: x.url, date, kind: A.classifyKind(x.title, x.source), sent: s.sent, score: s.score, via: x.via };
    });
}

// ---- Stocktwits crowd sentiment (public stream API) ----
async function crowdFor(t) {
  try {
    const j = await get(`https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(t)}.json`, { type: 'json' });
    const msgs = j?.messages || [];
    let bull = 0, bear = 0;
    for (const m of msgs) { const s = m?.entities?.sentiment?.basic; if (s === 'Bullish') bull++; else if (s === 'Bearish') bear++; }
    const times = msgs.map((m) => Date.parse(m.created_at)).filter(isFinite).sort((a, b) => a - b);
    const spanH = times.length > 1 ? (times.at(-1) - times[0]) / 3600000 : null;
    srcHit('Stocktwits', msgs.length);
    return {
      bull, bear, tagged: bull + bear, n: msgs.length,
      bullPct: bull + bear ? Math.round(bull / (bull + bear) * 100) : null,
      perHour: spanH ? A.round(msgs.length / Math.max(spanH, 0.25), 1) : null,
      watchers: j?.symbol?.watchlist_count ?? null,
      url: `https://stocktwits.com/symbol/${t}`
    };
  } catch (e) { srcFail('Stocktwits'); errors.push(`stocktwits ${t}: ${e.message}`); return null; }
}

// ---- SEC ----
let tickerMap = null;
async function cikFor(t) {
  if (!tickerMap) {
    const j = await get('https://www.sec.gov/files/company_tickers.json', { type: 'json', headers: { 'User-Agent': UA_SEC } });
    tickerMap = {}; for (const v of Object.values(j)) tickerMap[v.ticker.toUpperCase()] = { cik: String(v.cik_str).padStart(10, '0'), title: v.title };
  }
  return tickerMap[t.replace('.', '-')] || tickerMap[t];
}
const sec = (url) => get(url, { type: 'json', headers: { 'User-Agent': UA_SEC, 'Accept-Encoding': 'gzip, deflate' } });

// ---------------- main ----------------
const now = new Date();
const today = A.isoDay(now);
const histPath = path.join(OUT, 'history.json');
const hist = fs.existsSync(histPath) ? JSON.parse(fs.readFileSync(histPath, 'utf8')) : {};
hist.pending ||= []; hist.resolved ||= []; hist.lastGrades ||= {}; hist.quantLog ||= []; hist.seen ||= {};

const series = {}, names = {}, meta = {};
for (const t of [cfg.benchmark, ...cfg.tickers]) {
  try { const s = await prices(t); series[t] = s; names[t] = s.name; log('prices', t, s.c.length, s.src); }
  catch (e) { errors.push(`prices ${t}: ${e.message}`); log('prices FAILED', t, e.message); }
  await sleep(250);
}
const bench = series[cfg.benchmark];

const allNews = [];
const tickers = {};
for (const t of cfg.tickers) {
  const s = series[t];
  if (!s) continue;
  let cik = null, fund = null, filings = [];
  try {
    const conf = cfg.companies?.[t];
    const ref = conf?.cik ? { cik: String(conf.cik).padStart(10, '0'), title: null } : await cikFor(t);
    await sleep(150);
    if (ref) {
      cik = ref.cik; if (ref.title) names[t] ||= ref.title;
      try { filings = A.filingsFromSubmissions(await sec(`https://data.sec.gov/submissions/CIK${cik}.json`), cik, A.isoDay(now - 30 * A.DAY)); srcHit('SEC EDGAR', filings.length); } catch (e) { srcFail('SEC EDGAR'); errors.push(`filings ${t}: ${e.message}`); }
      await sleep(150);
      try { fund = A.fundamentalsFromFacts(await sec(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`)); } catch (e) { errors.push(`facts ${t}: ${e.message}`); }
      await sleep(150);
    }
  } catch (e) { errors.push(`cik ${t}: ${e.message}`); }
  const name = names[t] || t;
  const news = await newsFor(t, name); await sleep(300);
  const crowd = await crowdFor(t); await sleep(400);
  const ext = await extraSeries(t); await sleep(200);
  allNews.push(...news);
  meta[t] = { cik, fund, filings, name, crowd, ext };
  log('ticker', t, 'news', news.length, 'filings', filings.length, 'fund', fund ? fund.fy : '-');
}

// dedupe exact repeats across sources
const byId = new Map(); for (const n of allNews) if (!byId.has(n.id)) byId.set(n.id, n);
const news = [...byId.values()];

// ---- source track record ----
const H = cfg.accuracyHorizonDays;
const known = new Set([...hist.pending.map((x) => x.key), ...hist.resolved.map((x) => x.key)]);
for (const n of news) {
  if (!n.sent || !n.source) continue;
  const key = n.source + '|' + n.id;
  if (known.has(key)) continue;
  known.add(key);
  hist.pending.push({ key, source: n.source, t: n.t, date: n.date.slice(0, 10), sent: n.sent, title: n.title.slice(0, 140) });
}
if (bench) {
  const { resolved, stillPending } = A.resolveCalls(hist.pending, series, bench, H);
  hist.resolved.push(...resolved);
  hist.pending = stillPending.filter((p) => p.date >= A.isoDay(now - 60 * A.DAY));
}
hist.resolved = hist.resolved.filter((r) => r.date >= A.isoDay(now - 400 * A.DAY)).slice(-20000);
const stats = A.sourceStats(hist.resolved, cfg.minCallsForRating);

// ---- clusters ----
const cap = cfg.maxStoriesPerTicker || 60, perT = {};
const clusters = A.clusterNews(news)
  .filter((c) => c.date >= A.isoDay(now - cfg.newsWindowDays * A.DAY))
  .filter((c) => (perT[c.t] = (perT[c.t] || 0) + 1) <= cap);

// ---- per ticker analytics ----
const alerts = [], quantChanges = [];
for (const t of cfg.tickers) {
  const s = series[t]; if (!s) continue;
  const m = meta[t] || {};
  const c = s.c, end = c.length - 1;
  const grades = A.gradeSet(c, end, m.fund);
  const comp = A.composite(grades);
  const qs = A.quantSeries(s, m.fund);
  const sv = qs.map((p) => p.s).filter((x) => x != null);
  const quant = { score: comp, series: qs, high6m: sv.length > 4 && comp >= Math.max(...sv.slice(0, -1)), low6m: sv.length > 4 && comp <= Math.min(...sv.slice(0, -1)) };
  const chg5d = A.retOver(c, end, 5), chg1m = A.retOver(c, end, 21);
  const sent = A.sentimentFor(t, clusters, stats, grades, comp, s, today, cfg.newsWindowDays, m.crowd);
  const div = A.divergenceFor(t, m.name, chg5d == null ? null : chg5d * 100, quant, sent);
  if (div) alerts.push({ ...div, date: now.toISOString() });

  const prev = hist.lastGrades[t] || {};
  for (const [k, g] of Object.entries(grades)) {
    if (prev[k] && prev[k] !== g.g) hist.quantLog.push({ t, factor: g.label, from: prev[k], to: g.g, v: g.v, date: now.toISOString() });
  }
  hist.lastGrades[t] = Object.fromEntries(Object.entries(grades).map(([k, g]) => [k, g.g]));

  tickers[t] = {
    t, name: m.name, price: A.round(c[end], 2), prevClose: A.round(c[end - 1], 2),
    changePct: A.round((c[end] / c[end - 1] - 1) * 100, 2), chg5d: A.round(chg5d * 100, 2), chg1m: A.round(chg1m * 100, 2),
    asOf: s.asOf, priceSource: s.src,
    hist: { d: s.d, c: s.c.map((x) => A.round(x, 2)) }, intra: m.ext?.intra || null, w5: m.ext?.w5 || null, max: m.ext?.max || null,
    grades, quant, fundamentals: m.fund, sentiment: sent, filings: m.filings || [], cik: m.cik, crowd: m.crowd || null
  };
}
hist.quantLog = hist.quantLog.filter((q) => q.date >= new Date(now - 30 * A.DAY).toISOString()).slice(-300);

// ---- briefing candidates (client filters to the user's holdings + watchlist) ----
const briefing = [];
const recentCut = new Date(now - 72 * 3600 * 1000).toISOString();
for (const t of Object.keys(tickers)) {
  const T = tickers[t];
  clusters.filter((c) => c.t === t && c.date >= recentCut && c.kind === 'news').sort((a, b) => b.merged - a.merged).slice(0, 3).forEach((c) => {
    const tone = c.sent > 0 ? 'positive' : c.sent < 0 ? 'negative' : 'neutral';
    const why = `${c.source}${c.merged > 1 ? ` and ${c.merged - 1} other report${c.merged > 2 ? 's' : ''}` : ''}. Headline tone: ${tone}.`;
    briefing.push({ id: 'n' + c.id, t, type: 'NEWS', title: c.title, why, date: c.date, url: c.url, source: c.source, merged: c.merged, sent: c.sent });
  });
  T.filings.filter((f) => f.date >= A.isoDay(now - 7 * A.DAY)).slice(0, 2).forEach((f) => {
    const title = `Form ${f.form} filed: ${f.desc}`;
    briefing.push({ id: 'f' + A.hashStr(t + f.url), t, type: 'SEC FILING', title, why: `Filed with the SEC on ${f.date}.`, date: f.date + 'T12:00:00Z', url: f.url, form: f.form, items: f.desc.includes(': ') ? f.desc.split(': ')[1] : '' });
  });
}
for (const q of hist.quantLog.filter((q) => q.date >= new Date(now - 7 * A.DAY).toISOString())) {
  const title = `${q.factor} grade ${q.from} → ${q.to}`;
  briefing.push({ id: 'q' + A.hashStr(q.t + q.factor + q.date), t: q.t, type: 'QUANT', title, why: `Now ${q.v}.`, date: q.date, factor: q.factor, from: q.from, to: q.to, v: q.v });
  quantChanges.push(q);
}
for (const a of alerts) briefing.push({ id: 'a' + a.t + a.type, t: a.t, type: 'DIVERGENCE', title: a.title, why: a.text, date: a.date, text: a.text });
briefing.sort((a, b) => b.date.localeCompare(a.date));
// spoken script for each item (neural voice clips are rendered from this in CI)
const tickerNames = Object.fromEntries(cfg.tickers.map((t) => [t, N.spokenName(t, cfg, names[t])]));
const nctx = { name: (t) => tickerNames[t] || t, tickerNames };
for (const b of briefing) { b.say = N.narrate(b, nctx); b.sec = A.speakSec(b.say); }

// ---- source table (only what the app needs) ----
const sources = {};
for (const [k, v] of Object.entries(stats)) sources[k] = { calls: v.calls, correct: v.correct, acc: v.acc, rated: v.rated, recent: v.recent };
const ratedAcc = Object.values(sources).filter((s) => s.rated).map((s) => s.acc).sort((a, b) => b - a);
const topCut = ratedAcc.length ? ratedAcc[Math.max(0, Math.floor(ratedAcc.length / 3) - 1)] : null;

const market = {
  app: 'Converge', version: 1, generatedAt: now.toISOString(),
  universe: cfg.tickers.filter((t) => tickers[t]).map((t) => ({ t, name: tickers[t].name })),
  benchmark: bench ? { t: cfg.benchmark, price: A.round(bench.c.at(-1), 2), chg5d: A.round(A.retOver(bench.c, bench.c.length - 1, 5) * 100, 2), hist: { d: bench.d, c: bench.c.map((x) => A.round(x, 2)) } } : null,
  tickers,
  news: clusters.map(({ members, via, ...c }) => c),
  alerts, quantChanges, briefing: briefing.slice(0, 80), briefingVoice: { intro: N.INTRO, outro: N.OUTRO },
  sources, topPerformerCut: topCut,
  method: {
    accuracyHorizonDays: H, minCallsForRating: cfg.minCallsForRating,
    sentimentWeights: { news: 35, quant: 30, crowd: 20, trend: 15 },
    sources: ['Reuters (via Google News)', 'CNBC (RSS and via Google News)', 'Yahoo Finance (prices, RSS)', 'Google News RSS', 'Stocktwits (crowd sentiment)', 'SEC EDGAR (filings, fundamentals)'],
    sourceStatus: SRC,
    linkedOnly: ['Finviz', 'StockAnalysis', 'X']
  },
  errors: errors.slice(0, 50)
};

fs.writeFileSync(path.join(OUT, 'market.json'), JSON.stringify(market));
fs.writeFileSync(histPath, JSON.stringify(hist));
log(`done: ${Object.keys(tickers).length} tickers, ${clusters.length} stories, ${alerts.length} alerts, ${Object.keys(sources).length} sources (${ratedAcc.length} rated), ${errors.length} errors`);
if (Object.keys(tickers).length === 0) { console.error('No ticker data — aborting so the previous data stays live.'); process.exit(1); }
