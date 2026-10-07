// Pure analysis helpers for the Converge data pipeline (no network access here).

export const DAY = 86400000;
export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const round = (x, n = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** n) / 10 ** n);

// ---------- RSS ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const stripTags = (s) => decodeEntities(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
export function parseRss(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const srcM = b.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);
    out.push({
      title: stripTags(tag(b, 'title')),
      link: stripTags(tag(b, 'link')),
      pubDate: stripTags(tag(b, 'pubDate')),
      description: stripTags(tag(b, 'description')).slice(0, 400),
      source: srcM ? stripTags(srcM[2]) : '',
      sourceUrl: srcM ? srcM[1] || '' : ''
    });
  }
  return out;
}

const HOSTS = {
  'finance.yahoo.com': 'Yahoo Finance', 'fool.com': 'The Motley Fool', 'seekingalpha.com': 'Seeking Alpha',
  'reuters.com': 'Reuters', 'bloomberg.com': 'Bloomberg', 'cnbc.com': 'CNBC', 'wsj.com': 'The Wall Street Journal',
  'barrons.com': "Barron's", 'marketwatch.com': 'MarketWatch', 'investors.com': "Investor's Business Daily",
  'zacks.com': 'Zacks', 'benzinga.com': 'Benzinga', 'investopedia.com': 'Investopedia', 'thestreet.com': 'TheStreet',
  'businessinsider.com': 'Business Insider', 'forbes.com': 'Forbes', 'ft.com': 'Financial Times', 'apnews.com': 'AP News',
  'investorplace.com': 'InvestorPlace', '247wallst.com': '24/7 Wall St.', 'tipranks.com': 'TipRanks', 'marketbeat.com': 'MarketBeat',
  'simplywall.st': 'Simply Wall St', 'gurufocus.com': 'GuruFocus', 'insidermonkey.com': 'Insider Monkey', 'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge', 'globenewswire.com': 'GlobeNewswire', 'prnewswire.com': 'PR Newswire', 'businesswire.com': 'Business Wire'
};
export function sourceFromUrl(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    for (const k of Object.keys(HOSTS)) if (h === k || h.endsWith('.' + k)) return HOSTS[k];
    return h;
  } catch { return 'Unknown'; }
}

// ---------- text ----------
const STOP = new Set('the a an and or of to in on for with at by from as is are was were be its it this that after before over into amid than vs stock stocks shares share inc corp co ltd company says said new why how what will may could'.split(' '));
export function tokens(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9$%. ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}
export function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let i = 0; for (const x of A) if (B.has(x)) i++;
  const u = A.size + B.size - i;
  return u ? i / u : 0;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

