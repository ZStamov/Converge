// Scanner indicators (Finviz-style) computed from daily bars. Pure functions.
export const r2 = (x, n = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** n) / 10 ** n);

export function sma(c, n, end = c.length - 1) {
  if (end + 1 < n || end < 0) return null;
  let s = 0; for (let i = end - n + 1; i <= end; i++) s += c[i];
  return s / n;
}
export function rsi(c, n = 14) {
  if (c.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
export function atr(h, l, c, n = 14) {
  const k = Math.min(h.length, l.length, c.length);
  if (k < n + 1) return null;
  const off = c.length - k; let s = 0;
  for (let i = k - n; i < k; i++) {
    const pc = c[off + i - 1];
    s += Math.max(h[i] - l[i], Math.abs(h[i] - pc), Math.abs(l[i] - pc));
  }
  return s / n;
}
// Finviz "volatility": average daily high-low range in percent
export function volat(h, l, n) {
  const k = Math.min(h.length, l.length); if (k < n) return null;
  let s = 0; for (let i = k - n; i < k; i++) s += (h[i] - l[i]) / l[i];
  return s / n * 100;
}
export const perf = (c, n) => (c.length > n && c[c.length - 1 - n] ? (c[c.length - 1] / c[c.length - 1 - n] - 1) * 100 : null);
export function beta(dA, cA, dB, cB) {
  const mB = new Map(dB.map((d, i) => [d, cB[i]]));
  const ra = [], rb = [];
  for (let i = 1; i < dA.length; i++) {
    const b0 = mB.get(dA[i - 1]), b1 = mB.get(dA[i]);
    if (b0 && b1) { ra.push(cA[i] / cA[i - 1] - 1); rb.push(b1 / b0 - 1); }
  }
  if (ra.length < 60) return null;
  const ma = ra.reduce((a, x) => a + x, 0) / ra.length, mb = rb.reduce((a, x) => a + x, 0) / rb.length;
  let cov = 0, vb = 0; for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); vb += (rb[i] - mb) ** 2; }
  return vb ? cov / vb : null;
}
const pctFrom = (p, ref) => (ref ? (p / ref - 1) * 100 : null);
function hiLo(c, n) { const s = c.slice(-n); return { hi: Math.max(...s), lo: Math.min(...s) }; }

