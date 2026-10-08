// Market pulse: today's 5-minute bars for the major index ETFs, the VIX and the 11 sector ETFs (Yahoo Finance).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const INDEX = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX'];
const SECTORS = { XLK: 'Technology', XLF: 'Financials', XLV: 'Health Care', XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLE: 'Energy', XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate', XLC: 'Communication Services' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bars(sym) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m&includePrePost=false&_=${Date.now()}`, { headers: { 'User-Agent': UA, 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(), res = j?.chart?.result?.[0]; if (!res) throw new Error('empty');
      const q = res.indicators?.quote?.[0] || {}, out = { t: [], o: [], h: [], l: [], c: [], v: [] };
      (res.timestamp || []).forEach((t, k) => { if (q.close?.[k] != null) { out.t.push(t); out.o.push(+q.open[k].toFixed(2)); out.h.push(+q.high[k].toFixed(2)); out.l.push(+q.low[k].toFixed(2)); out.c.push(+q.close[k].toFixed(2)); out.v.push(q.volume?.[k] || 0); } });
      out.prevClose = res.meta?.chartPreviousClose ?? res.meta?.previousClose ?? null;
      out.price = res.meta?.regularMarketPrice ?? out.c.at(-1);
      out.time = res.meta?.regularMarketTime ?? out.t.at(-1);
      return out;
    } catch (e) { if (i === 2) throw e; await sleep(800 * (i + 1)); }
  }
}
export async function fetchPulse() {
  const out = { app: 'Converge', kind: 'pulse', generatedAt: new Date().toISOString(), source: 'Yahoo Finance (5-minute bars)', index: {}, sectors: {}, errors: [] };
  await Promise.all(INDEX.map(async (s) => { try { out.index[s] = await bars(s); } catch (e) { out.errors.push(`${s}: ${e.message}`); } }));
  await Promise.all(Object.entries(SECTORS).map(async ([s, name]) => { try { const b = await bars(s); out.sectors[s] = { name, prevClose: b.prevClose, price: b.price, c: b.c }; } catch (e) { out.errors.push(`${s}: ${e.message}`); } }));
  return out;
}