const OPINION_SOURCES = ['motley fool', 'seeking alpha', 'zacks', 'investorplace', '24/7 wall st', 'tipranks', 'marketbeat', 'simply wall st', 'gurufocus', 'insider monkey', 'benzinga', 'the globe and mail', 'forbes', 'investor\'s business daily', 'yahoo finance video'];
export function classifyKind(title, source) {
  const s = String(source).toLowerCase();
  const t = String(title).trim();
  if (OPINION_SOURCES.some((o) => s.includes(o))) return 'analysis';
  if (/\?\s*$/.test(t)) return 'analysis';
  if (/^(is|should|why|how|what|could|can|will|here's|here is|\d+ (reasons|stocks))\b/i.test(t)) return 'analysis';
  if (/\b(buy|sell)\b[^.]*\b(now|today|this (week|month|year))\b|\bstocks? to (buy|watch|own)\b|\bprediction\b|\bmillionaire\b/i.test(t)) return 'analysis';
  return 'news';
}

const BULL = { beat: 2, beats: 2, tops: 2, surge: 2, surges: 2, soar: 2, soars: 2, jump: 1.5, jumps: 1.5, rally: 1.5, rallies: 1.5, gain: 1, gains: 1, rise: 1, rises: 1, climbs: 1, higher: 1, record: 1.5, upgrade: 2, upgrades: 2, upgraded: 2, outperform: 1.5, bullish: 2, strong: 1, strength: 1, growth: 0.5, raises: 1.5, raised: 1, boost: 1, boosts: 1, wins: 1.5, win: 1, approval: 1.5, approved: 1.5, expands: 1, rebound: 1.5, rebounds: 1.5, buyback: 1.5, dividend: 0.5, partnership: 1, breakthrough: 1.5, profit: 0.5, accelerates: 1.5, overweight: 1.5, 'all-time': 1 };
const BEAR = { miss: 2, misses: 2, missed: 2, fall: 1.5, falls: 1.5, fell: 1.5, drop: 1.5, drops: 1.5, plunge: 2.5, plunges: 2.5, tumble: 2, tumbles: 2, sink: 2, sinks: 2, slump: 2, slumps: 2, slide: 1.5, slides: 1.5, lower: 1, decline: 1.5, declines: 1.5, downgrade: 2, downgrades: 2, downgraded: 2, underperform: 1.5, bearish: 2, weak: 1.5, weakness: 1.5, cut: 1, cuts: 1.5, lawsuit: 2, sued: 2, probe: 2, investigation: 2, antitrust: 1.5, recall: 2, fine: 1, fined: 2, ban: 1.5, warns: 2, warning: 1.5, layoffs: 1.5, loss: 1.5, losses: 1.5, risk: 0.5, risks: 0.5, fears: 1.5, concerns: 1, selloff: 2, 'sell-off': 2, crash: 2.5, underweight: 1.5, delay: 1, delays: 1, halts: 1.5, tariff: 1, tariffs: 1, slowdown: 1.5 };
export function scoreSentiment(title) {
  const words = String(title).toLowerCase().replace(/[^a-z\- ]+/g, ' ').split(/\s+/);
  let s = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const neg = i > 0 && /^(not|no|never|fails|without)$/.test(words[i - 1]) ? -1 : 1;
    if (BULL[w]) s += BULL[w] * neg;
    if (BEAR[w]) s -= BEAR[w] * neg;
  }
  if (/price target (raised|increase|hike)|raises price target|lifts price target/i.test(title)) s += 2;
  if (/price target (cut|lowered)|cuts price target|lowers price target/i.test(title)) s -= 2;
  return { score: round(s, 2), sent: s >= 1 ? 1 : s <= -1 ? -1 : 0 };
}

// ---------- prices ----------
export function idxOnOrAfter(series, day) {
  const d = series.d; let lo = 0, hi = d.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (d[m] >= day) { ans = m; hi = m - 1; } else lo = m + 1; }
  return ans;
}
export function idxOnOrBefore(series, day) {
  const d = series.d; let lo = 0, hi = d.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (d[m] <= day) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
export function sma(c, n, end) { if (end + 1 < n) return null; let s = 0; for (let i = end - n + 1; i <= end; i++) s += c[i]; return s / n; }
export function retOver(c, end, n) { const a = end - n; return a >= 0 && c[a] ? c[end] / c[a] - 1 : null; }

// ---------- grades ----------
const PTS = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const ladder = (v, cuts) => { const g = ['A', 'B', 'C', 'D']; for (let i = 0; i < cuts.length; i++) if (v > cuts[i]) return g[i]; return 'F'; };
export function gradeSet(c, end, f) {
  const price = c[end];
  const out = {};
  // Value: trailing P/E on latest fiscal-year diluted EPS
  if (f && f.eps != null) {
    const pe = f.eps > 0 ? price / f.eps : null;
    out.value = { g: pe == null ? 'F' : pe < 15 ? 'A' : pe < 22 ? 'B' : pe < 30 ? 'C' : pe < 45 ? 'D' : 'F', v: pe == null ? 'neg. EPS' : round(pe, 1) + '× P/E', label: 'Value' };
  }
  if (f && f.revGrowth != null) out.growth = { g: ladder(f.revGrowth, [0.2, 0.1, 0.04, 0]), v: (f.revGrowth >= 0 ? '+' : '') + round(f.revGrowth * 100, 1) + '% revenue', label: 'Growth' };
  if (f && f.netMargin != null) out.profit = { g: ladder(f.netMargin, [0.25, 0.15, 0.08, 0]), v: round(f.netMargin * 100, 1) + '% net margin', label: 'Profit' };
  const r6 = retOver(c, end, 126);
  if (r6 != null) out.momentum = { g: ladder(r6, [0.25, 0.1, 0, -0.1]), v: (r6 >= 0 ? '+' : '') + round(r6 * 100, 1) + '% 6M', label: 'Momentum' };
  const m50 = sma(c, 50, end), m200 = sma(c, 200, end);
  if (m50 && m200) {
    let g;
    if (price > m50 && price > m200 && m50 > m200) g = 'A';
    else if (price > m200) g = 'B';
    else if (price > m50) g = 'C';
    else if (price > m200 * 0.95) g = 'D';
    else g = 'F';
    out.trend = { g, v: (price >= m200 ? '+' : '') + round((price / m200 - 1) * 100, 1) + '% vs 200d', label: 'Trend' };
  }
  return out;
}
export function composite(grades) {
  const v = Object.values(grades); if (!v.length) return null;
  return Math.round(v.reduce((a, x) => a + PTS[x.g], 0) / (v.length * 4) * 100);
}
export function quantSeries(series, f, weeks = 26) {
  const c = series.c, last = c.length - 1, pts = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const i = last - w * 5; if (i < 0) continue;
    pts.push({ d: series.d[i], s: composite(gradeSet(c, i, f)), p: round(c[i], 2) });
  }
  return pts;
}

