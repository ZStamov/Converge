/* Converge — buy/sell signals from the Master Trader Manual (lessons 6–20) and a simple long-only backtest.
   Pure functions over OHLCV arrays { t[], o[], h[], l[], c[], v[] } (t in Unix seconds). Shared by the app and the tests. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ indicators
  function sma(a, n) { var out = new Array(a.length).fill(null), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  function ema(a, n) { var out = new Array(a.length).fill(null), k = 2 / (n + 1), e = null; for (var i = 0; i < a.length; i++) { if (i === n - 1) { var s = 0; for (var j = 0; j < n; j++) s += a[j]; e = s / n; } else if (i >= n) e = a[i] * k + e * (1 - k); out[i] = e; } return out; }
  function rsi(c, n) {
    var out = new Array(c.length).fill(null), g = 0, l = 0;
    for (var i = 1; i < c.length; i++) {
      var d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    return out;
  }
  function atr(s, n) {
    var out = new Array(s.c.length).fill(null), a = null;
    for (var i = 0; i < s.c.length; i++) {
      var tr = i ? Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])) : s.h[i] - s.l[i];
      if (i < n) { a = (a || 0) + tr; if (i === n - 1) { a /= n; out[i] = a; } } else { a = (a * (n - 1) + tr) / n; out[i] = a; }
    }
    return out;
  }
  function etDay(sec) { return new Date((sec - 4 * 3600) * 1000).toISOString().slice(0, 10); }
  function sessions(s) { var st = [], d = null; for (var i = 0; i < s.t.length; i++) { var x = etDay(s.t[i]); if (x !== d) { d = x; st.push(i); } } return st; }
  function sessionVwap(s) {
    var out = new Array(s.c.length).fill(null), pv = 0, vv = 0, d = null;
    for (var i = 0; i < s.c.length; i++) {
      var x = etDay(s.t[i]); if (x !== d) { d = x; pv = 0; vv = 0; }
      var tp = (s.h[i] + s.l[i] + s.c[i]) / 3, v = s.v[i] || 0; pv += tp * v; vv += v; out[i] = vv ? pv / vv : tp;
    }
    return out;
  }
  function indicators(s) {
    return { s20: sma(s.c, 20), s50: sma(s.c, 50), s200: sma(s.c, 200), e20: ema(s.c, 20), rsi: rsi(s.c, 14), atr: atr(s, 14), av: sma(s.v.map(function (x) { return x || 0; }), 20), vwap: sessionVwap(s) };
  }
  function maxOf(a, i, j) { var m = -Infinity; for (var k = Math.max(0, i); k <= j; k++) m = Math.max(m, a[k]); return m; }
  function minOf(a, i, j) { var m = Infinity; for (var k = Math.max(0, i); k <= j; k++) m = Math.min(m, a[k]); return m; }
  function isPivotLow(l, j, w) { if (j - w < 0 || j + w >= l.length) return false; for (var k = j - w; k <= j + w; k++) if (k !== j && l[k] <= l[j]) return false; return true; }
  function isPivotHigh(h, j, w) { if (j - w < 0 || j + w >= h.length) return false; for (var k = j - w; k <= j + w; k++) if (k !== j && h[k] >= h[j]) return false; return true; }
  function poc(s, a, b) {
    var lo = minOf(s.l, a, b), hi = maxOf(s.h, a, b); if (!(hi > lo)) return null;
    var B = 24, bins = new Array(B).fill(0);
    for (var k = a; k <= b; k++) { var tp = (s.h[k] + s.l[k] + s.c[k]) / 3; bins[Math.min(B - 1, Math.floor((tp - lo) / (hi - lo) * B))] += s.v[k] || 0; }
    var m = 0; for (var q = 1; q < B; q++) if (bins[q] > bins[m]) m = q;
    return lo + (m + 0.5) / B * (hi - lo);
  }

  // ------------------------------------------------------------------ the rule book
  var RULES = [
    { id: 'brk', side: 'buy', lesson: 6, name: 'Breakout', rule: 'Close above the highest high of the prior 20 bars on volume above 1.5× its 20-bar average.' },
    { id: 'pb', side: 'buy', lesson: 7, name: 'MA pullback', rule: 'Uptrend (price and EMA20 above SMA50); the bar dips to the 20 EMA and closes green back above it.' },
    { id: 'vwh', side: 'buy', lesson: 8, name: 'VWAP hold', rule: 'Intraday: after 3 bars above session VWAP, price tags VWAP and closes green above it.', intraday: true },
    { id: 'bdiv', side: 'buy', lesson: 9, name: 'RSI bullish divergence', rule: 'Price makes a lower swing low while RSI(14) makes a higher low under 40; signal when the low is confirmed.' },
    { id: 'flag', side: 'buy', lesson: 10, name: 'Bull flag', rule: 'A pole of at least 3× ATR in up to 6 bars, a 3–10 bar flag holding the top half of the pole, then a close above the flag high.' },
    { id: 'gc', side: 'buy', lesson: 11, name: 'Golden cross', rule: 'SMA50 crosses above SMA200.' },
    { id: 'poc', side: 'buy', lesson: 12, name: 'POC reclaim', rule: 'Close crosses back above the volume-profile point of control of the prior 50 bars on above-average volume.' },
    { id: 'orb', side: 'buy', lesson: 13, name: 'Opening-range breakout', rule: 'Intraday (1–5 minute bars): first close above the first 30 minutes’ high on above-average volume.', orb: true },
    { id: 'clx', side: 'sell', lesson: 14, name: 'Climax top', rule: 'After an extended run (RSI above 70 or 8% over SMA50), a bar with a range over 2× ATR on 2.5× volume closes in its lower half.' },
    { id: 'sbd', side: 'sell', lesson: 15, name: 'Support breakdown', rule: 'Close below the lowest low of the prior 20 bars on volume above 1.5× average.' },
    { id: 'sdiv', side: 'sell', lesson: 16, name: 'RSI bearish divergence', rule: 'Price makes a higher swing high while RSI(14) makes a lower high above 60; signal when the high is confirmed.' },
    { id: 'dc', side: 'sell', lesson: 17, name: 'Death cross', rule: 'SMA50 crosses below SMA200.' },
    { id: 'fbo', side: 'sell', lesson: 18, name: 'Failed breakout', rule: 'Within 3 bars of a 20-bar breakout, price closes back below the old high.' },
    { id: 'vwd', side: 'sell', lesson: 19, name: 'VWAP distribution', rule: 'Intraday: after 3 bars above session VWAP, a red bar closes below VWAP on 1.2× average volume.', intraday: true },
    { id: 'atr', side: 'sell', lesson: 20, name: 'ATR trailing stop', rule: 'Exit when price falls 3× ATR(14) below the highest close since entry (backtest exits).' }
  ];
  var BY_ID = {}; RULES.forEach(function (r) { BY_ID[r.id] = r; });
  var INTRADAY = { '1m': 1, '2m': 2, '5m': 5, '1h': 60, '2h': 120, '4h': 240, '5h': 300 };

  function detect(s, iv) {
    var n = s.c.length, I = indicators(s), out = [], last = {}, intra = !!INTRADAY[iv], orbOk = intra && INTRADAY[iv] <= 5;
    var c = s.c, h = s.h, l = s.l, o = s.o, v = s.v;
    function hit(i, id) { if (last[id] != null && i - last[id] < 5) return; last[id] = i; out.push({ i: i, id: id, side: BY_ID[id].side }); }
    var orbHi = null, orbEnd = -1, orbDone = false, sessStart = -1, day = null, brkLevels = [];
    var pivL = [], pivH = [];
    for (var i = 1; i < n; i++) {
      var av = I.av[i] || 0, vol = v[i] || 0, a = I.atr[i];
      // session bookkeeping (ORB)
      if (intra) { var d = etDay(s.t[i]); if (d !== day) { day = d; sessStart = i; orbHi = h[i]; orbDone = false; orbEnd = i + Math.max(1, Math.round(30 / INTRADAY[iv])) - 1; } else if (i <= orbEnd) orbHi = Math.max(orbHi, h[i]); }
      // 6 breakout / 15 breakdown / 18 failed breakout
      if (i >= 20) {
        var hh = maxOf(h, i - 20, i - 1), ll = minOf(l, i - 20, i - 1);
        if (c[i] > hh && c[i - 1] <= hh && av && vol > 1.5 * av) { hit(i, 'brk'); }
        if (c[i] > hh) brkLevels.push({ i: i, lvl: hh });
        if (c[i] < ll && av && vol > 1.5 * av) hit(i, 'sbd');
        brkLevels = brkLevels.filter(function (b) { return i - b.i <= 3; });
        for (var q = 0; q < brkLevels.length; q++) { var b = brkLevels[q]; if (b.i < i && c[i] < b.lvl) { hit(i, 'fbo'); brkLevels = []; break; } }
      }
      // 7 MA pullback
      if (I.s50[i] != null && I.e20[i] != null && c[i] > I.s50[i] && I.e20[i] > I.s50[i] && l[i] <= I.e20[i] * 1.003 && c[i] > I.e20[i] && c[i] > o[i] && c[i - 1] > I.e20[i - 1]) hit(i, 'pb');
      // 8 VWAP hold / 19 VWAP distribution
      if (intra && i - sessStart >= 3) {
        var above = c[i - 1] > I.vwap[i - 1] && c[i - 2] > I.vwap[i - 2] && c[i - 3] > I.vwap[i - 3];
        if (above && l[i] <= I.vwap[i] * 1.001 && c[i] > I.vwap[i] && c[i] > o[i]) hit(i, 'vwh');
        if (above && c[i] < I.vwap[i] && c[i] < o[i] && av && vol > 1.2 * av) hit(i, 'vwd');
      }
      // 9 / 16 RSI divergences (pivot confirmed 2 bars later)
      var j = i - 2;
      if (j >= 2 && I.rsi[j] != null) {
        if (isPivotLow(l, j, 2)) { for (var p = pivL.length - 1; p >= 0; p--) { var pl = pivL[p]; if (j - pl < 5) continue; if (j - pl > 40) break; if (l[j] < l[pl] && I.rsi[j] > I.rsi[pl] && I.rsi[j] < 40) hit(i, 'bdiv'); break; } pivL.push(j); }
        if (isPivotHigh(h, j, 2)) { for (var r = pivH.length - 1; r >= 0; r--) { var ph = pivH[r]; if (j - ph < 5) continue; if (j - ph > 40) break; if (h[j] > h[ph] && I.rsi[j] < I.rsi[ph] && I.rsi[j] > 60) hit(i, 'sdiv'); break; } pivH.push(j); }
      }
      // 10 bull flag
      if (a && i >= 12) {
        for (var k = i - 11; k <= i - 4; k++) {
          var base = minOf(l, k - 6, k), pole = h[k] - base, at = I.atr[k];
          if (!at || pole < 3 * at || h[k] < maxOf(h, k - 6, k)) continue;
          var flagHi = maxOf(h, k + 1, i - 1), flagLo = minOf(l, k + 1, i - 1);
          if (flagHi <= h[k] * 1.005 && flagLo >= base + pole / 2 && c[i] > Math.max(flagHi, h[k]) && c[i - 1] <= Math.max(flagHi, h[k])) { hit(i, 'flag'); break; }
        }
      }
      // 11 golden cross / 17 death cross
      if (I.s200[i] != null && I.s200[i - 1] != null) {
        if (I.s50[i] > I.s200[i] && I.s50[i - 1] <= I.s200[i - 1]) hit(i, 'gc');
        if (I.s50[i] < I.s200[i] && I.s50[i - 1] >= I.s200[i - 1]) hit(i, 'dc');
      }
      // 12 POC reclaim
      if (i >= 51) { var pc = poc(s, i - 50, i - 1); if (pc && c[i - 1] < pc && c[i] > pc && av && vol > av) hit(i, 'poc'); }
      // 13 opening-range breakout
      if (orbOk && !orbDone && i > orbEnd && orbHi != null && c[i] > orbHi) { orbDone = true; if (av && vol > av) hit(i, 'orb'); }
      // 14 climax top
      if (a && av && I.s50[i] != null) {
        var ext = (I.rsi[i - 1] != null && I.rsi[i - 1] > 70) || c[i - 1] > I.s50[i] * 1.08, rg = h[i] - l[i];
        if (ext && rg > 2 * a && vol > 2.5 * av && (c[i] - l[i]) / rg < 0.5) hit(i, 'clx');
      }
    }
    return { sigs: out, ind: I };
  }

  // ------------------------------------------------------------------ backtest: long only, next-bar-open fills
  function backtest(s, iv, opts) {
    opts = opts || {};
    var D = opts.detected || detect(s, iv), I = D.ind, n = s.c.length, cost = opts.cost == null ? 0.0005 : opts.cost, mult = opts.atrMult || 3, fwd = opts.fwd || 10;
    var buyAt = {}, sellAt = {}; D.sigs.forEach(function (g) { (g.side === 'buy' ? buyAt : sellAt)[g.i] = (g.side === 'buy' ? buyAt : sellAt)[g.i] || []; (g.side === 'buy' ? buyAt : sellAt)[g.i].push(g.id); });
    var trades = [], pos = null, eq = 1, peak = 1, mdd = 0, curve = [];
    for (var i = 1; i < n; i++) {
      var exited = false;
      if (pos) {
        // trailing stop (lesson 20), checked intrabar
        if (I.atr[i - 1]) { pos.hiC = Math.max(pos.hiC, s.c[i - 1]); var stop = pos.hiC - mult * I.atr[i - 1]; pos.stop = pos.stop == null ? stop : Math.max(pos.stop, stop); }
        var exitPx = null, why = null;
        if (sellAt[i - 1]) { exitPx = s.o[i]; why = sellAt[i - 1][0]; }
        else if (pos.stop != null && s.l[i] <= pos.stop) { exitPx = Math.min(s.o[i], pos.stop); why = 'atr'; }
        if (exitPx != null) { var ret = exitPx * (1 - cost) / (pos.px * (1 + cost)) - 1; trades.push({ in: pos.i, out: i, entry: pos.px, exit: exitPx, ret: ret, why: pos.why, exitWhy: why, bars: i - pos.i }); eq *= 1 + ret; pos = null; exited = true; }
      }
      if (!pos && !exited && buyAt[i - 1]) pos = { i: i, px: s.o[i], hiC: s.o[i], stop: null, why: buyAt[i - 1][0] };
      var mark = pos ? eq * (s.c[i] * (1 - cost) / (pos.px * (1 + cost))) : eq;
      peak = Math.max(peak, mark); mdd = Math.min(mdd, mark / peak - 1); curve.push(mark);
    }
    var open = null;
    if (pos) { var r2 = s.c[n - 1] * (1 - cost) / (pos.px * (1 + cost)) - 1; open = { in: pos.i, entry: pos.px, ret: r2, why: pos.why, bars: n - 1 - pos.i, stop: pos.stop }; }
    var wins = trades.filter(function (t) { return t.ret > 0; }), gw = 0, gl = 0;
    trades.forEach(function (t) { if (t.ret > 0) gw += t.ret; else gl -= t.ret; });
    var total = (open ? eq * (1 + open.ret) : eq) - 1;
    var hold = s.c[n - 1] / s.o[Math.min(1, n - 1)] - 1;
    // per-signal hit rates: did price move the right way over the next `fwd` bars?
    var per = {};
    D.sigs.forEach(function (g) {
      var p = per[g.id] || (per[g.id] = { id: g.id, side: g.side, n: 0, done: 0, hits: 0, sum: 0 }); p.n++;
      var e = g.i + fwd; if (e >= n) return;
      var fr = s.c[e] / s.c[g.i] - 1; p.done++; p.sum += fr; if (g.side === 'buy' ? fr > 0 : fr < 0) p.hits++;
    });
    trades.forEach(function (t) { if (t.exitWhy === 'atr') { var p = per.atr || (per.atr = { id: 'atr', side: 'sell', n: 0, done: 0, hits: 0, sum: 0, stopOnly: true }); p.n++; } });
    return {
      trades: trades, open: open, n: trades.length, winRate: trades.length ? wins.length / trades.length : null,
      avg: trades.length ? trades.reduce(function (a, t) { return a + t.ret; }, 0) / trades.length : null,
      total: total, hold: hold, pf: gl ? gw / gl : (gw ? Infinity : null), mdd: mdd,
      avgBars: trades.length ? trades.reduce(function (a, t) { return a + t.bars; }, 0) / trades.length : null,
      per: per, fwd: fwd, cost: cost, bars: n, curve: curve
    };
  }

  var API = { RULES: RULES, BY_ID: BY_ID, INTRADAY: INTRADAY, detect: detect, backtest: backtest, indicators: indicators, _: { sma: sma, ema: ema, rsi: rsi, atr: atr, poc: poc, sessions: sessions } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ConvergeSignals = API;
})(typeof window !== 'undefined' ? window : this);