// bars: { d:[day strings], c:[], h:[], l:[], v:[] } ; live: { price, volume, day }
export function technicals(bars, live, bench) {
  let d = bars.d.slice(), c = bars.c.slice();
  const h = bars.h.slice(), l = bars.l.slice(), v = bars.v.slice();
  if (live && live.price) {
    if (live.day && live.day > d[d.length - 1]) { d.push(live.day); c.push(live.price); if (live.volume != null) v.push(live.volume); }
    else c[c.length - 1] = live.price;
  }
  const p = c[c.length - 1], prev = c[c.length - 2];
  const s20 = sma(c, 20), s50 = sma(c, 50), s200 = sma(c, 200);
  const e = c.length - 2;
  const p20 = sma(c, 20, e), p50 = sma(c, 50, e), p200 = sma(c, 200, e);
  const cross = (a1, b1, a0, b0) => (a1 == null || b1 == null || a0 == null || b0 == null ? 0 : a0 <= b0 && a1 > b1 ? 1 : a0 >= b0 && a1 < b1 ? -1 : 0);
  const y = d[d.length - 1].slice(0, 4);
  const iY = d.findIndex((x) => x.slice(0, 4) === y);
  const ytdBase = iY > 0 ? c[iY - 1] : c[iY];
  const h20 = hiLo(c, 20), h50 = hiLo(c, 50), h52 = hiLo(c, Math.min(252, c.length));
  const avgVol = v.length >= 64 ? v.slice(-64, -1).reduce((a, x) => a + x, 0) / 63 : null;
  const vol = live && live.volume != null ? live.volume : v[v.length - 1];
  return {
    p: r2(p), ch: r2(pctFrom(p, prev)), v: vol, av: avgVol ? Math.round(avgVol) : null, rv: avgVol && vol != null ? r2(vol / avgVol) : null,
    pw: r2(perf(c, 5)), pm: r2(perf(c, 21)), pq: r2(perf(c, 63)), ph: r2(perf(c, 126)), py: r2(perf(c, 252)), pytd: r2(pctFrom(p, ytdBase)),
    vw: r2(volat(h, l, 5)), vm: r2(volat(h, l, 21)), rsi: r2(rsi(c.slice(-120)), 1),
    s20: r2(pctFrom(p, s20)), s50: r2(pctFrom(p, s50)), s200: r2(pctFrom(p, s200)),
    s20v50: s20 && s50 ? (s20 > s50 ? 1 : -1) : 0, s20v200: s20 && s200 ? (s20 > s200 ? 1 : -1) : 0, s50v200: s50 && s200 ? (s50 > s200 ? 1 : -1) : 0,
    xp20: cross(p, s20, prev, p20), xp50: cross(p, s50, prev, p50), xp200: cross(p, s200, prev, p200),
    x20v50: cross(s20, s50, p20, p50), x20v200: cross(s20, s200, p20, p200), x50v200: cross(s50, s200, p50, p200),
    hi20: r2(pctFrom(p, h20.hi)), lo20: r2(pctFrom(p, h20.lo)), hi50: r2(pctFrom(p, h50.hi)), lo50: r2(pctFrom(p, h50.lo)), hi52: r2(pctFrom(p, h52.hi)), lo52: r2(pctFrom(p, h52.lo)),
    beta: bench ? r2(beta(d, c, bench.d, bench.c)) : null, atr: r2(atr(h, l, bars.c)),
    day: d[d.length - 1]
  };
}

// fundamentals from SEC frames maps (cik -> value)
export function fundamentals(cik, F, price, marketCap) {
  const g = (k) => (F[k] ? F[k].get(cik) : undefined);
  const rev = g('rev'), revP = g('revPrev'), ni = g('ni'), eps = g('eps'), epsP = g('epsPrev');
  const gp = g('gp'), op = g('op'), eq = g('eq'), as = g('assets'), ac = g('ac'), lc = g('lc'), ltd = g('ltd'), div = g('div'), dps = g('dps');
  const out = {
    eps: r2(eps), pe: eps > 0 && price ? r2(price / eps, 1) : null,
    ps: rev > 0 && marketCap ? r2(marketCap / rev) : null, pb: eq > 0 && marketCap ? r2(marketCap / eq) : null,
    epsg: eps != null && epsP ? r2((eps / Math.abs(epsP) - Math.sign(epsP)) * 100, 1) : null,
    sg: rev && revP ? r2((rev / revP - 1) * 100, 1) : null,
    roa: ni != null && as ? r2(ni / as * 100, 1) : null, roe: ni != null && eq > 0 ? r2(ni / eq * 100, 1) : null,
    cr: ac && lc ? r2(ac / lc) : null, de: ltd != null && eq > 0 ? r2(ltd / eq) : null,
    gm: gp != null && rev ? r2(gp / rev * 100, 1) : null, om: op != null && rev ? r2(op / rev * 100, 1) : null, nm: ni != null && rev ? r2(ni / rev * 100, 1) : null,
    dy: dps != null && price ? r2(dps / price * 100) : div != null && marketCap ? r2(div / marketCap * 100) : null,
    po: div != null && ni > 0 ? r2(div / ni * 100, 1) : null
  };
  return out;
}

export function exchangeName(code) {
  return { NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NAS: 'NASDAQ', NYQ: 'NYSE', NYS: 'NYSE', ASE: 'AMEX', PCX: 'NYSE Arca', BTS: 'BATS' }[code] || code || null;
}