// ---------- fundamentals from SEC XBRL companyfacts ----------
function annual(facts, concepts, unit = 'USD') {
  for (const k of concepts) {
    const arr = facts?.['us-gaap']?.[k]?.units?.[unit];
    if (!arr) continue;
    const byFrame = new Map();
    for (const x of arr) {
      if (!x.frame || !/^CY\d{4}$/.test(x.frame)) continue;
      if (x.start && x.end && (Date.parse(x.end) - Date.parse(x.start)) / DAY < 330) continue;
      byFrame.set(x.frame, x);
    }
    const list = [...byFrame.values()].sort((a, b) => a.frame.localeCompare(b.frame));
    if (list.length) return list;
  }
  return [];
}
export function fundamentalsFromFacts(cf) {
  const facts = cf?.facts; if (!facts) return null;
  const rev = annual(facts, ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense']);
  const ni = annual(facts, ['NetIncomeLoss', 'ProfitLoss']);
  const eps = annual(facts, ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'], 'USD/shares');
  const r1 = rev.at(-1), r0 = rev.at(-2);
  const n1 = ni.find((x) => r1 && x.frame === r1.frame) || ni.at(-1);
  const e1 = eps.at(-1);
  return {
    fy: r1 ? r1.frame.slice(2) : e1 ? e1.frame.slice(2) : null,
    periodEnd: r1?.end || e1?.end || null,
    revenue: r1?.val ?? null,
    revenuePrev: r0?.val ?? null,
    revGrowth: r1 && r0 && r0.val ? r1.val / r0.val - 1 : null,
    netIncome: n1?.val ?? null,
    netMargin: r1 && n1 && r1.val ? n1.val / r1.val : null,
    eps: e1?.val ?? null,
    epsFy: e1 ? e1.frame.slice(2) : null
  };
}

// ---------- news clustering ----------
export function clusterNews(items, threshold = 0.5) {
  const clusters = [];
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  for (const it of sorted) {
    const tk = tokens(it.title);
    const hit = clusters.find((c) => c.t === it.t && jaccard(c.tk, tk) >= threshold);
    if (hit) {
      hit.merged++;
      if (!hit.outlets.includes(it.source)) hit.outlets.push(it.source);
      hit.members.push(it.id);
    } else clusters.push({ ...it, tk, merged: 1, outlets: [it.source], members: [it.id] });
  }
  return clusters.map(({ tk, ...c }) => c);
}

// ---------- source track record ----------
// A call = a non-neutral headline about a ticker. It is scored `horizon` trading days after
// publication: a positive call is correct if the stock beat the benchmark, a negative call if it lagged.
export function resolveCalls(pending, priceMap, bench, horizon) {
  const resolved = [], stillPending = [];
  for (const call of pending) {
    const s = priceMap[call.t];
    if (!s) { stillPending.push(call); continue; }
    const i0 = idxOnOrAfter(s, call.date), b0 = idxOnOrAfter(bench, call.date);
    if (i0 < 0 || b0 < 0 || i0 + horizon >= s.c.length || b0 + horizon >= bench.c.length) { stillPending.push(call); continue; }
    const r = s.c[i0 + horizon] / s.c[i0] - 1, rb = bench.c[b0 + horizon] / bench.c[b0] - 1;
    resolved.push({ ...call, r: round(r * 100, 2), rb: round(rb * 100, 2), ok: call.sent > 0 ? r > rb : r < rb, at: s.d[i0 + horizon] });
  }
  return { resolved, stillPending };
}
export function sourceStats(resolved, minCalls) {
  const m = {};
  for (const r of resolved) {
    const x = (m[r.source] ||= { calls: 0, correct: 0, recent: [] });
    x.calls++; if (r.ok) x.correct++;
    x.recent.push(r);
  }
  for (const [k, x] of Object.entries(m)) {
    x.acc = x.calls ? round(x.correct / x.calls * 100, 1) : null;
    x.rated = x.calls >= minCalls;
    x.recent = x.recent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((r) => ({ t: r.t, date: r.date, sent: r.sent, r: r.r, rb: r.rb, ok: r.ok, title: r.title }));
    m[k] = x;
  }
  return m;
}
export function sourceWeight(src, stats) {
  const s = stats[src];
  if (!s || !s.rated) return 0.8;
  return clamp(s.acc / 55, 0.4, 1.6);
}

// ---------- sentiment & pillars ----------
export function sentimentFor(t, items, stats, grades, comp, series, nowDay, windowDays) {
  const since = isoDay(Date.parse(nowDay) - windowDays * DAY);
  const mid = isoDay(Date.parse(nowDay) - 7 * DAY);
  const mine = items.filter((x) => x.t === t && x.date.slice(0, 10) >= since);
  const tally = (list) => {
    let b = 0, s = 0;
    for (const x of list) { const w = sourceWeight(x.source, stats); if (x.sent > 0) b += w; else if (x.sent < 0) s += w; }
    return { b, s, share: (b + 1) / (b + s + 2) };
  };
  const all = tally(mine), recent = tally(mine.filter((x) => x.date.slice(0, 10) >= mid)), prior = tally(mine.filter((x) => x.date.slice(0, 10) < mid));
  const c = series.c, end = c.length - 1;
  const r1m = retOver(c, end, 21) ?? 0;
  const trendBull = clamp(0.5 + r1m * 2.5, 0.05, 0.95);
  const quantBull = comp == null ? 0.5 : comp / 100;
  const W = { news: 0.45, quant: 0.35, trend: 0.2 };
  const bull = Math.round((W.news * all.share + W.quant * quantBull + W.trend * trendBull) * 100);

  const ranked = (sign) => mine.filter((x) => x.sent === sign)
    .map((x) => ({ x, k: sourceWeight(x.source, stats) * Math.abs(x.score) * (x.merged || 1) }))
    .sort((a, b) => b.k - a.k).map((y) => y.x);
  const gl = Object.values(grades).sort((a, b) => PTS[b.g] - PTS[a.g]);
  const bullP = ranked(1).slice(0, 2).map((x) => ({ head: x.source, body: x.title, url: x.url }));
  const bearP = ranked(-1).slice(0, 2).map((x) => ({ head: x.source, body: x.title, url: x.url }));
  const best = gl.filter((g) => PTS[g.g] >= 3)[0], worst = [...gl].reverse().filter((g) => PTS[g.g] <= 1)[0];
  if (best) bullP.push({ head: `${best.label} grade ${best.g}`, body: best.v });
  if (worst) bearP.push({ head: `${worst.label} grade ${worst.g}`, body: worst.v });
  if (r1m > 0.03) bullP.push({ head: 'Price trend', body: `Up ${round(r1m * 100, 1)}% over the past month` });
  if (r1m < -0.03) bearP.push({ head: 'Price trend', body: `Down ${round(-r1m * 100, 1)}% over the past month` });
  return {
    bull, bear: 100 - bull, n: mine.length,
    newsBull: Math.round(all.share * 100), newsBull7d: Math.round(recent.share * 100), newsBullPrev7d: Math.round(prior.share * 100),
    drivers: [
      { key: 'news', label: 'News tone, weighted by source track record', bull: Math.round(all.share * 100), w: 45, n: mine.length },
      { key: 'quant', label: 'Quant factor grades', bull: Math.round(quantBull * 100), w: 35 },
      { key: 'trend', label: '1-month price trend', bull: Math.round(trendBull * 100), w: 20 }
    ],
    pillars: { bull: bullP.slice(0, 4), bear: bearP.slice(0, 4) }
  };
}

// ---------- divergence ----------
export function divergenceFor(t, name, chg5d, quant, sent) {
  if (chg5d == null) return null;
  const s = quant.series.map((p) => p.s).filter((x) => x != null);
  const cur = s.at(-1), prevMax = Math.max(...s.slice(0, -1)), prevMin = Math.min(...s.slice(0, -1));
  const dSent = sent.newsBull7d - sent.newsBullPrev7d;
  const reasons = [];
  if (chg5d <= -3) {
    if (cur != null && cur >= prevMax) reasons.push(`its quant score (${cur}/100) is at a 6-month high`);
    if (dSent >= 10) reasons.push(`news tone improved from ${sent.newsBullPrev7d}% to ${sent.newsBull7d}% bullish`);
    if (cur != null && cur >= 75 && !reasons.length) reasons.push(`its quant score is a strong ${cur}/100`);
    if (reasons.length) return { type: 'bull', t, title: `${t}: price down, fundamentals up`, text: `${t} is down ${Math.abs(round(chg5d, 1))}% this week, but ${reasons.join(' and ')}. Review the bull case.`, chg5d: round(chg5d, 1), score: cur };
  }
  if (chg5d >= 4) {
    if (cur != null && cur <= prevMin) reasons.push(`its quant score (${cur}/100) is at a 6-month low`);
    if (dSent <= -10) reasons.push(`news tone fell from ${sent.newsBullPrev7d}% to ${sent.newsBull7d}% bullish`);
    if (cur != null && cur <= 35 && !reasons.length) reasons.push(`its quant score is a weak ${cur}/100`);
    if (reasons.length) return { type: 'bear', t, title: `${t}: price up, fundamentals soft`, text: `${t} is up ${round(chg5d, 1)}% this week, but ${reasons.join(' and ')}. Review the bear case.`, chg5d: round(chg5d, 1), score: cur };
  }
  return null;
}

// ---------- filings ----------
export const FORM_DESC = {
  '10-K': 'Annual report', '10-Q': 'Quarterly report', '8-K': 'Current report', '4': 'Insider transaction',
  'SC 13G': 'Ownership stake >5% (passive)', 'SC 13G/A': 'Ownership stake update', 'SC 13D': 'Ownership stake >5% (active)',
  'DEF 14A': 'Proxy statement', 'S-3': 'Securities registration', 'S-8': 'Employee stock plan registration', '11-K': 'Employee plan annual report',
  '10-K/A': 'Annual report (amended)', '10-Q/A': 'Quarterly report (amended)', '8-K/A': 'Current report (amended)', '144': 'Proposed insider sale'
};
const ITEM_DESC = { '1.01': 'material agreement', '2.02': 'earnings results', '2.05': 'restructuring costs', '5.02': 'executive or director change', '5.07': 'shareholder vote results', '7.01': 'Reg FD disclosure', '8.01': 'other events', '9.01': 'exhibits', '2.01': 'acquisition or disposal', '1.05': 'cybersecurity incident', '5.03': 'bylaw amendment' };
export function filingsFromSubmissions(sub, cik, sinceDay, max = 12) {
  const r = sub?.filings?.recent; if (!r) return [];
  const out = []; let form4 = 0;
  for (let i = 0; i < r.form.length && out.length < max; i++) {
    const form = r.form[i], date = r.filingDate[i];
    if (date < sinceDay) break;
    if (!FORM_DESC[form]) continue;
    if (form === '4' && ++form4 > 3) continue;
    const items = (r.items?.[i] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const itemText = items.map((x) => ITEM_DESC[x]).filter((x) => x && x !== 'exhibits');
    const acc = r.accessionNumber[i].replace(/-/g, '');
    out.push({
      form, date, desc: FORM_DESC[form] + (itemText.length ? ': ' + itemText.join(', ') : ''),
      url: r.primaryDocument?.[i] ? `https://www.sec.gov/Archives/edgar/data/${+cik}/${acc}/${r.primaryDocument[i]}` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`
    });
  }
  return out;
}

export const words = (s) => String(s).split(/\s+/).filter(Boolean).length;
export const speakSec = (s) => Math.max(8, Math.round(words(s) / 2.6));
