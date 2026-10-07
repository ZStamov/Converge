/* Converge — investing command center. Plain JS, no build step; shared by web, Android and iOS (Capacitor). */
(function () {
  'use strict';

  // ------------------------------------------------------------------ config
  var CFG = {
    remote: 'https://raw.githubusercontent.com/ZStamov/converge/data/market.json',
    bundled: 'data/market.json',
    repo: 'https://github.com/ZStamov/converge'
  };
  var KEY = 'converge.v1';
  var DEFAULT = { watchlist: ['AAPL', 'NVDA', 'MSFT', 'AMZN'], lots: [], watchTheses: {}, signal: false, topOnly: false, range: '1M', brief: { day: null, picked: [], skipped: [] }, seenAlerts: [], muted: [], sel: null, notify: false, feedFilter: 'mine', onboarded: false, scan: null, auth: null };

  // ------------------------------------------------------------------ utils
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function money(x, d) { if (!num(x)) return '—'; d = d == null ? 2 : d; var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); return (x < 0 ? '−$' : '$') + s; }
  function compact(x) { if (!num(x)) return '—'; var a = Math.abs(x); return (x < 0 ? '−$' : '$') + (a >= 1e12 ? (a / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (a / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a.toFixed(0)); }
  function pct(x, d) { if (!num(x)) return '—'; d = d == null ? 1 : d; return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d) + '%'; }
  function arrowPct(x) { if (!num(x)) return '—'; return (x > 0 ? '▲ ' : x < 0 ? '▼ ' : '') + Math.abs(x).toFixed(1) + '%'; }
  function cls(x) { return !num(x) || x === 0 ? 'flat' : x > 0 ? 'up' : 'down'; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function ago(iso) {
    if (!iso) return '';
    var ms = Date.now() - Date.parse(iso); if (!isFinite(ms)) return '';
    var m = Math.round(ms / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.round(h / 24); if (d < 30) return d + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fmtDate(iso) { var d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

  // ------------------------------------------------------------------ icons (inline stroke SVG)
  var P = {
    logo: '<path d="M3 6l11 8M3 22l11-8M14 14h9"></path><circle cx="24.5" cy="14" r="1.8" fill="currentColor"></circle>',
    cmd: '<rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    scale: '<path d="M12 3v18"></path><path d="M7 21h10"></path><path d="M4 7h16"></path><path d="M4 7l-2.5 6a3 3 0 0 0 5 0L4 7z"></path><path d="M20 7l-2.5 6a3 3 0 0 0 5 0L20 7z"></path>',
    vault: '<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M2 13h20"></path>',
    back: '<path d="M15 18l-6-6 6-6"></path>', x: '<path d="M6 6l12 12M18 6L6 18"></path>', check: '<path d="M5 12l5 5 9-10"></path>',
    play: '<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"></polygon>', pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>',
    chev: '<path d="M9 6l6 6-6 6"></path>', plus: '<path d="M12 5v14M5 12h14"></path>', search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>',
    trophy: '<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path><path d="M17 6h3v2a3 3 0 0 1-3 3"></path><path d="M7 6H4v2a3 3 0 0 0 3 3"></path>',
    div: '<path d="M3 17l6-6 4 4 8-8"></path><path d="M3 7l6 6"></path>', pinI: '<path d="M12 17v5"></path><path d="M9 3h6l-1 7 4 3H6l4-3-1-7z"></path>',
    link: '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 4v7h-7"></path>',
    filter: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z"></path>'
  };
  function ic(name, size, extra) { return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 ' + (name === 'logo' ? 28 : 24) + ' ' + (name === 'logo' ? 28 : 24) + '" fill="none" stroke="currentColor" stroke-width="' + (name === 'logo' ? 2.2 : 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + P[name] + '</svg>'; }

  // ------------------------------------------------------------------ state
  var S = (function () {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    var out = {}; for (var k in DEFAULT) out[k] = s[k] !== undefined ? s[k] : JSON.parse(JSON.stringify(DEFAULT[k]));
    return out;
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: session-only */ } }

  var D = null;            // market data
  var DS = { source: null, error: null, loading: true };
  var NAV = { tab: 'command', stack: [] };
  var UI = { side: 'bull', battleRange: '6M', vaultTab: 'lots', draft: null, sheet: null, toast: null, reflect: null, briefIdx: 0, speaking: false, speakIdx: -1, pickQuery: '' };

  // ------------------------------------------------------------------ native bridges (Capacitor) with web fallbacks
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  function plugin(n) { return Cap && Cap.Plugins && Cap.Plugins[n]; }

  // ------------------------------------------------------------------ data loading
  function valid(d) { return d && d.app === 'Converge' && d.tickers && typeof d.tickers === 'object'; }
  function fetchJson(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 9000);
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function loadData(force) {
    DS.loading = true; if (force) render();
    var snap = window.__CONVERGE_SNAPSHOT__;
    return fetchJson(CFG.remote + '?t=' + Math.floor(Date.now() / 60000))
      .then(function (d) { if (!valid(d)) throw new Error('bad data'); return { d: d, src: 'live' }; })
      .catch(function () {
        if (snap && valid(snap)) return { d: snap, src: 'snapshot' };
        return fetchJson(CFG.bundled).then(function (d) { if (!valid(d)) throw new Error('bad data'); return { d: d, src: 'bundled' }; });
      })
      .then(function (r) {
        // keep the newer of what we have
        if (!D || Date.parse(r.d.generatedAt) >= Date.parse(D.generatedAt)) D = r.d;
        DS.source = r.src; DS.error = null; DS.loading = false;
        if (!S.sel || !D.tickers[S.sel]) S.sel = firstTicker();
        notifyNewAlerts();
        render();
      })
      .catch(function (e) { DS.loading = false; DS.error = 'Could not load market data. Check your connection and tap Retry.'; render(); });
  }
  function firstTicker() {
    var h = holdings(); if (h.length) return h[0].t;
    for (var i = 0; i < S.watchlist.length; i++) if (D.tickers[S.watchlist[i]]) return S.watchlist[i];
    return D.universe && D.universe[0] ? D.universe[0].t : null;
  }

  // ------------------------------------------------------------------ derived data
  function T(t) { return D && D.tickers[t]; }
  function openLots() { return S.lots.filter(function (l) { return l.status !== 'closed'; }); }
  function holdings() {
    var m = {};
    openLots().forEach(function (l) {
      var h = m[l.t] || (m[l.t] = { t: l.t, shares: 0, cost: 0, lots: [] });
      h.shares += l.shares; h.cost += l.shares * l.price; h.lots.push(l);
    });
    return Object.keys(m).map(function (k) {
      var h = m[k], x = T(k);
      h.price = x ? x.price : null; h.value = x ? h.shares * x.price : null;
      h.day = x ? h.shares * (x.price - x.prevClose) : 0; h.pl = h.value != null ? h.value - h.cost : null;
      return h;
    }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
  }
  function myTickers() {
    var s = {}; openLots().forEach(function (l) { s[l.t] = 1; }); S.watchlist.forEach(function (t) { s[t] = 1; });
    return Object.keys(s).filter(function (t) { return T(t); });
  }
  function thesisFor(t) {
    var lots = openLots().filter(function (l) { return l.t === t && l.thesis; });
    if (lots.length) return { thesis: lots[0].thesis, lot: lots[0] };
    if (S.watchTheses[t]) return { thesis: S.watchTheses[t], lot: null };
    return null;
  }
  function seriesOf(t) { return t === 'SPY' ? (D && D.benchmark && D.benchmark.hist ? D.benchmark : null) : T(t); }
  function closeOn(t, day) {
    var x = seriesOf(t); if (!x || !x.hist) return null; var d = x.hist.d, c = x.hist.c;
    for (var i = d.length - 1; i >= 0; i--) if (d[i] <= day) return c[i];
    return c[0];
  }
  function lotStatus(l) {
    if (l.status === 'closed') return 'done';
    if (l.thesis && l.thesis.status) return l.thesis.status;
    var x = T(l.t); if (!x) return 'ok';
    var plp = (x.price / l.price - 1) * 100;
    if (l.thesis && l.thesis.killed) return 'broken';
    if (plp <= -15) return 'review';
    return 'ok';
  }
  var STATUS = { ok: ['On track', 'st-ok'], review: ['Needs review', 'st-review'], broken: ['Thesis broken', 'st-broken'], done: ['Closed', 'st-done'] };
  function sourceInfo(name) { return (D && D.sources && D.sources[name]) || null; }
  function isTop(name) { var s = sourceInfo(name); return !!(s && s.rated && D.topPerformerCut != null && s.acc >= D.topPerformerCut); }
  function accBadge(name) {
    var s = sourceInfo(name);
    if (!s || !s.rated) return '<button class="acc acc-un" data-act="source" data-name="' + esc(name) + '" aria-label="Unrated source, view profile">UNRATED</button>';
    return '<button class="acc ' + (isTop(name) ? 'acc-hi' : 'acc-mid') + '" data-act="source" data-name="' + esc(name) + '" aria-label="Prediction accuracy ' + s.acc + ' percent, view profile">' + Math.round(s.acc) + '%</button>';
  }
  function streamFor(tickers, opts) {
    // unified intelligence items: filings, quant changes, news/analysis clusters, divergence alerts
    opts = opts || {}; var set = {}; tickers.forEach(function (t) { set[t] = 1; });
    var out = [];
    tickers.forEach(function (t) {
      var x = T(t); if (!x) return;
      (x.filings || []).forEach(function (f) { out.push({ k: 'filing', t: t, date: f.date + 'T12:00:00Z', title: f.desc, tag: 'SEC ' + f.form, tagc: 'tag-sec', meta: (opts.showT ? t + ' · ' : '') + 'EDGAR · ' + fmtDate(f.date), url: f.url }); });
    });
    (D.quantChanges || []).forEach(function (q) { if (set[q.t]) out.push({ k: 'quant', t: q.t, date: q.date, title: (opts.showT ? q.t + ' ' : '') + q.factor + ' grade ' + q.from + ' → ' + q.to, tag: 'QUANT', tagc: 'tag-quant', meta: q.v + ' · ' + ago(q.date) }); });
    (D.alerts || []).forEach(function (a) { if (set[a.t]) out.push({ k: 'alert', t: a.t, date: a.date, title: a.title, tag: 'DIVERGE', tagc: 'tag-div', meta: 'Converge signal · ' + ago(a.date), alert: a }); });
    (D.news || []).forEach(function (n) {
      if (!set[n.t] || S.muted.indexOf(n.source) >= 0) return;
      var tag = n.kind === 'analysis' ? (n.sent > 0 ? 'BULL' : n.sent < 0 ? 'BEAR' : 'OPINION') : 'NEWS';
      var tagc = tag === 'BULL' ? 'tag-bull' : tag === 'BEAR' ? 'tag-bear' : 'tag-news';
      out.push({ k: n.kind, t: n.t, date: n.date, title: n.title, tag: tag, tagc: tagc, source: n.source, merged: n.merged, outlets: n.outlets, sent: n.sent, url: n.url, meta: n.source + (n.merged > 1 ? ' + ' + (n.merged - 1) + ' more' : '') + ' · ' + ago(n.date) });
    });
    out = out.filter(function (i) {
      if (S.signal && (i.k === 'news' || i.k === 'analysis')) return false;
      if (S.topOnly && i.k === 'analysis' && !isTop(i.source)) return false;
      if (S.topOnly && i.k === 'news' && sourceInfo(i.source) && sourceInfo(i.source).rated && !isTop(i.source)) return false;
      return true;
    });
    out.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return opts.limit ? out.slice(0, opts.limit) : out;
  }

  // ------------------------------------------------------------------ charts
  function path(vals, w, h, lo, hi) {
    var n = vals.length; if (n < 2) return '';
    var span = hi - lo || 1, s = '';
    for (var i = 0; i < n; i++) { var x = (i / (n - 1)) * w, y = h - ((vals[i] - lo) / span) * h; s += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    return s;
  }
  function lineChart(vals, opts) {
    opts = opts || {}; var w = 330, h = opts.h || 120, pad = 6;
    var v = vals.filter(num); if (v.length < 2) return '<div class="muted" style="font-size:12px;padding:20px 0">Not enough price history.</div>';
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    var up = v[v.length - 1] >= v[0], col = opts.color || (up ? 'var(--bull)' : 'var(--bear)');
    var d = path(v, w, h - pad * 2, lo, hi);
    var lastY = (h - pad * 2) - ((v[v.length - 1] - lo) / (hi - lo || 1)) * (h - pad * 2);
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.label || 'Price chart') + '" style="height:' + h + 'px">' +
      '<line x1="0" y1="' + pad + '" x2="' + w + '" y2="' + pad + '" stroke="var(--line)" stroke-width="1"></line><line x1="0" y1="' + (h - pad) + '" x2="' + w + '" y2="' + (h - pad) + '" stroke="var(--line)" stroke-width="1"></line>' +
      '<g transform="translate(0 ' + pad + ')"><path d="' + d + ' L' + w + ' ' + (h - pad * 2) + ' L0 ' + (h - pad * 2) + 'Z" fill="' + col + '" fill-opacity="0.09"></path>' +
      '<path d="' + d + '" stroke="' + col + '" stroke-width="2" fill="none" vector-effect="non-scaling-stroke" stroke-linejoin="round"></path>' +
      '<circle cx="' + w + '" cy="' + lastY.toFixed(1) + '" r="3" fill="' + col + '"></circle></g></svg>';
  }
  function dualChart(a, b, h) {
    var w = 330; h = h || 130; var pad = 8;
    var na = a.filter(num), nb = b.filter(num); if (na.length < 2 || nb.length < 2) return '';
    var la = Math.min.apply(null, na), ha = Math.max.apply(null, na), lb = Math.min.apply(null, nb), hb = Math.max.apply(null, nb);
    var start = Math.floor(a.length * 0.8) / (a.length - 1) * w;
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Price versus quant score over six months" style="height:' + h + 'px">' +
      '<rect x="' + start.toFixed(1) + '" y="0" width="' + (w - start).toFixed(1) + '" height="' + h + '" fill="var(--accent)" fill-opacity="0.06"></rect>' +
      '<g transform="translate(0 ' + pad + ')"><path d="' + path(a, w, h - pad * 2, la, ha) + '" stroke="var(--bear)" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"></path>' +
      '<path d="' + path(b, w, h - pad * 2, lb, hb) + '" stroke="var(--info)" stroke-width="2.5" stroke-dasharray="6 4" fill="none" vector-effect="non-scaling-stroke"></path></g></svg>';
  }
  var RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'Max'];
  function dayMs(d) { return Date.parse(d + 'T21:00:00Z'); }
  // returns { k: [epoch ms], c: [close], intraday: bool } for a ticker and range
  function rangeSlice(x, r) {
    var daily = function (n) { return { k: x.hist.d.slice(-n).map(dayMs), c: x.hist.c.slice(-n), intraday: false }; };
    if ((r === '1D' || r === '1W') && x.intra && x.intra.t && x.intra.t.length > 2) {
      var t = x.intra.t, c = x.intra.c;
      if (r === '1W') return { k: t.map(function (v) { return v * 1000; }), c: c.slice(), intraday: true };
      var lastDay = new Date((t[t.length - 1] - 4 * 3600) * 1000).toISOString().slice(0, 10), i0 = t.length - 1;
      while (i0 > 0 && new Date((t[i0 - 1] - 4 * 3600) * 1000).toISOString().slice(0, 10) === lastDay) i0--;
      var prevClose = x.prevClose, k = t.slice(i0).map(function (v) { return v * 1000; }), cc = c.slice(i0);
      if (prevClose) { k.unshift(k[0] - 900000); cc.unshift(prevClose); }
      return { k: k, c: cc, intraday: true };
    }
    if (r === '1D') return daily(2);
    if (r === '1W') return daily(6);
    if (r === '5Y' && x.w5 && x.w5.c.length > 2) return { k: x.w5.d.map(dayMs), c: x.w5.c.slice(), intraday: false };
    if (r === 'Max' && x.max && x.max.c.length > 2) return { k: x.max.d.map(dayMs), c: x.max.c.slice(), intraday: false };
    return daily({ '1M': 22, '3M': 64, '6M': 127, '1Y': 9999, '5Y': 9999, 'Max': 9999 }[r] || 22);
  }
  function valueAt(ser, key) {
    var k = ser.k, lo = 0, hi = k.length - 1, ans = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (k[m] <= key) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans < 0 ? null : ser.c[ans];
  }
  function portfolioSeries(r) {
    var hs = holdings(); if (!hs.length) return { k: [], c: [] };
    var sers = hs.map(function (h) { return { h: h, s: rangeSlice(T(h.t), r) }; });
    var ref = sers.reduce(function (a, b) { return b.s.k.length > a.s.k.length ? b : a; }).s;
    return { k: ref.k, intraday: ref.intraday, c: ref.k.map(function (key) { var v = 0; sers.forEach(function (o) { var p = valueAt(o.s, key); v += o.h.shares * (p == null ? (o.s.c[0] || 0) : p); }); return v; }) };
  }
  function rangeLabel(ms, intraday, r) {
    var d = new Date(ms);
    if (intraday && r === '1D') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (intraday) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (r === '5Y' || r === 'Max') return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function rangeChange(c) { var v = c.filter(num); return v.length > 1 && v[0] ? (v[v.length - 1] / v[0] - 1) * 100 : null; }
  var RANGE_NAME = { '1D': 'today', '1W': 'past week', '1M': 'past month', '3M': 'past 3 months', '6M': 'past 6 months', '1Y': 'past year', '5Y': 'past 5 years', 'Max': 'all time' };

  // ------------------------------------------------------------------ shell pieces
  function sigToggle() {
    return '<button class="sig" data-act="signal" aria-pressed="' + S.signal + '" aria-label="Signal Mode"><span class="lbl">Signal Mode</span><span class="sw"></span><span class="st">' + (S.signal ? 'ON' : 'OFF') + '</span></button>';
  }
  function topBar(title, right) {
    return '<header class="top"><div class="brand"><span style="color:var(--accent);display:flex">' + ic('logo', 28) + '</span><h1>' + esc(title) + '</h1></div>' + (right || sigToggle()) + '</header>';
  }
  function subBar(title, opts) {
    opts = opts || {};
    return '<header class="subhead"><button class="iconbtn" data-act="back" aria-label="' + (opts.close ? 'Close' : 'Back') + '">' + ic(opts.close ? 'x' : 'back', 22) + '</button><div class="ttl">' + esc(title) + '</div>' + (opts.right || '<span style="width:44px"></span>') + '</header>';
  }
  function navBar() {
    var unseen = (D && D.alerts || []).some(function (a) { return myTickers().indexOf(a.t) >= 0 && S.seenAlerts.indexOf(alertKey(a)) < 0; });
    var tabs = [['command', 'cmd', 'Command'], ['feed', 'bolt', 'Signal Feed'], ['battle', 'scale', 'Battleground'], ['scan', 'filter', 'Scanner'], ['vault', 'vault', 'Vault']];
    return '<nav class="nav" aria-label="Primary">' + tabs.map(function (t) {
      var cur = NAV.tab === t[0] && !NAV.stack.length;
      return '<button data-act="tab" data-tab="' + t[0] + '"' + (NAV.tab === t[0] ? ' aria-current="page"' : '') + '><span class="' + (t[0] === 'command' && unseen ? 'dot' : '') + '" style="display:flex">' + ic(t[1], 22) + '</span>' + t[2] + '</button>';
    }).join('') + '</nav>';
  }
  function dataFoot() {
    if (!D) return '';
    var src = DS.source === 'live' ? 'Live feed' : DS.source === 'snapshot' ? 'Snapshot built into this page' : 'Copy bundled with the app';
    return '<p class="foot">Market data as of ' + esc(new Date(D.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' · ' + src + '<br>Free public sources, may be delayed. Not investment advice.</p>';
  }
  function alertKey(a) { return a.t + '|' + a.type + '|' + a.date.slice(0, 10); }

  // ------------------------------------------------------------------ screens
  function scrCommand() {
    var hs = holdings(), sel = S.sel && T(S.sel) ? S.sel : firstTicker(), x = T(sel);
    var h = '';
    if (S.signal) h += '<div class="banner">' + ic('bolt', 14) + 'News, opinion and commentary hidden. Filings and quant updates only.</div>';
    // portfolio
    if (hs.length) {
      var val = 0, day = 0, cost = 0; hs.forEach(function (o) { val += o.value || 0; day += o.day || 0; cost += o.cost; });
      var prev = val - day, ser = portfolioSeries(S.range), rch = rangeChange(ser.c);
      h += '<section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><h2 class="eyebrow">Portfolio value</h2><div class="big">' + money(val) + '</div>' +
        '<div class="mono ' + cls(day) + '" style="font-size:13px;margin-top:2px">' + (day >= 0 ? '▲ ' : '▼ ') + money(Math.abs(day)) + ' (' + pct(prev ? day / prev * 100 : 0, 2) + ') today</div>' +
        '<div class="mono ' + cls(val - cost) + '" style="font-size:12px;margin-top:2px">' + (val - cost >= 0 ? '+' : '−') + money(Math.abs(val - cost)).replace('−', '') + ' total (' + pct(cost ? (val / cost - 1) * 100 : 0) + ')</div></div>' +
        '</div><div style="margin-top:12px">' + lineChart(ser.c, { h: 84, label: 'Value of current holdings, ' + S.range }) + '</div>' +
        (ser.k.length ? '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px" class="muted mono"><span>' + esc(rangeLabel(ser.k[0], ser.intraday, S.range)) + '</span><span class="' + cls(rch) + '">' + (rch == null ? '' : pct(rch, 2) + ' ' + RANGE_NAME[S.range]) + '</span><span>' + esc(rangeLabel(ser.k[ser.k.length - 1], ser.intraday, S.range)) + '</span></div>' : '') +
        '<div style="margin-top:10px">' + rangeBtns('range', S.range) + '</div><p class="foot" style="text-align:left;margin:6px 0 0">Chart shows today’s share counts at past prices.</p></section>';
    } else {
      h += '<section class="empty"><h3>Start with your first lot</h3><p>Add a position and the reason you bought it. Converge tracks the price, the news and your thesis together.</p><button class="btn pri sm" data-act="add">' + ic('plus', 16) + 'Add a lot</button></section>';
    }
    // watchlist
    h += '<section><div class="sechead"><h2 class="eyebrow">Watchlist &amp; holdings</h2><button class="lnk" data-act="pick" data-mode="watch">Edit</button></div><div class="wl">' +
      myTickers().map(function (t) { var y = T(t); return '<button class="wlc" data-act="sel" data-t="' + t + '" aria-pressed="' + (t === sel) + '"><div class="tk">' + t + '</div><div class="ch ' + cls(y.changePct) + '">' + arrowPct(y.changePct) + '</div></button>'; }).join('') +
      '<button class="wlc add" data-act="pick" data-mode="watch" aria-label="Add ticker">' + ic('plus', 18) + '</button></div></section>';
    // split position / thesis
    if (x) {
      var hold = hs.filter(function (o) { return o.t === sel; })[0], th = thesisFor(sel);
      var left = '<div><div class="lbl-sm">' + (hold ? 'Position' : 'Watching') + '</div><div><div class="disp" style="font-size:20px;font-weight:700">' + sel + '</div><div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.name || '') + (hold ? ' · ' + fmtShares(hold.shares) + ' sh' : '') + '</div></div>' +
        '<div><div class="mono" style="font-size:18px">' + money(x.price) + '</div><div class="mono ' + cls(x.changePct) + '" style="font-size:12px">' + arrowPct(x.changePct) + ' today</div></div>' +
        sentBar(x.sentiment, true) + '<button class="btn sm" data-act="battle" data-t="' + sel + '" style="margin-top:auto">Battleground</button></div>';
      var right;
      if (th) {
        var t0 = th.thesis, prog = t0.target ? clamp(x.price / t0.target * 100, 0, 100) : null, st = th.lot ? lotStatus(th.lot) : (t0.status || 'ok');
        right = '<div><div class="lbl-acc">Your thesis</div><div style="font-size:14px;font-weight:600;line-height:1.3">' + esc(t0.title) + '</div>' +
          (t0.pins || []).slice(0, 2).map(function (p) { return '<div class="pin">' + esc(p.text.length > 70 ? p.text.slice(0, 68) + '…' : p.text) + '</div>'; }).join('') +
          '<div style="margin-top:auto">' + (t0.target ? '<div style="display:flex;justify-content:space-between;font-size:11px" class="muted"><span>Target exit</span><span class="mono" style="color:var(--fg)">' + money(t0.target, 0) + '</span></div><div class="prog"><i style="width:' + prog.toFixed(0) + '%"></i></div>' : '') +
          '<span class="status ' + STATUS[st][1] + '">' + STATUS[st][0] + '</span></div>' +
          (th.lot ? '<button class="btn sm" data-act="lot" data-id="' + th.lot.id + '">Open thesis</button>' : '<button class="btn sm" data-act="add" data-t="' + sel + '">Add a lot</button>') + '</div>';
      } else {
        right = '<div><div class="lbl-acc">Your thesis</div><p class="muted" style="margin:0;font-size:13px;line-height:1.45">No thesis yet. Writing down why you hold ' + sel + ' gives you something to check before you sell.</p><button class="btn sm pri" data-act="' + (hold ? 'thesis-lot' : 'wthesis-new') + '" data-t="' + sel + '" style="margin-top:auto">Write thesis</button></div>';
      }
      h += '<section class="split">' + left + right + '</section>';
    }
    // alerts
    var al = (D.alerts || []).filter(function (a) { return myTickers().indexOf(a.t) >= 0; });
    al.forEach(function (a) { h += alertCard(a); });
    // stream
    if (x) {
      var items = streamFor([sel], { limit: 8 });
      h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Filtered intelligence · ' + sel + '</h2><div class="list">' + (items.length ? items.map(itemRow).join('') : '<p class="muted" style="font-size:13px;margin:0">Nothing in the last two weeks' + (S.signal ? ' that passes Signal Mode' : '') + '.</p>') + '</div></section>';
    }
    h += dataFoot();
    return topBar('Converge', '<div style="display:flex;align-items:center;gap:2px"><button class="iconbtn" data-act="settings" aria-label="Settings">' + ic('gear', 20) + '</button>' + sigToggle() + '</div>') + '<main class="main" id="main">' + h + '</main>';
  }
  function fmtShares(n) { return (Math.round(n * 1000) / 1000).toLocaleString('en-US'); }
  function rangeBtns(act, cur) { return '<div class="ranges wide">' + RANGES.map(function (r) { return '<button data-act="' + act + '" data-r="' + r + '" aria-pressed="' + (cur === r) + '">' + r + '</button>'; }).join('') + '</div>'; }
  function isNeutral(s) { return s && s.bull >= 45 && s.bull <= 55; }
  function sentBar(s, small) {
    if (!s) return '';
    var n = isNeutral(s);
    return '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span class="' + (n ? 'neu' : 'up') + '">' + s.bull + '% Bull</span>' + (n ? '<span class="neu" style="font-weight:600">Neutral</span>' : '') + '<span class="' + (n ? 'neu' : 'down') + '">' + s.bear + '% Bear</span></div><div class="bar' + (n ? ' neutral' : '') + '" style="height:' + (small ? 8 : 10) + 'px"><div class="b" style="width:' + s.bull + '%"></div><div class="s"></div></div></div>';
  }
  function alertCard(a) {
    var seen = S.seenAlerts.indexOf(alertKey(a)) >= 0;
    return '<button class="alert' + (a.type === 'bear' ? ' bear' : '') + '" data-act="alert" data-t="' + a.t + '"><span class="ic">' + ic('div', 18) + '</span><span style="font-size:13px;line-height:1.4"><strong>Divergence · ' + esc(a.t) + (seen ? '' : ' · New') + '</strong><br>' + esc(a.text.replace(/ Review the (bull|bear) case\.$/, '')) + ' <span class="go">Review ' + (a.type === 'bear' ? 'bear' : 'bull') + ' case →</span></span></button>';
  }
  function itemRow(i) {
    var inner = '<span class="tag ' + i.tagc + '">' + esc(i.tag) + '</span><span class="body"><span class="t1">' + esc(i.title) + '</span><span class="t2">' + esc(i.meta) + '</span></span>';
    if (i.k === 'alert') return '<button class="item" data-act="alert" data-t="' + i.t + '">' + inner + ic('chev', 16) + '</button>';
    var url = safeUrl(i.url);
    var link = url ? '<a class="item" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" style="flex:1;border:0;padding:0;background:none">' + inner + '</a>' : '<div class="item" style="flex:1;border:0;padding:0;background:none">' + inner + '</div>';
    return '<div class="item">' + link + (i.source ? accBadge(i.source) : '') + '</div>';
  }

  function scrFeed() {
    var mine = myTickers(), f = S.feedFilter;
    var all = D.universe.map(function (u) { return u.t; });
    var items = streamFor(f === 'all' ? all : mine, { showT: true }).filter(function (i) {
      if (f === 'filings') return i.k === 'filing'; if (f === 'quant') return i.k === 'quant' || i.k === 'alert';
      if (f === 'news') return i.k === 'news'; if (f === 'analysis') return i.k === 'analysis'; return true;
    }).slice(0, 80);
    var b = briefCandidates(), mins = Math.max(1, Math.round(b.reduce(function (s, x) { return s + x.sec; }, 0) / 60));
    var h = '';
    if (S.signal) h += '<div class="banner">' + ic('bolt', 14) + 'Signal Mode is on: news and opinion are hidden.</div>';
    h += '<button class="brief" data-act="briefing"><span class="pl">' + ic('play', 20) + '</span><span style="flex:1"><span class="k">Executive Flash Briefing</span><span class="h">' + (b.length ? 'Curate today’s briefing' : 'No new items for your tickers') + '</span><span class="s">' + (b.length ? b.length + ' items · about ' + mins + ' min before curation' : 'Checks the last 72 hours') + '</span></span>' + ic('chev', 18) + '</button>';
    var filters = [['mine', 'My tickers'], ['all', 'All'], ['filings', 'Filings'], ['quant', 'Quant'], ['news', 'News'], ['analysis', 'Analysis']];
    h += '<div class="chips">' + filters.map(function (x) { return '<button class="chip" data-act="feedf" data-f="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var cut = D.topPerformerCut;
    h += '<button class="rowtoggle" data-act="toponly" aria-pressed="' + S.topOnly + '"><span style="display:flex;align-items:center;gap:10px"><span style="color:var(--accent);display:flex">' + ic('trophy', 18) + '</span><span><span class="t1">Top performers only</span><span class="t2">' + (cut != null ? 'Hide opinion from sources below ' + Math.round(cut) + '% prediction accuracy' : 'Turns on once sources have enough scored calls') + '</span></span></span><span class="sw"></span></button>';
    if (!items.length) h += '<div class="empty"><h3>Nothing to show</h3><p>Try another filter' + (S.signal ? ', or turn off Signal Mode' : '') + '.</p></div>';
    h += '<div class="list">' + items.map(function (i) {
      if (i.k !== 'news' && i.k !== 'analysis') return itemRow(i);
      var url = safeUrl(i.url);
      return '<article class="story"><div class="meta"><span class="mono" style="color:var(--info)">' + esc(i.t) + ' · ' + (i.k === 'analysis' ? 'ANALYSIS' : 'NEWS') + '</span><span>' + (i.merged > 1 ? i.merged + ' reports merged · ' : '') + ago(i.date) + '</span></div>' +
        '<h3>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(i.title) + '</a>' : esc(i.title)) + '</h3>' +
        '<div class="row"><span class="tag ' + (i.sent > 0 ? 'tag-bull' : i.sent < 0 ? 'tag-bear' : 'tag-news') + '">' + (i.sent > 0 ? 'POSITIVE' : i.sent < 0 ? 'NEGATIVE' : 'NEUTRAL') + ' TONE</span><span class="outlets">' + esc(i.source) + '</span>' + accBadge(i.source) + '</div>' +
        (i.outlets && i.outlets.length > 1 ? '<div class="outlets">Also covered by: ' + esc(i.outlets.slice(1, 5).join(', ')) + (i.outlets.length > 5 ? '…' : '') + '</div>' : '') + '</article>';
    }).join('') + '</div>';
    h += dataFoot();
    return topBar('Signal Feed') + '<main class="main" id="main">' + h + '</main>';
  }

  function scrBattle() {
    var mine = myTickers(); var sel = S.sel && T(S.sel) ? S.sel : firstTicker(); var x = T(sel);
    var row = mine.slice(); if (row.indexOf(sel) < 0) row.unshift(sel);
    var head = '<header class="subhead" style="gap:6px"><div class="tick-row" style="flex:1;padding-left:8px">' + row.map(function (t) { return '<button class="chip" data-act="sel" data-t="' + t + '" aria-pressed="' + (t === sel) + '">' + t + '</button>'; }).join('') + '</div><button class="iconbtn" data-act="pick" data-mode="battle" aria-label="Find a ticker">' + ic('search', 20) + '</button></header>';
    if (!x) return head + '<main class="main"><div class="empty"><h3>Pick a ticker</h3></div></main>';
    var s = x.sentiment, r = rangeSlice(x, UI.battleRange), neu = isNeutral(s), brch = rangeChange(r.c);
    var h = '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div style="min-width:0"><h1 class="disp" style="margin:0;font-size:26px;font-weight:700;letter-spacing:-.4px;line-height:1.15">' + esc(x.name || sel) + '</h1><div class="muted" style="font-size:12px;margin-top:2px">' + sel + ' · ' + esc(x.priceSource) + ' · ' + ago(x.asOf) + '</div></div>' +
      '<div style="text-align:right;flex:none"><div class="mono" style="font-size:22px">' + money(x.price) + '</div><div class="mono ' + cls(x.changePct) + '" style="font-size:12px">' + (x.changePct >= 0 ? '▲ +' : '▼ ') + money(Math.abs(x.price - x.prevClose)) + ' (' + Math.abs(x.changePct).toFixed(1) + '%)</div></div></div>';
    // slider
    h += '<section class="card"><div class="sechead" style="margin-bottom:12px"><h2 class="eyebrow">Consensus balance</h2>' + (neu ? '<span class="status st-neutral">Neutral</span>' : '<span class="status ' + (s.bull > 55 ? 'st-ok">Leaning bullish' : 'st-broken">Leaning bearish') + '</span>') + '</div>' +
      '<div class="slider' + (neu ? ' neutral' : '') + '"><button class="bl" style="width:' + clamp(s.bull, 18, 82) + '%" data-act="side" data-side="bull" aria-pressed="' + (UI.side === 'bull') + '" aria-label="Bull case, ' + s.bull + ' percent"><span class="pct">' + s.bull + '%</span><span class="sd">BULLISH</span></button>' +
      '<button class="br" data-act="side" data-side="bear" aria-pressed="' + (UI.side === 'bear') + '" aria-label="Bear case, ' + s.bear + ' percent"><span class="pct">' + s.bear + '%</span><span class="sd">BEARISH</span></button></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:8px" class="muted"><span>News tone this week: ' + s.newsBull7d + '% bull (prior week ' + s.newsBullPrev7d + '%)</span><span>' + s.n + ' stories · tap a side</span></div>' + (neu ? '<p class="neu" style="margin:8px 0 0;font-size:12px">Bulls and bears are close to even (45–55% bullish counts as neutral).</p>' : '');
    if (UI.side === 'bull' || UI.side === 'bear') {
      var bull = UI.side === 'bull', ps = s.pillars[UI.side] || [];
      h += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)"><div class="sechead"><span style="font-size:13px;font-weight:600" class="' + (bull ? 'up' : 'down') + '">' + (bull ? 'Bull' : 'Bear') + ' case: core pillars</span><button class="lnk" data-act="side" data-side="none" style="color:var(--muted)">Collapse</button></div><div class="list">' +
        (ps.length ? ps.map(function (p, i) {
          var u = safeUrl(p.url), tagO = u ? 'a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"' : 'div', tagC = u ? 'a' : 'div';
          return '<' + tagO + ' class="pillar"><span class="n" style="background:var(--' + (bull ? 'bull' : 'bear') + '-soft);color:var(--' + (bull ? 'bull' : 'bear') + ')">' + (i + 1) + '</span><span style="flex:1;min-width:0"><span class="h">' + esc(p.head) + '</span><span class="b">' + esc(p.body) + '</span></span></' + tagC + '>';
        }).join('') : '<p class="muted" style="margin:0;font-size:13px">No ' + UI.side + 'ish signals in the last two weeks.</p>') + '</div></div>';
    }
    h += '</section>';
    // chart
    var cmode = UI.cmode || 'candles';
    h += '<section class="card"><div class="sechead"><h2 class="eyebrow">Chart</h2><div class="seg" style="min-width:150px">' + [['candles', 'Candles'], ['line', 'Line']].map(function (m) { return '<button data-act="cmode" data-m="' + m[0] + '" aria-pressed="' + (cmode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div></div>';
    if (cmode === 'candles') h += candleCard(sel);
    else h += '<div style="display:flex;justify-content:flex-end;margin-bottom:4px"><span class="mono ' + cls(brch) + '" style="font-size:12px">' + (brch == null ? '' : pct(brch, 2) + ' ' + RANGE_NAME[UI.battleRange]) + '</span></div>' + lineChart(r.c, { h: 120, label: sel + ' price, ' + UI.battleRange }) +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px" class="muted mono"><span>' + esc(rangeLabel(r.k[0], r.intraday, UI.battleRange)) + '</span><span>' + esc(rangeLabel(r.k[r.k.length - 1], r.intraday, UI.battleRange)) + '</span></div><div style="margin-top:10px">' + rangeBtns('brange', UI.battleRange) + '</div>';
    h += '</section>';
    // drivers
    h += '<section class="card drv"><h2 class="eyebrow" style="margin-bottom:10px">What drives the score</h2><div style="display:flex;flex-direction:column;gap:12px">' + s.drivers.map(function (d) {
      return '<div><div class="r"><span>' + esc(d.label) + (d.key === 'quant' && Object.keys(x.grades).length < 5 ? ' (' + Object.keys(x.grades).length + ' of 5 available)' : '') + '</span><span class="mono ' + (d.bull >= 50 ? 'up' : 'down') + '" style="white-space:nowrap">' + d.bull + '% bull · w ' + d.w + '%</span></div><div class="track"><i style="width:' + d.bull + '%"></i></div></div>';
    }).join('') + '</div></section>';
    if (x.crowd && x.crowd.n) {
      var cw = x.crowd;
      h += '<a class="card" href="' + esc(cw.url) + '" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:var(--fg);padding:14px"><span class="sechead" style="display:flex;margin-bottom:6px"><span class="eyebrow">Retail crowd · Stocktwits</span><span class="muted" style="font-size:11px">Open ↗</span></span>' +
        (cw.bullPct != null ? '<span style="display:block;font-size:14px"><b class="' + (cw.bullPct >= 50 ? 'up' : 'down') + '">' + cw.bullPct + '% bullish</b> of ' + cw.tagged + ' tagged posts</span>' : '<span style="display:block;font-size:14px">Few posts carry a bull/bear tag right now</span>') +
        '<span class="muted" style="display:block;font-size:12px;margin-top:4px">' + (cw.perHour != null ? cw.perHour + ' posts per hour' : '') + (cw.watchers ? ' · ' + bigNum(cw.watchers) + ' watching' : '') + '</span></a>';
    }
    // grades
    var order = ['value', 'growth', 'profit', 'momentum', 'trend'];
    h += '<section><div class="sechead"><h2 class="eyebrow">Quant grades</h2><span class="mono muted" style="font-size:12px">Score ' + (x.quant.score == null ? '—' : x.quant.score) + '/100' + (Object.keys(x.grades).length < 5 ? ' · ' + Object.keys(x.grades).length + ' of 5 grades' : '') + '</span></div><div class="grades">' + order.map(function (k) {
      var g = x.grades[k]; return '<div class="grade"><div class="g g' + (g ? g.g : '') + '">' + (g ? g.g : '—') + '</div><div class="l">' + (g ? g.label : k) + '</div><div class="v">' + esc(g ? g.v : 'n/a') + '</div></div>';
    }).join('') + '</div>' + (x.fundamentals && x.fundamentals.fy ? '<p class="foot" style="text-align:left">Fundamentals from SEC filings, fiscal ' + esc(x.fundamentals.fy) + ': revenue ' + compact(x.fundamentals.revenue) + ', net income ' + compact(x.fundamentals.netIncome) + ', diluted EPS ' + money(x.fundamentals.eps) + '.</p>' : '') + '</section>';
    // filings + headlines
    var st = streamFor([sel], { limit: 10 });
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Latest on ' + sel + '</h2><div class="list">' + (st.length ? st.map(itemRow).join('') : '<p class="muted" style="font-size:13px;margin:0">No recent items.</p>') + '</div></section>';
    h += forumCard(sel);
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">More on ' + sel + '</h2><div class="lnkrow">' + extLinks(sel) + '</div></section>';
    var watching = S.watchlist.indexOf(sel) >= 0;
    h += '<div class="btnrow"><button class="btn" data-act="watch" data-t="' + sel + '">' + (watching ? 'Watching ✓' : 'Watch') + '</button><button class="btn pri" data-act="add" data-t="' + sel + '">Add a lot</button></div>';
    h += dataFoot();
    return head + '<main class="main" id="main">' + h + '</main>';
  }

  function scrVault() {
    var lots = S.lots, open = openLots(), closed = lots.filter(function (l) { return l.status === 'closed'; });
    var counts = { ok: 0, review: 0, broken: 0 }; open.forEach(function (l) { var s = lotStatus(l); if (counts[s] != null) counts[s]++; });
    var h = '<div class="seg" role="tablist" aria-label="Vault views">' + [['lots', 'Lots'], ['theses', 'Theses'], ['perf', 'Performance']].map(function (t) { return '<button role="tab" data-act="vtab" data-v="' + t[0] + '" aria-pressed="' + (UI.vaultTab === t[0]) + '" aria-selected="' + (UI.vaultTab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += '<section class="kv"><div><div class="disp up" style="font-size:24px;font-weight:700">' + counts.ok + '</div><div class="muted" style="font-size:11px">On track</div></div><div><div class="disp" style="font-size:24px;font-weight:700;color:var(--accent)">' + counts.review + '</div><div class="muted" style="font-size:11px">Needs review</div></div><div><div class="disp down" style="font-size:24px;font-weight:700">' + counts.broken + '</div><div class="muted" style="font-size:11px">Thesis broken</div></div></section>';
    if (UI.vaultTab === 'lots') {
      if (!open.length) h += '<div class="empty"><h3>No open lots</h3><p>Each lot keeps its own thesis, pinned evidence and exit target.</p><button class="btn pri sm" data-act="add">' + ic('plus', 16) + 'Add a lot</button></div>';
      h += '<div class="list">' + open.map(lotCard).join('') + '</div>';
      if (closed.length) h += '<h2 class="eyebrow">Closed</h2><div class="list">' + closed.slice().reverse().map(lotCard).join('') + '</div>';
    } else if (UI.vaultTab === 'theses') {
      var rows = [];
      lots.forEach(function (l) { if (l.thesis) rows.push({ t: l.t, th: l.thesis, lot: l }); });
      Object.keys(S.watchTheses).forEach(function (t) { rows.push({ t: t, th: S.watchTheses[t], lot: null }); });
      if (!rows.length) h += '<div class="empty"><h3>No theses yet</h3><p>Converge asks “What is your thesis?” whenever you add a lot or a ticker to your watchlist.</p></div>';
      h += '<div class="list">' + rows.map(function (r) {
        return '<button class="item" data-act="' + (r.lot ? 'lot' : 'wthesis') + '" data-id="' + (r.lot ? r.lot.id : '') + '" data-t="' + r.t + '"><span class="tag tag-quant">' + r.t + '</span><span class="body"><span class="t1">' + esc(r.th.title) + '</span><span class="t2">' + (r.lot ? (r.lot.status === 'closed' ? 'Closed lot' : 'Open lot') : 'Watchlist') + ' · ' + ((r.th.pins || []).length) + ' pins · written ' + fmtDate(r.th.createdAt) + '</span></span>' + ic('chev', 16) + '</button>';
      }).join('') + '</div>';
    } else {
      h += perfView(closed);
    }
    return topBar('The Vault', '<button class="btn pri sm" data-act="add" style="border-radius:999px">' + ic('plus', 16) + 'New lot</button>') + '<main class="main" id="main">' + h + dataFoot() + '</main>';
  }
  function lotCard(l) {
    var x = T(l.t), st = lotStatus(l), cur = l.status === 'closed' ? l.sell.price : x ? x.price : null;
    var plp = cur != null ? (cur / l.price - 1) * 100 : null;
    return '<button class="card" data-act="lot" data-id="' + l.id + '" style="text-align:left;color:var(--fg);padding:14px;width:100%">' +
      '<span style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="display:flex;align-items:baseline;gap:8px;min-width:0"><span class="disp" style="font-size:18px;font-weight:700">' + l.t + '</span><span class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + fmtDate(l.date) + ' · ' + fmtShares(l.shares) + ' sh</span></span><span class="status ' + STATUS[st][1] + '">' + STATUS[st][0] + '</span></span>' +
      '<span style="display:block;font-size:13px;color:var(--fg2);margin-top:6px">' + (l.thesis ? '“' + esc(l.thesis.title) + '”' : '<span style="color:var(--accent)">No thesis yet. Tap to write one.</span>') + '</span>' +
      '<span class="kv" style="margin-top:10px;gap:8px;display:grid"><span style="padding:0;border:0;background:none"><span class="k" style="display:block">Cost</span><span class="mono" style="font-size:13px">' + money(l.price) + '</span></span><span style="padding:0;border:0;background:none"><span class="k" style="display:block">' + (l.status === 'closed' ? 'Result' : 'P/L') + '</span><span class="mono ' + cls(plp) + '" style="font-size:13px">' + pct(plp) + '</span></span><span style="padding:0;border:0;background:none"><span class="k" style="display:block">Target</span><span class="mono" style="font-size:13px">' + (l.thesis && l.thesis.target ? money(l.thesis.target, 0) : '—') + '</span></span></span>' +
      (l.thesis ? '<span style="display:flex;gap:6px;margin-top:10px;font-size:11px" class="muted">' + ic('pinI', 12) + (l.thesis.pins || []).length + ' pins · ' + (l.thesis.horizon || '12M') + ' horizon</span>' : '') + '</button>';
  }
  function perfView(closed) {
    if (!closed.length) return '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Your decision record</h2><p class="muted" style="margin:0;font-size:13px;line-height:1.5">Fills in as you close lots. Converge compares each result with your thesis target and with the S&amp;P 500 (SPY) over the same holding period.</p></section>';
    var n = closed.length, wins = 0, hit = 0, days = 0, rsum = 0, xs = 0, xn = 0, withThesis = 0;
    closed.forEach(function (l) {
      var r = l.sell.price / l.price - 1; rsum += r; if (r > 0) wins++;
      if (l.thesis) { withThesis++; if (l.thesis.target && l.sell.price >= l.thesis.target) hit++; }
      days += Math.max(0, daysBetween(l.date, l.sell.date));
      var bx = benchRet(l.date, l.sell.date); if (bx != null) { xs += r - bx; xn++; }
    });
    var reasons = {}; closed.forEach(function (l) { reasons[l.sell.reason] = (reasons[l.sell.reason] || 0) + 1; });
    return '<section class="card"><h2 class="eyebrow" style="margin-bottom:12px">Your decision record · ' + n + ' closed</h2><div class="grid2" style="gap:14px">' +
      perfTile(Math.round(wins / n * 100) + '%', 'Closed at a gain') + perfTile(withThesis ? Math.round(hit / withThesis * 100) + '%' : '—', 'Reached thesis target') +
      perfTile(pct(rsum / n * 100), 'Average return') + perfTile(Math.round(days / n) + 'd', 'Average holding period') +
      perfTile(xn ? pct(xs / xn * 100) : '—', 'Average vs S&amp;P 500') + perfTile(Math.round(withThesis / n * 100) + '%', 'Closed lots with a thesis') + '</div></section>' +
      '<section class="card"><h2 class="eyebrow" style="margin-bottom:10px">Why you sold</h2>' + Object.keys(reasons).map(function (k) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>' + esc(k) + '</span><span class="mono">' + reasons[k] + '</span></div>'; }).join('') + '</section>';
  }
  function perfTile(v, l) { return '<div><div class="disp" style="font-size:26px;font-weight:700">' + v + '</div><div class="muted" style="font-size:12px">' + l + '</div></div>'; }
  function benchRet(a, b) {
    if (!seriesOf('SPY')) return null;
    var p0 = closeOn('SPY', a), p1 = closeOn('SPY', b); return p0 && p1 ? p1 / p0 - 1 : null;
  }

  // ---- add lot + thesis prompt
  function newDraft(t, mode) {
    var x = t ? T(t) : null;
    return { mode: mode || 'lot', t: t || null, shares: '', price: x ? String(x.price) : '', date: today(), title: '', why: '', pins: [], target: '', horizon: '12M', kill: '', step: t ? 2 : 1, lotId: null, watchOnly: mode === 'watch' };
  }
  function scrAdd() {
    var d = UI.draft, x = d.t ? T(d.t) : null, h = '';
    if (d.step === 1) {
      h += '<div><h1 class="disp" style="margin:0;font-size:26px;font-weight:700">Add a lot</h1><p class="muted" style="margin:4px 0 0;font-size:13px">Record a purchase. You can write a thesis for it later from Command or the Vault.</p></div>';
      h += '<div class="field"><span class="lab">Ticker</span><button class="in" data-act="pick" data-mode="draft" style="text-align:left;display:flex;align-items:center;justify-content:space-between">' + (d.t ? '<span><span class="mono">' + d.t + '</span> <span class="muted">' + esc(x ? x.name : '') + '</span></span>' : '<span class="muted">Choose a ticker</span>') + ic('chev', 16) + '</button></div>';
      h += '<div class="grid2"><div class="field"><label for="f-shares">Shares</label><input class="in mono" id="f-shares" data-f="shares" inputmode="decimal" placeholder="e.g. 25" value="' + esc(d.shares) + '"></div><div class="field"><label for="f-price">Price paid</label><input class="in mono" id="f-price" data-f="price" inputmode="decimal" value="' + esc(d.price) + '"></div></div>';
      h += '<div class="field"><label for="f-date">Purchase date</label><input class="in" id="f-date" data-f="date" type="date" max="' + today() + '" value="' + esc(d.date) + '"></div>';
      h += '<div class="btnrow" style="margin-top:auto"><button class="btn" data-act="back">Cancel</button><button class="btn pri" data-act="draft-next" style="flex:2">Save lot</button></div>';
      return subBar('New lot', { close: true }) + '<main class="main" id="main">' + h + '</main>';
    }
    var head = d.mode === 'watch' ? 'WATCHLIST · ' + d.t : d.t + (d.lotId ? ' · EXISTING LOT' : ' · ' + (d.shares || '') + ' SH @ ' + money(+d.price));
    h += '<div><div class="mono" style="font-size:11px;color:var(--accent);letter-spacing:.8px">' + esc(head) + '</div><h1 class="disp" style="margin:4px 0 0;font-size:26px;font-weight:700;letter-spacing:-.4px">What is your thesis?</h1><p class="muted" style="margin:4px 0 0;font-size:13px;line-height:1.45">You will read this again before you sell. Keep it to what has to be true.</p></div>';
    h += '<div class="field"><label for="f-title">Thesis in one line</label><input class="in" id="f-title" data-f="title" maxlength="90" placeholder="e.g. Services keep compounding faster than hardware" value="' + esc(d.title) + '"></div>';
    h += '<div class="field"><label for="f-why">Why now? <span class="opt">(optional)</span></label><textarea class="in" id="f-why" data-f="why" rows="2" placeholder="What makes this the right time?">' + esc(d.why) + '</textarea></div>';
    h += '<div class="field"><span class="lab">Pin evidence</span>' + (d.pins.length ? d.pins.map(function (p, i) {
      return '<div class="pinrow"><span class="tag ' + (p.type === 'article' ? 'tag-sec' : p.type === 'excerpt' ? 'tag-quant' : 'tag-news') + '">' + p.type.toUpperCase() + '</span><span class="x">' + esc(p.text) + '</span><button class="iconbtn" style="width:36px;height:36px" data-act="unpin" data-i="' + i + '" aria-label="Remove pin">' + ic('x', 14) + '</button></div>';
    }).join('') : '') +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px"><button class="dash" data-act="pinsheet" data-type="article">+ Article</button><button class="dash" data-act="pinsheet" data-type="excerpt">+ Excerpt</button><button class="dash" data-act="pinsheet" data-type="note">+ Note</button></div></div>';
    h += '<div class="grid2"><div class="field"><label for="f-target">Target exit</label><input class="in mono" id="f-target" data-f="target" inputmode="decimal" placeholder="' + (x ? '$' + Math.round(x.price * 1.2) : '$') + '" value="' + esc(d.target) + '"></div>' +
      '<div class="field"><span class="lab">Horizon</span><div class="seg amber" role="radiogroup" aria-label="Horizon">' + ['6M', '12M', '24M'].map(function (z) { return '<button role="radio" data-act="horizon" data-h="' + z + '" aria-pressed="' + (d.horizon === z) + '" aria-checked="' + (d.horizon === z) + '" class="mono">' + z + '</button>'; }).join('') + '</div></div></div>';
    h += '<div class="field"><label for="f-kill">I’ll sell if… <span class="opt">(kill criteria)</span></label><input class="in" id="f-kill" data-f="kill" placeholder="e.g. Services growth below 10% two quarters in a row" value="' + esc(d.kill) + '"></div>';
    h += '<div class="btnrow" style="margin-top:6px"><button class="btn" data-act="draft-later">' + (d.mode === 'watch' ? 'Skip' : 'Later') + '</button><button class="btn pri" data-act="draft-save" style="flex:2">Save thesis</button></div>';
    return subBar('Thesis', { close: true }) + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- lot detail / reflection
  function scrLot(id) {
    var l = S.lots.filter(function (z) { return z.id === id; })[0];
    if (!l) return subBar('Lot') + '<main class="main"><div class="empty"><h3>Lot not found</h3></div></main>';
    var x = T(l.t), th = l.thesis, h = '';
    var closed = l.status === 'closed';
    var R = UI.reflect && UI.reflect.id === id ? UI.reflect : null;
    if (!th) {
      h += '<div class="empty"><h3>No thesis on this lot</h3><p>Write down why you bought ' + l.t + ' so you can check it before selling.</p><button class="btn pri sm" data-act="thesis-lot" data-id="' + l.id + '">Write thesis</button></div>';
    } else {
      h += '<div><h1 class="disp" style="margin:0;font-size:24px;font-weight:700;letter-spacing:-.4px;line-height:1.2">' + (R ? 'Before you sell, reread your why.' : esc(l.t) + ' · Lot from ' + fmtDate(l.date)) + '</h1><p class="muted" style="margin:6px 0 0;font-size:13px">Thesis written ' + fmtDate(th.createdAt) + ' · ' + daysBetween(th.createdAt, new Date().toISOString()) + ' days ago</p></div>';
      h += '<blockquote class="quote"><div class="mono" style="font-size:11px;color:var(--accent);letter-spacing:.8px">YOUR THESIS</div><p>“' + esc(th.title) + (th.why ? ' — ' + esc(th.why) : '') + '”</p></blockquote>';
      h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:10px">Then vs. now</h2><div style="display:flex;flex-direction:column;gap:10px">' + checks(l, x).join('') + '</div></section>';
      if ((th.pins || []).length) h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Pinned evidence</h2><div class="list">' + th.pins.map(function (p) {
        var u = safeUrl(p.url);
        var inner = '<span class="tag ' + (p.type === 'article' ? 'tag-sec' : p.type === 'excerpt' ? 'tag-quant' : 'tag-news') + '">' + p.type.toUpperCase() + '</span><span class="body"><span class="t1">' + esc(p.text) + '</span>' + (p.meta ? '<span class="t2">' + esc(p.meta) + '</span>' : '') + '</span>';
        return u ? '<a class="item" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + inner + ic('link', 14) + '</a>' : '<div class="item">' + inner + '</div>';
      }).join('') + '</div></section>';
    }
    if (closed) {
      h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Closed ' + fmtDate(l.sell.date) + '</h2><p style="margin:0;font-size:14px">Sold ' + fmtShares(l.shares) + ' sh at ' + money(l.sell.price) + ' (' + pct((l.sell.price / l.price - 1) * 100) + '). Reason: ' + esc(l.sell.reason) + '.</p>' + (l.sell.note ? '<p class="muted" style="margin:6px 0 0;font-size:13px">' + esc(l.sell.note) + '</p>' : '') + '</section>';
    } else if (R) {
      var reasons = ['Thesis broken', 'Hit target', 'Rebalancing', 'Need cash', 'Price dropped', 'Found a better idea'];
      h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Why are you selling?</h2><div class="chips">' + reasons.map(function (r) { return '<button class="chip" data-act="reason" data-r="' + esc(r) + '" aria-pressed="' + (R.reason === r) + '">' + esc(r) + '</button>'; }).join('') + '</div>';
      var green = th && checksGreen(l, x);
      if (R.reason === 'Price dropped' && green) h += '<p class="note" style="margin:10px 0 0">Your thesis checks are still green. A falling price alone is not a broken thesis. Consider waiting 48 hours before deciding.</p>';
      h += '</section><div class="grid2"><div class="field"><label for="f-sp">Sell price</label><input class="in mono" id="f-sp" data-rf="price" inputmode="decimal" value="' + esc(R.price) + '"></div><div class="field"><label for="f-sd">Date</label><input class="in" id="f-sd" type="date" data-rf="date" max="' + today() + '" value="' + esc(R.date) + '"></div></div>' +
        '<div class="field"><label for="f-sn">Note to future you <span class="opt">(optional)</span></label><input class="in" id="f-sn" data-rf="note" value="' + esc(R.note) + '"></div>' +
        '<div class="btnrow"><button class="btn pri" data-act="keep">Keep holding</button><button class="btn dng" data-act="sell-confirm"' + (R.reason ? '' : ' disabled') + '>Sell &amp; log reason</button></div>';
    } else {
      if (th) {
        var st = lotStatus(l);
        h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Thesis status</h2><div class="seg" role="radiogroup" aria-label="Thesis status">' + [['ok', 'On track'], ['review', 'Review'], ['broken', 'Broken']].map(function (s) { return '<button role="radio" data-act="tstatus" data-s="' + s[0] + '" aria-pressed="' + (st === s[0]) + '" aria-checked="' + (st === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div></section>';
      }
      h += '<div class="btnrow">' + (th ? '<button class="btn" data-act="thesis-lot" data-id="' + l.id + '">Edit thesis</button>' : '') + '<button class="btn dng" data-act="sell" data-id="' + l.id + '">Sell…</button></div>';
      h += '<button class="btn sm" data-act="del-lot" data-id="' + l.id + '" style="border:0;color:var(--muted)">' + (UI.confirmDel === l.id ? 'Tap again to delete this lot permanently' : 'Delete lot (entered by mistake)') + '</button>';
    }
    return subBar((R ? 'SELL ' : '') + l.t + ' · ' + fmtShares(l.shares) + ' SH', { close: !!R }) + '<main class="main" id="main">' + h + '</main>';
  }
  function checks(l, x) {
    var th = l.thesis, out = [], snap = th.snap || {};
    function row(mark, txt, sub) { var c = mark === '✓' ? 'up' : mark === '✗' ? 'down' : ''; return '<div class="check"><span class="m ' + c + '" style="' + (mark === '◐' ? 'color:var(--accent)' : '') + '">' + mark + '</span><span style="flex:1">' + txt + (sub ? '<br><span class="s">' + sub + '</span>' : '') + '</span></div>'; }
    if (!x) return [row('◐', 'No market data for ' + esc(l.t))];
    if (th.target) {
      var p = x.price / th.target * 100, mLeft = horizonLeft(th);
      out.push(row(p >= 100 ? '✓' : '◐', 'Target exit ' + money(th.target, 0) + ' · ' + th.horizon, 'Now ' + money(x.price) + ', ' + p.toFixed(0) + '% of target' + (mLeft != null ? ', ' + mLeft : '')));
    }
    var r = (x.price / l.price - 1) * 100, b = benchRet(l.date, today());
    out.push(row(r >= 0 ? '✓' : '✗', 'Price since purchase ' + pct(r), b != null ? 'S&amp;P 500 over the same period: ' + pct(b * 100) : ''));
    if (snap.quant != null && x.quant.score != null) out.push(row(x.quant.score >= snap.quant - 5 ? '✓' : '✗', 'Quant score ' + snap.quant + ' → ' + x.quant.score, 'When you wrote the thesis vs today'));
    if (snap.bull != null) out.push(row(x.sentiment.bull >= snap.bull - 10 ? '✓' : '✗', 'Consensus ' + snap.bull + '% → ' + x.sentiment.bull + '% bullish', 'News, quant and trend blend'));
    if (th.kill) out.push('<div class="check"><span class="m ' + (th.killed ? 'down' : 'up') + '">' + (th.killed ? '✗' : '✓') + '</span><span style="flex:1">Kill criteria ' + (th.killed ? 'triggered' : 'not triggered') + '<br><span class="s">“' + esc(th.kill) + '”</span><br><button class="btn sm" data-act="kill" data-id="' + l.id + '" style="margin-top:6px;min-height:34px">' + (th.killed ? 'Mark as not triggered' : 'Mark as triggered') + '</button></span></div>');
    return out;
  }
  function checksGreen(l, x) { var th = l.thesis; if (!x || th.killed) return false; var snap = th.snap || {}; if (snap.quant != null && x.quant.score < snap.quant - 5) return false; return true; }
  function horizonLeft(th) {
    var m = parseInt(th.horizon, 10); if (!m) return null; var end = new Date(th.createdAt); end.setMonth(end.getMonth() + m);
    var d = daysBetween(new Date().toISOString(), end.toISOString()); return d >= 0 ? (d > 60 ? Math.round(d / 30) + ' months left' : d + ' days left') : 'horizon passed';
  }

  // ---- watchlist thesis view
  function scrWThesis(t) {
    var th = S.watchTheses[t]; if (!th) return subBar(t) + '<main class="main"><div class="empty"><h3>No thesis</h3></div></main>';
    var fake = { t: t, price: th.snap && th.snap.price || (T(t) ? T(t).price : 0), date: th.createdAt.slice(0, 10), thesis: th, id: 'w-' + t };
    var x = T(t);
    var h = '<blockquote class="quote"><div class="mono" style="font-size:11px;color:var(--accent);letter-spacing:.8px">WATCHLIST THESIS · ' + t + '</div><p>“' + esc(th.title) + (th.why ? ' — ' + esc(th.why) : '') + '”</p></blockquote>' +
      '<section class="card"><h2 class="eyebrow" style="margin-bottom:10px">Then vs. now</h2><div style="display:flex;flex-direction:column;gap:10px">' + checks(fake, x).filter(function (s) { return s.indexOf('data-act="kill"') < 0; }).join('') + '</div></section>' +
      '<div class="btnrow"><button class="btn" data-act="del-wthesis" data-t="' + t + '">Delete thesis</button><button class="btn pri" data-act="add" data-t="' + t + '">Add a lot</button></div>';
    return subBar(t + ' thesis') + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- divergence detail
  function scrAlert(t) {
    var a = (D.alerts || []).filter(function (z) { return z.t === t; })[0], x = T(t);
    if (!a || !x) return subBar('Divergence alert') + '<main class="main"><div class="empty"><h3>This alert has cleared</h3><p>Price and fundamentals are no longer moving apart for ' + esc(t) + '.</p></div></main>';
    var k = alertKey(a); if (S.seenAlerts.indexOf(k) < 0) { S.seenAlerts.push(k); S.seenAlerts = S.seenAlerts.slice(-200); save(); }
    var qs = x.quant.series, s = x.sentiment;
    var h = '<div style="padding:12px 14px;border-radius:18px;background:#1F2533;border:1px solid #323C50;display:flex;gap:12px"><span style="flex:none;width:36px;height:36px;border-radius:9px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--accent)">' + ic('logo', 20) + '</span><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font-size:12px" class="muted"><span>CONVERGE · Alert</span><span>' + ago(a.date) + '</span></div><div style="font-size:13px;line-height:1.4;margin-top:3px">' + esc(a.text) + '</div></div></div>';
    h += '<section class="card"><h1 class="disp" style="margin:0;font-size:20px;font-weight:700">' + esc(a.title) + '</h1><div class="legend" style="margin-top:8px"><span><i style="border-color:var(--bear)"></i>Price</span><span><i style="border-color:var(--info);border-top-style:dashed"></i>Quant score</span><span class="muted">Shaded: last 5 weeks</span></div><div style="margin-top:8px">' + dualChart(qs.map(function (p) { return p.p; }), qs.map(function (p) { return p.s; })) + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px" class="muted mono"><span>' + (qs[0] ? fmtDate(qs[0].d) : '') + '</span><span>' + (qs.length ? fmtDate(qs[qs.length - 1].d) : '') + '</span></div></section>';
    h += '<section class="kv"><div><div class="k">Price · 5d</div><div class="v ' + cls(x.chg5d) + '">' + arrowPct(x.chg5d) + '</div></div><div><div class="k">Quant score</div><div class="v" style="color:var(--info)">' + (x.quant.score == null ? '—' : x.quant.score) + (x.quant.high6m ? ' · 6M high' : x.quant.low6m ? ' · 6M low' : '') + '</div></div><div><div class="k">News tone 7d</div><div class="v" style="color:var(--info)">' + s.newsBull7d + '% <span style="font-size:11px" class="muted">vs ' + s.newsBullPrev7d + '%</span></div></div></section>';
    var recent = (D.news || []).filter(function (n) { return n.t === t && Date.now() - Date.parse(n.date) < 8 * 86400000; }).sort(function (p, q) { return (q.merged - p.merged) || q.date.localeCompare(p.date); }).slice(0, 4);
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">What moved it this week</h2><div class="list">' + (recent.length ? recent.map(function (n) { return itemRow({ k: n.kind, t: n.t, title: n.title, tag: n.sent > 0 ? 'POS' : n.sent < 0 ? 'NEG' : 'NEWS', tagc: n.sent > 0 ? 'tag-bull' : n.sent < 0 ? 'tag-bear' : 'tag-news', meta: n.source + (n.merged > 1 ? ' + ' + (n.merged - 1) + ' more' : '') + ' · ' + ago(n.date), url: n.url, source: n.source }); }).join('') : '<p class="muted" style="margin:0;font-size:13px">No company-specific headlines this week. The move may be market- or sector-wide.</p>') + '</div></section>';
    var th = thesisFor(t);
    h += '<div style="display:flex;flex-direction:column;gap:8px"><button class="btn pri" data-act="battle" data-t="' + t + '" data-side="' + (a.type === 'bear' ? 'bear' : 'bull') + '">Review ' + (a.type === 'bear' ? 'bear' : 'bull') + ' case</button>' + (th && th.lot ? '<button class="btn" data-act="lot" data-id="' + th.lot.id + '">Open my thesis</button>' : '') + '</div>';
    return subBar('Divergence alert') + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- flash briefing
  function briefCandidates() {
    var mine = myTickers(), set = {}; mine.forEach(function (t) { set[t] = 1; });
    return (D.briefing || []).filter(function (b) { return set[b.t] && !(S.signal && b.type === 'NEWS'); });
  }
  function briefState() {
    if (S.brief.day !== today()) { S.brief = { day: today(), picked: [], skipped: [] }; save(); }
    var c = briefCandidates(), done = {}; S.brief.picked.concat(S.brief.skipped).forEach(function (id) { done[id] = 1; });
    var byId = {}; c.forEach(function (b) { byId[b.id] = b; });
    return { all: c, pending: c.filter(function (b) { return !done[b.id]; }), queue: S.brief.picked.map(function (id) { return byId[id]; }).filter(Boolean) };
  }
  function fmtSec(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function scrBriefing() {
    var B = briefState(), card = B.pending[0];
    var total = B.queue.reduce(function (s, b) { return s + b.sec; }, 0) + (B.queue.length ? 12 : 0);
    var reviewed = B.all.length - B.pending.length;
    var h = '<div><div style="display:flex;justify-content:space-between;font-size:12px" class="muted"><span>' + reviewed + ' of ' + B.all.length + ' reviewed</span><span class="mono" style="color:var(--accent)">' + fmtSec(total) + ' · goal 3–5 min</span></div>' +
      '<div style="height:6px;background:var(--surface2);border-radius:999px;margin-top:6px;position:relative;overflow:hidden"><div style="position:absolute;left:60%;width:40%;height:6px;background:var(--accent-soft)"></div><div style="position:absolute;left:0;width:' + clamp(total / 300 * 100, 0, 100) + '%;height:6px;background:var(--accent);border-radius:999px"></div></div></div>';
    if (!B.all.length) {
      h += '<div class="empty"><h3>Nothing new for your tickers</h3><p>The briefing only uses news, filings and quant changes from the last 72 hours for stocks you hold or watch. Add tickers to your watchlist to widen it.</p></div>';
    } else {
      h += '<div class="stack"><div class="ghost g1"></div><div class="ghost g2"></div>' + (card ? '<article class="swipe" id="swipe" data-id="' + esc(card.id) + '"><div style="display:flex;justify-content:space-between;align-items:center"><span class="tag ' + ({ 'SEC FILING': 'tag-sec', QUANT: 'tag-quant', DIVERGENCE: 'tag-div' }[card.type] || 'tag-news') + '">' + esc(card.type) + '</span><span class="mono muted" style="font-size:12px">0:' + ('0' + Math.min(59, card.sec)).slice(-2) + '</span></div><div class="disp" style="font-size:13px;color:var(--accent);font-weight:700">' + esc(card.t) + ' · ' + ago(card.date) + '</div><h2>' + esc(card.title) + '</h2><p class="why">' + esc(card.why) + '</p><div class="hint"><span>← swipe to skip</span><span>swipe to add →</span></div></article>'
        : '<div class="swipe" style="align-items:center;justify-content:center;text-align:center"><div class="disp" style="font-size:22px;font-weight:700">Queue curated</div><div class="muted" style="font-size:13px">' + B.queue.length + ' items. Press play to listen.</div><button class="btn sm" data-act="brief-reset">Start over</button></div>') + '</div>';
      h += '<div class="swipebtns"><button class="round no" data-act="brief-skip" aria-label="Skip this item"' + (card ? '' : ' disabled') + '>' + ic('x', 24) + '</button><button class="round yes" data-act="brief-add" aria-label="Add to briefing"' + (card ? '' : ' disabled') + '>' + ic('check', 26) + '</button></div>';
    }
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">In your briefing</h2><div class="list" style="gap:6px">' + (B.queue.length ? B.queue.map(function (q, i) { return '<div class="qrow' + (UI.speakIdx === i ? ' now' : '') + '"><span class="mono" style="color:var(--accent);width:44px">' + esc(q.t) + '</span><span class="x">' + esc(q.title) + '</span><span class="mono muted">' + fmtSec(q.sec) + '</span></div>'; }).join('') : '<p class="muted" style="margin:0;font-size:13px">Swipe right on the items you want to hear.</p>') + '</div></section>';
    h += '<div class="player" style="margin-top:auto"><button class="pb" data-act="brief-play" aria-label="' + (UI.speaking ? 'Stop briefing' : 'Play briefing') + '"' + (B.queue.length ? '' : ' disabled') + '>' + ic(UI.speaking ? 'pause' : 'play', 18) + '</button><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + (UI.speaking ? (UI.speakIdx >= 0 ? 'Playing ' + (UI.speakIdx + 1) + ' of ' + B.queue.length : 'Playing your briefing') : 'Today’s briefing · ' + fmtSec(total)) + '</div><div style="font-size:12px">' + (naturalVoice() ? 'Natural voice' : ttsAvailable() ? 'Your device’s best available voice' : 'Audio is not available in this browser') + '</div></div></div>';
    return subBar('Executive Flash Briefing') + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- source profile
  function scrSource(name) {
    var s = sourceInfo(name), h = '';
    var C = 2 * Math.PI * 44, acc = s && s.rated ? s.acc : null;
    h += '<section style="display:flex;gap:16px;align-items:center"><div class="ring"><svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="44" fill="none" stroke="var(--surface2)" stroke-width="10"></circle>' + (acc != null ? '<circle cx="52" cy="52" r="44" fill="none" stroke="' + (isTop(name) ? 'var(--bull)' : 'var(--accent)') + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * acc / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 52 52)"></circle>' : '') + '</svg><div class="c"><span class="disp" style="font-size:' + (acc != null ? 28 : 16) + 'px;font-weight:700">' + (acc != null ? Math.round(acc) + '%' : 'Unrated') + '</span><span class="muted" style="font-size:10px">ACCURACY</span></div></div>' +
      '<div style="flex:1;min-width:0"><h1 class="disp" style="margin:0;font-size:22px;font-weight:700;overflow-wrap:anywhere">' + esc(name) + '</h1><div class="muted" style="font-size:12px;margin-top:2px">News outlet / publisher</div>' + (isTop(name) ? '<span class="status st-review" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px">' + ic('trophy', 12) + 'Top performer</span>' : '') + '</div></section>';
    var m = D.method || {};
    h += '<section class="kv"><div><div class="k">Scored calls</div><div class="v">' + (s ? s.calls : 0) + '</div></div><div><div class="k">Correct</div><div class="v">' + (s ? s.correct : 0) + '</div></div><div><div class="k">Top cut</div><div class="v">' + (D.topPerformerCut != null ? Math.round(D.topPerformerCut) + '%' : '—') + '</div></div></section>';
    if (s && !s.rated) h += '<p class="note" style="margin:0">Needs ' + (m.minCallsForRating || 10) + ' scored calls for a rating. ' + s.calls + ' so far.</p>';
    if (s && s.recent && s.recent.length) {
      h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Recent calls · scored after ' + (m.accuracyHorizonDays || 5) + ' trading days</h2><div class="card" style="padding:0;overflow:hidden">' + s.recent.map(function (r) {
        return '<div class="callrow"><span class="mono" style="width:46px">' + esc(r.t) + '</span><span class="tag ' + (r.sent > 0 ? 'tag-bull' : 'tag-bear') + '">' + (r.sent > 0 ? 'UP' : 'DOWN') + '</span><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="muted" title="' + esc(r.title) + '">' + esc(r.title || r.date) + '</span><span class="mono ' + (r.ok ? 'up' : 'down') + '" style="white-space:nowrap">' + pct(r.r) + '</span><span class="' + (r.ok ? 'up' : 'down') + '" aria-label="' + (r.ok ? 'Correct' : 'Missed') + '">' + (r.ok ? '✓' : '✗') + '</span></div>';
      }).join('') + '</div></section>';
    }
    h += '<details class="card" style="padding:12px 14px"><summary style="font-size:13px;font-weight:600;cursor:pointer">How the Prediction Accuracy Score works</summary><p style="margin:8px 0 0;font-size:12px;color:var(--fg2);line-height:1.5">Every headline with a clear positive or negative tone counts as a call on that stock. ' + (m.accuracyHorizonDays || 5) + ' trading days later, a positive call is correct if the stock beat the S&amp;P 500 (SPY), and a negative call is correct if it lagged. Sources with fewer than ' + (m.minCallsForRating || 10) + ' scored calls show as Unrated. The record grows every time the data refreshes.</p></details>';
    var muted = S.muted.indexOf(name) >= 0;
    h += '<button class="btn" data-act="mute" data-name="' + esc(name) + '">' + (muted ? 'Unmute source' : 'Mute this source') + '</button>';
    return subBar('Source profile') + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- settings
  function scrSettings() {
    var h = '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Market data</h2><p style="margin:0;font-size:13px;line-height:1.5">Updated ' + esc(new Date(D.generatedAt).toLocaleString()) + ' (' + ago(D.generatedAt) + ').<br>Loaded from: ' + (DS.source === 'live' ? 'the live feed' : DS.source === 'snapshot' ? 'the snapshot built into this page' : 'the copy bundled with the app') + '.</p>' +
      '<p class="muted" style="margin:8px 0 0;font-size:12px;line-height:1.5">Sources: ' + esc((D.method && D.method.sources || []).join(' · ')) + '. Refreshed automatically every hour.</p>' +
      '<button class="btn sm" data-act="refresh" style="margin-top:10px">' + ic('refresh', 16) + 'Refresh now</button></section>';
    var ss = (D.method && D.method.sourceStatus) || {};
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">News &amp; data sources</h2>' + Object.keys(ss).map(function (k) { var x = ss[k], ok = x.ok > 0; return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)"><span>' + esc(k) + '</span><span class="mono ' + (ok ? 'up' : 'down') + '">' + (ok ? 'Live · ' + x.items + ' items' : 'Unavailable') + '</span></div>'; }).join('') +
      '<p class="muted" style="margin:8px 0 0;font-size:12px;line-height:1.5">Finviz, StockAnalysis and X open as links from each ticker. Their terms or paid APIs don’t allow pulling their data into the app.</p></section>';
    if (isNative && plugin('LocalNotifications')) h += '<button class="rowtoggle" data-act="notify" aria-pressed="' + S.notify + '"><span><span class="t1">Divergence alerts</span><span class="t2">Notify me when a stock I hold or watch diverges</span></span><span class="sw"></span></button>';
    if (forumReady()) h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Discussion account</h2>' + (S.auth ? '<p style="margin:0 0 10px;font-size:13px">Signed in as <b>' + esc(S.auth.name || S.auth.user.email) + '</b></p><button class="btn sm" data-act="forum-signout">Sign out</button>' : '<button class="btn sm pri" data-act="forum-auth">Sign in or create an account</button>') + '</section>';
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Muted sources</h2>' + (S.muted.length ? S.muted.map(function (m) { return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0"><span>' + esc(m) + '</span><button class="btn sm" data-act="mute" data-name="' + esc(m) + '">Unmute</button></div>'; }).join('') : '<p class="muted" style="margin:0;font-size:13px">None. Mute a source from its profile.</p>') + '</section>';
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Your data</h2><p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Lots, theses and your watchlist are stored only on this device.</p><button class="btn sm dng" data-act="reset">' + (UI.confirmReset ? 'Tap again to erase everything' : 'Erase all my data') + '</button></section>';
    h += '<p class="foot">Converge · Covers ' + D.universe.length + ' tickers · <a href="' + CFG.repo + '" target="_blank" rel="noopener noreferrer">Source code</a><br>Information only, not investment advice.</p>';
    return subBar('Settings') + '<main class="main" id="main">' + h + '</main>';
  }

  // ------------------------------------------------------------------ scanner (Finviz-style screener)
  var SC = null, SCS = { loading: false, error: null, source: null };
  function loadScanner(force) {
    if (SCS.loading || (SC && !force)) return;
    SCS.loading = true; render();
    var snap = window.__CONVERGE_SCANNER__;
    fetchJson(CFG.remote.replace('market.json', 'scanner.json') + '?t=' + Math.floor(Date.now() / 60000), 12000)
      .then(function (d) { if (!d || d.kind !== 'scanner') throw new Error('bad'); return { d: d, src: 'live' }; })
      .catch(function () {
        if (snap && snap.kind === 'scanner') return { d: snap, src: 'snapshot' };
        return fetchJson(CFG.bundled.replace('market.json', 'scanner.json')).then(function (d) { if (!d || d.kind !== 'scanner') throw new Error('bad'); return { d: d, src: 'bundled' }; });
      })
      .then(function (r) { SC = r.d; SCS.source = r.src; SCS.error = null; SCS.loading = false; buildFilterDefs(); render(); })
      .catch(function () { SCS.loading = false; SCS.error = 'Scanner data is not available yet. It is rebuilt every hour; try again shortly.'; render(); });
  }
  function scanState() {
    if (!S.scan) S.scan = { f: {}, signal: 'none', view: 'overview', sort: { k: 'mc', dir: -1 }, saved: [], group: 'Descriptive', open: true };
    return S.scan;
  }
  function nz(x) { return x != null && isFinite(x); }
  function gt(k, v) { return function (r) { return nz(r[k]) && r[k] > v; }; }
  function lt(k, v) { return function (r) { return nz(r[k]) && r[k] < v; }; }
  function between(k, a, b) { return function (r) { return nz(r[k]) && r[k] >= a && r[k] <= b; }; }
  function kfmt(v) { return v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'K' : String(v); }
  function overs(k, vals, f, pre) { return vals.map(function (v) { return [(pre || 'Over ') + (f ? f(v) : v), gt(k, v)]; }); }
  function unders(k, vals, f) { return vals.map(function (v) { return ['Under ' + (f ? f(v) : v), lt(k, v)]; }); }
  var pctf = function (v) { return v + '%'; };
  function perfOpts(k, name, today) {
    var steps = today ? [1, 2, 3, 5, 10, 15] : [5, 10, 20, 30, 50, 100];
    var o = [[name + ' Up', gt(k, 0)], [name + ' Down', lt(k, 0)]];
    steps.forEach(function (s) { o.push([name + ' +' + s + '%', gt(k, s)]); });
    steps.forEach(function (s) { o.push([name + ' -' + s + '%', lt(k, -s)]); });
    return o;
  }
  function smaOpts(k, name, crossK, rel) {
    var o = [['Price below ' + name, lt(k, 0)], ['Price above ' + name, gt(k, 0)]];
    [10, 20, 30, 40, 50].forEach(function (s) { o.push(['Price ' + s + '% below ' + name, lt(k, -s)]); });
    [10, 20, 30, 40, 50].forEach(function (s) { o.push(['Price ' + s + '% above ' + name, gt(k, s)]); });
    o.push(['Price crossed ' + name, function (r) { return r[crossK] !== 0 && r[crossK] != null; }]);
    o.push(['Price crossed ' + name + ' above', function (r) { return r[crossK] === 1; }]);
    o.push(['Price crossed ' + name + ' below', function (r) { return r[crossK] === -1; }]);
    rel.forEach(function (x) {
      o.push([x[0] + ' above ' + x[1], function (r) { return r[x[2]] === x[3]; }]);
      o.push([x[0] + ' below ' + x[1], function (r) { return r[x[2]] === -x[3]; }]);
      if (x[4]) { o.push([x[0] + ' crossed ' + x[1] + ' above', function (r) { return r[x[4]] === x[3]; }]); o.push([x[0] + ' crossed ' + x[1] + ' below', function (r) { return r[x[4]] === -x[3]; }]); }
    });
    return o;
  }
  function hiloOpts(hk, lk, name) {
    var o = [['New High', function (r) { return nz(r[hk]) && r[hk] >= -0.01; }], ['New Low', function (r) { return nz(r[lk]) && r[lk] <= 0.01; }]];
    [5, 10, 15, 20, 30, 40, 50].forEach(function (s) { o.push([s + '% or more below High', lt(hk, -s)]); });
    [3, 5, 10].forEach(function (s) { o.push(['0-' + s + '% below High', between(hk, -s, 0)]); });
    [3, 5, 10].forEach(function (s) { o.push(['0-' + s + '% above Low', between(lk, 0, s)]); });
    [5, 10, 15, 20, 30, 40, 50, 100].forEach(function (s) { o.push([s + '% or more above Low', gt(lk, s)]); });
    return o;
  }
  var FDEFS = [], FIDX = {};
  function uniq(k) { var s = {}; SC.rows.forEach(function (r) { if (r[k]) s[r[k]] = 1; }); return Object.keys(s).sort(); }
  function buildFilterDefs() {
    var mcap = function (a, b) { return function (r) { return nz(r.mc) && r.mc >= a && (b == null || r.mc < b); }; };
    var B = 1e9, M = 1e6;
    FDEFS = [
      // Descriptive
      { g: 'Descriptive', id: 'ex', label: 'Exchange', o: ['AMEX', 'NASDAQ', 'NYSE'].map(function (x) { return [x, function (r) { return r.ex === x; }]; }) },
      { g: 'Descriptive', id: 'idx', label: 'Index', o: [['S&P 500', function (r) { return (r.idx || []).indexOf('S&P 500') >= 0; }], ['DJIA', function (r) { return (r.idx || []).indexOf('DJIA') >= 0; }]] },
      { g: 'Descriptive', id: 'sec', label: 'Sector', o: uniq('sec').map(function (x) { return [x, function (r) { return r.sec === x; }]; }) },
      { g: 'Descriptive', id: 'ind', label: 'Industry', o: uniq('ind').map(function (x) { return [x, function (r) { return r.ind === x; }]; }) },
      { g: 'Descriptive', id: 'ctry', label: 'Country', o: uniq('ctry').map(function (x) { return [x, function (r) { return r.ctry === x; }]; }) },
      { g: 'Descriptive', id: 'mc', label: 'Market Cap.', o: [['Mega ($200bln and more)', mcap(200 * B)], ['Large ($10bln to $200bln)', mcap(10 * B, 200 * B)], ['Mid ($2bln to $10bln)', mcap(2 * B, 10 * B)], ['Small ($300mln to $2bln)', mcap(300 * M, 2 * B)], ['Micro ($50mln to $300mln)', mcap(50 * M, 300 * M)], ['+Large (over $10bln)', mcap(10 * B)], ['+Mid (over $2bln)', mcap(2 * B)], ['+Small (over $300mln)', mcap(300 * M)], ['-Large (under $200bln)', mcap(0, 200 * B)], ['-Mid (under $10bln)', mcap(0, 10 * B)], ['-Small (under $2bln)', mcap(0, 2 * B)]] },
      { g: 'Descriptive', id: 'dy', label: 'Dividend Yield', fund: true, o: [['None (0%)', function (r) { return !r.dy; }], ['Positive (>0%)', gt('dy', 0)], ['High (>5%)', gt('dy', 5)], ['Very High (>10%)', gt('dy', 10)]].concat(overs('dy', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pctf)) },
      { g: 'Descriptive', id: 'av', label: 'Average Volume', o: unders('av', [5e4, 1e5, 5e5, 7.5e5, 1e6], kfmt).concat(overs('av', [5e4, 1e5, 2e5, 3e5, 4e5, 5e5, 7.5e5, 1e6, 2e6], kfmt)).concat([['100K to 500K', between('av', 1e5, 5e5)], ['100K to 1M', between('av', 1e5, 1e6)], ['500K to 1M', between('av', 5e5, 1e6)], ['500K to 10M', between('av', 5e5, 1e7)]]) },
      { g: 'Descriptive', id: 'rv', label: 'Relative Volume', o: overs('rv', [10, 5, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]).concat(unders('rv', [2, 1.5, 1, 0.75, 0.5, 0.25, 0.1])) },
      { g: 'Descriptive', id: 'v', label: 'Current Volume', o: unders('v', [5e4, 1e5, 5e5, 7.5e5, 1e6], kfmt).concat(overs('v', [0, 5e4, 1e5, 2e5, 3e5, 4e5, 5e5, 7.5e5, 1e6, 2e6, 5e6, 1e7, 2e7], kfmt)) },
      { g: 'Descriptive', id: 'p', label: 'Price $', o: unders('p', [1, 2, 3, 4, 5, 7, 10, 15, 20, 30, 40, 50], function (v) { return '$' + v; }).concat(overs('p', [1, 2, 3, 4, 5, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100], function (v) { return '$' + v; })).concat([['$1 to $5', between('p', 1, 5)], ['$1 to $10', between('p', 1, 10)], ['$1 to $20', between('p', 1, 20)], ['$5 to $10', between('p', 5, 10)], ['$5 to $20', between('p', 5, 20)], ['$5 to $50', between('p', 5, 50)], ['$10 to $20', between('p', 10, 20)], ['$10 to $50', between('p', 10, 50)], ['$20 to $50', between('p', 20, 50)], ['$50 to $100', between('p', 50, 100)]]) },
      // Fundamental
      { g: 'Fundamental', id: 'pe', label: 'P/E', fund: true, o: [['Low (<15)', between('pe', 0.0001, 15)], ['Profitable (>0)', gt('pe', 0)], ['High (>50)', gt('pe', 50)]].concat(unders('pe', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50])).concat(overs('pe', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50])) },
      { g: 'Fundamental', id: 'ps', label: 'Price/Sales', fund: true, o: [['Low (<1)', lt('ps', 1)], ['High (>10)', gt('ps', 10)]].concat(unders('ps', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).concat(overs('ps', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) },
      { g: 'Fundamental', id: 'pb', label: 'Price/Book', fund: true, o: [['Low (<1)', lt('pb', 1)], ['High (>5)', gt('pb', 5)]].concat(unders('pb', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).concat(overs('pb', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) },
      { g: 'Fundamental', id: 'epsg', label: 'EPS growth this year', fund: true, o: [['Negative (<0%)', lt('epsg', 0)], ['Positive (>0%)', gt('epsg', 0)], ['Positive Low (0-10%)', between('epsg', 0, 10)], ['High (>25%)', gt('epsg', 25)]].concat(unders('epsg', [5, 10, 15, 20, 25, 30], pctf)).concat(overs('epsg', [5, 10, 15, 20, 25, 30], pctf)) },
      { g: 'Fundamental', id: 'sg', label: 'Sales growth (FY)', fund: true, o: [['Negative (<0%)', lt('sg', 0)], ['Positive (>0%)', gt('sg', 0)], ['Positive Low (0-10%)', between('sg', 0, 10)], ['High (>25%)', gt('sg', 25)]].concat(unders('sg', [5, 10, 15, 20, 25, 30], pctf)).concat(overs('sg', [5, 10, 15, 20, 25, 30], pctf)) },
      { g: 'Fundamental', id: 'roa', label: 'Return on Assets', fund: true, o: [['Positive (>0%)', gt('roa', 0)], ['Negative (<0%)', lt('roa', 0)], ['Very Positive (>15%)', gt('roa', 15)], ['Very Negative (<-15%)', lt('roa', -15)]].concat(overs('roa', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], pctf)).concat(unders('roa', [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5], pctf)) },
      { g: 'Fundamental', id: 'roe', label: 'Return on Equity', fund: true, o: [['Positive (>0%)', gt('roe', 0)], ['Negative (<0%)', lt('roe', 0)], ['Very Positive (>30%)', gt('roe', 30)], ['Very Negative (<-15%)', lt('roe', -15)]].concat(overs('roe', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], pctf)).concat(unders('roe', [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5], pctf)) },
      { g: 'Fundamental', id: 'cr', label: 'Current Ratio', fund: true, o: [['High (>3)', gt('cr', 3)], ['Low (<1)', lt('cr', 1)]].concat(unders('cr', [1, 0.5])).concat(overs('cr', [0.5, 1, 1.5, 2, 3, 4, 5, 10])) },
      { g: 'Fundamental', id: 'de', label: 'LT Debt/Equity', fund: true, o: [['High (>0.5)', gt('de', 0.5)], ['Low (<0.1)', lt('de', 0.1)]].concat(unders('de', [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1])).concat(overs('de', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])) },
      { g: 'Fundamental', id: 'gm', label: 'Gross Margin', fund: true, o: [['Positive (>0%)', gt('gm', 0)], ['Negative (<0%)', lt('gm', 0)], ['High (>50%)', gt('gm', 50)]].concat(overs('gm', [0, 10, 20, 30, 40, 50, 60, 70, 80, 90], pctf)).concat(unders('gm', [90, 80, 70, 60, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0], pctf)) },
      { g: 'Fundamental', id: 'om', label: 'Operating Margin', fund: true, o: [['Positive (>0%)', gt('om', 0)], ['Negative (<0%)', lt('om', 0)], ['Very Negative (<-20%)', lt('om', -20)], ['High (>25%)', gt('om', 25)]].concat(overs('om', [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90], pctf)).concat(unders('om', [90, 80, 70, 60, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0], pctf)) },
      { g: 'Fundamental', id: 'nm', label: 'Net Profit Margin', fund: true, o: [['Positive (>0%)', gt('nm', 0)], ['Negative (<0%)', lt('nm', 0)], ['Very Negative (<-20%)', lt('nm', -20)], ['High (>20%)', gt('nm', 20)]].concat(overs('nm', [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90], pctf)).concat(unders('nm', [90, 80, 70, 60, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0], pctf)) },
      { g: 'Fundamental', id: 'po', label: 'Payout Ratio', fund: true, o: [['None (0%)', function (r) { return !r.po; }], ['Positive (>0%)', gt('po', 0)], ['Low (<20%)', lt('po', 20)], ['High (>50%)', gt('po', 50)]].concat(overs('po', [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], pctf)).concat(unders('po', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], pctf)) },
      // Technical
      { g: 'Technical', id: 'perf', label: 'Performance', o: perfOpts('ch', 'Today', true).concat(perfOpts('pw', 'Week')).concat(perfOpts('pm', 'Month')).concat(perfOpts('pq', 'Quarter')).concat(perfOpts('ph', 'Half')).concat(perfOpts('pytd', 'YTD')).concat(perfOpts('py', 'Year')) },
      { g: 'Technical', id: 'perf2', label: 'Performance 2', o: perfOpts('ch', 'Today', true).concat(perfOpts('pw', 'Week')).concat(perfOpts('pm', 'Month')).concat(perfOpts('pq', 'Quarter')).concat(perfOpts('ph', 'Half')).concat(perfOpts('pytd', 'YTD')).concat(perfOpts('py', 'Year')) },
      { g: 'Technical', id: 'vol', label: 'Volatility', o: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(function (v) { return ['Week - Over ' + v + '%', gt('vw', v)]; }).concat([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(function (v) { return ['Month - Over ' + v + '%', gt('vm', v)]; })) },
      { g: 'Technical', id: 'rsi', label: 'RSI (14)', o: [['Overbought (90)', gt('rsi', 90)], ['Overbought (80)', gt('rsi', 80)], ['Overbought (70)', gt('rsi', 70)], ['Overbought (60)', gt('rsi', 60)], ['Oversold (40)', lt('rsi', 40)], ['Oversold (30)', lt('rsi', 30)], ['Oversold (20)', lt('rsi', 20)], ['Oversold (10)', lt('rsi', 10)], ['Not Overbought (<60)', lt('rsi', 60)], ['Not Overbought (<50)', lt('rsi', 50)], ['Not Oversold (>50)', gt('rsi', 50)], ['Not Oversold (>40)', gt('rsi', 40)]] },
      { g: 'Technical', id: 'sma20', label: '20-Day Simple Moving Average', o: smaOpts('s20', 'SMA20', 'xp20', [['SMA20', 'SMA50', 's20v50', 1, 'x20v50'], ['SMA20', 'SMA200', 's20v200', 1, 'x20v200']]) },
      { g: 'Technical', id: 'sma50', label: '50-Day Simple Moving Average', o: smaOpts('s50', 'SMA50', 'xp50', [['SMA50', 'SMA20', 's20v50', -1, 'x20v50'], ['SMA50', 'SMA200', 's50v200', 1, 'x50v200']]) },
      { g: 'Technical', id: 'sma200', label: '200-Day Simple Moving Average', o: smaOpts('s200', 'SMA200', 'xp200', [['SMA200', 'SMA20', 's20v200', -1, 'x20v200'], ['SMA200', 'SMA50', 's50v200', -1, 'x50v200']]) },
      { g: 'Technical', id: 'ch', label: 'Change', o: [['Up', gt('ch', 0)], ['Down', lt('ch', 0)]].concat([1, 2, 3, 4, 5, 10, 15, 20].map(function (v) { return ['Up ' + v + '%', gt('ch', v)]; })).concat([1, 2, 3, 4, 5, 10, 15, 20].map(function (v) { return ['Down ' + v + '%', lt('ch', -v)]; })) },
      { g: 'Technical', id: 'hl20', label: '20-Day High/Low', o: hiloOpts('hi20', 'lo20', '20-Day') },
      { g: 'Technical', id: 'hl50', label: '50-Day High/Low', o: hiloOpts('hi50', 'lo50', '50-Day') },
      { g: 'Technical', id: 'hl52', label: '52-Week High/Low', o: hiloOpts('hi52', 'lo52', '52-Week') },
      { g: 'Technical', id: 'beta', label: 'Beta', o: unders('beta', [0, 0.5, 1, 1.5, 2]).concat(overs('beta', [0, 0.5, 1, 1.5, 2, 2.5, 3, 4])).concat([['0 to 0.5', between('beta', 0, 0.5)], ['0 to 1', between('beta', 0, 1)], ['0.5 to 1', between('beta', 0.5, 1)], ['0.5 to 1.5', between('beta', 0.5, 1.5)], ['1 to 1.5', between('beta', 1, 1.5)], ['1 to 2', between('beta', 1, 2)]]) },
      { g: 'Technical', id: 'atr', label: 'Average True Range', o: overs('atr', [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]).concat(unders('atr', [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])) }
    ];
    FIDX = {}; FDEFS.forEach(function (f) { FIDX[f.id] = f; });
  }
  var SIGNALS = [
    ['none', 'None (all stocks)', null, null],
    ['gainers', 'Top Gainers', function (r) { return r.ch > 0; }, { k: 'ch', dir: -1 }],
    ['losers', 'Top Losers', function (r) { return r.ch < 0; }, { k: 'ch', dir: 1 }],
    ['newhigh', 'New High', function (r) { return nz(r.hi52) && r.hi52 >= -0.01; }, { k: 'ch', dir: -1 }],
    ['newlow', 'New Low', function (r) { return nz(r.lo52) && r.lo52 <= 0.01; }, { k: 'ch', dir: 1 }],
    ['volatile', 'Most Volatile', function (r) { return nz(r.vw); }, { k: 'vw', dir: -1 }],
    ['active', 'Most Active', function (r) { return nz(r.v); }, { k: 'v', dir: -1 }],
    ['unusual', 'Unusual Volume', function (r) { return r.rv > 1.5; }, { k: 'rv', dir: -1 }],
    ['overbought', 'Overbought', function (r) { return r.rsi > 70; }, { k: 'rsi', dir: -1 }],
    ['oversold', 'Oversold', function (r) { return r.rsi < 30; }, { k: 'rsi', dir: 1 }],
    ['smaxup', 'Price crossed SMA50 above', function (r) { return r.xp50 === 1; }, { k: 'ch', dir: -1 }],
    ['goldencross', 'Golden cross (SMA50 crossed SMA200 above)', function (r) { return r.x50v200 === 1; }, { k: 'mc', dir: -1 }],
    ['deathcross', 'Death cross (SMA50 crossed SMA200 below)', function (r) { return r.x50v200 === -1; }, { k: 'mc', dir: -1 }]
  ];
  function sigDef(id) { for (var i = 0; i < SIGNALS.length; i++) if (SIGNALS[i][0] === id) return SIGNALS[i]; return SIGNALS[0]; }
  function bigNum(x) { if (!nz(x)) return '—'; var a = Math.abs(x); return a >= 1e12 ? (x / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (x / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : String(Math.round(x)); }
  function fx(d) { return function (x) { return nz(x) ? x.toFixed(d) : '—'; }; }
  function fpct(x) { return nz(x) ? x.toFixed(2) + '%' : '—'; }
  var COLS = {
    t: ['Ticker', null], n: ['Company', function (x) { return x || ''; }], sec: ['Sector', null], ind: ['Industry', null], ctry: ['Country', null],
    mc: ['Market Cap', bigNum], pe: ['P/E', fx(1)], ps: ['P/S', fx(2)], pb: ['P/B', fx(2)], eps: ['EPS (FY)', fx(2)], epsg: ['EPS this Y', fpct], sg: ['Sales Y/Y', fpct],
    dy: ['Dividend', fpct], roa: ['ROA', fpct], roe: ['ROE', fpct], cr: ['Curr R', fx(2)], de: ['LTDebt/Eq', fx(2)], gm: ['Gross M', fpct], om: ['Oper M', fpct], nm: ['Profit M', fpct], po: ['Payout', fpct],
    pw: ['Perf Week', fpct], pm: ['Perf Month', fpct], pq: ['Perf Quart', fpct], ph: ['Perf Half', fpct], py: ['Perf Year', fpct], pytd: ['Perf YTD', fpct], vw: ['Volatility W', fpct], vm: ['Volatility M', fpct],
    av: ['Avg Volume', bigNum], rv: ['Rel Volume', fx(2)], beta: ['Beta', fx(2)], atr: ['ATR', fx(2)], s20: ['SMA20', fpct], s50: ['SMA50', fpct], s200: ['SMA200', fpct], hi52: ['52W High', fpct], lo52: ['52W Low', fpct], rsi: ['RSI', fx(1)],
    p: ['Price', fx(2)], ch: ['Change', fpct], v: ['Volume', bigNum],
    av30: ['Avg Vol 30D', bigNum], rs3m: ['3M vs S&P', fpct], atrp: ['ATR %', fpct], udv: ['Up/Down Vol', fx(2)], qepsg: ['EPS Q/Q', fpct], qsg: ['Sales Q/Q', fpct], fcfy: ['FCF Yield', fpct], shy: ['Holder Yield', fpct]
  };
  var VIEWS = {
    overview: ['Overview', ['t', 'n', 'sec', 'ind', 'ctry', 'mc', 'pe', 'p', 'ch', 'v']],
    valuation: ['Valuation', ['t', 'mc', 'pe', 'ps', 'pb', 'eps', 'epsg', 'sg', 'p', 'ch', 'v']],
    financial: ['Financial', ['t', 'mc', 'dy', 'roa', 'roe', 'cr', 'de', 'gm', 'om', 'nm', 'po', 'p', 'ch', 'v']],
    performance: ['Performance', ['t', 'pw', 'pm', 'pq', 'ph', 'pytd', 'py', 'vw', 'vm', 'av', 'rv', 'p', 'ch', 'v']],
    technical: ['Technical', ['t', 'beta', 'atr', 's20', 's50', 's200', 'hi52', 'lo52', 'rsi', 'p', 'ch', 'v']],
    strategy: ['Strategy', ['t', 'p', 'ch', 'rv', 'mc', 'av30', 'rsi', 's20', 's50', 'rs3m', 'atrp', 'udv', 'hi52', 'qepsg', 'qsg', 'roe', 'pe', 'fcfy', 'shy', 'de']]
  };
  function scanResults() {
    var st = scanState(), preds = [];
    Object.keys(st.f).forEach(function (id) {
      var def = FIDX[id]; if (!def) return;
      if (def.fund && !SC.fundamentals) return;
      for (var i = 0; i < def.o.length; i++) if (def.o[i][0] === st.f[id]) { preds.push(def.o[i][1]); break; }
    });
    var sig = sigDef(st.signal); if (sig[2]) preds.push(sig[2]);
    preds = preds.concat(presetPreds());
    var rows = SC.rows.filter(function (r) { for (var i = 0; i < preds.length; i++) if (!preds[i](r)) return false; return true; });
    var k = st.sort.k, dir = st.sort.dir;
    rows.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (typeof x === 'string' || typeof y === 'string') return dir * String(x || '').localeCompare(String(y || ''));
      if (!nz(x)) return 1; if (!nz(y)) return -1; return dir * (x - y);
    });
    return rows;
  }
  function scrScan() {
    var st = scanState();
    var head = topBar('Scanner', '<button class="iconbtn" data-act="scan-refresh" aria-label="Reload scanner data">' + ic('refresh', 20) + '</button>');
    if (!SC) {
      if (!SCS.loading && !SCS.error) setTimeout(function () { loadScanner(); }, 0);
      return head + '<main class="main" id="main"><div class="loading">' + (SCS.error ? '<p style="margin:0">' + esc(SCS.error) + '</p><button class="btn sm pri" data-act="scan-refresh">Retry</button>' : '<span class="pulse" style="color:var(--accent)">' + ic('filter', 36) + '</span>Loading S&amp;P 500 scanner…') + '</div></main>';
    }
    var nActive = Object.keys(st.f).length;
    var h = '<div class="scan-top"><label class="sr" for="scan-signal">Signal</label><select class="in" id="scan-signal" data-scan="signal">' + SIGNALS.map(function (s) { return '<option value="' + s[0] + '"' + (st.signal === s[0] ? ' selected' : '') + '>Signal: ' + esc(s[1]) + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm" data-act="scan-toggle" aria-expanded="' + !!st.open + '">Filters' + (nActive ? ' (' + nActive + ')' : '') + '</button></div>';
    h += presetsCard();
    if (st.saved && st.saved.length) h += '<div class="chips">' + st.saved.map(function (s, i) { return '<button class="chip" data-act="scan-load" data-i="' + i + '">' + esc(s.name) + '</button>'; }).join('') + '</div>';
    if (st.open) {
      var groups = ['Descriptive', 'Fundamental', 'Technical', 'All'];
      h += '<section class="card" style="padding:12px"><div class="seg" role="tablist" aria-label="Filter groups">' + groups.map(function (g) { var n = Object.keys(st.f).filter(function (id) { return FIDX[id] && FIDX[id].g === g; }).length; return '<button role="tab" data-act="scan-group" data-g="' + g + '" aria-pressed="' + (st.group === g) + '">' + ({ Descriptive: 'Descr.', Fundamental: 'Fund.', Technical: 'Tech.', All: 'All' })[g] + (n ? ' ' + n : '') + '</button>'; }).join('') + '</div>';
      if ((st.group === 'Fundamental' || st.group === 'All') && !SC.fundamentals) h += '<p class="note" style="margin:10px 0 0">Fundamental filters need SEC data. Add the <b>SEC_USER_AGENT</b> secret in the GitHub repository and they switch on at the next hourly run.</p>';
      h += '<div class="fgrid">' + FDEFS.filter(function (f) { return st.group === 'All' || f.g === st.group; }).map(function (f) {
        var dis = f.fund && !SC.fundamentals, cur = st.f[f.id];
        return '<div class="field"><label for="sf-' + f.id + '">' + esc(f.label) + '</label><select class="in sel' + (cur ? ' on' : '') + '" id="sf-' + f.id + '" data-scanf="' + f.id + '"' + (dis ? ' disabled' : '') + '><option value="">Any</option>' + f.o.map(function (o) { return '<option' + (cur === o[0] ? ' selected' : '') + '>' + esc(o[0]) + '</option>'; }).join('') + '</select></div>';
      }).join('') + '</div>' +
        '<div class="btnrow" style="margin-top:10px"><button class="btn sm" data-act="scan-reset">Reset</button><button class="btn sm" data-act="scan-save">Save screen</button></div>' +
        '<p class="foot" style="text-align:left;margin:8px 0 0">Not available from free sources: analyst recommendation, short float, insider and institutional ownership, earnings date, target price, gap, change from open, chart patterns.</p></section>';
    }
    var rows = scanResults(), view = VIEWS[st.view] || VIEWS.overview, cols = view[1];
    h += '<div class="seg" role="tablist" aria-label="Table view">' + Object.keys(VIEWS).map(function (v) { return '<button role="tab" data-act="scan-view" data-v="' + v + '" aria-pressed="' + (st.view === v) + '">' + ({ overview: 'Overv.', valuation: 'Valua.', financial: 'Finan.', performance: 'Perf.', technical: 'Tech.', strategy: 'Strat.' })[v] + '</button>'; }).join('') + '</div>';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px" class="muted"><span><b style="color:var(--fg)">' + rows.length + '</b> of ' + SC.count + ' stocks · ' + esc(SC.universe) + '</span><span>' + ago(SC.generatedAt) + '</span></div>';
    var shown = rows.slice(0, UI.scanLimit || 100);
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th>' + cols.map(function (k) { var on = st.sort.k === k; return '<th><button data-act="scan-sort" data-k="' + k + '" class="' + (on ? 'on' : '') + '">' + esc(COLS[k][0]) + (on ? (st.sort.dir < 0 ? ' ▼' : ' ▲') : '') + '</button></th>'; }).join('') + '</tr></thead><tbody>' +
      shown.map(function (r, i) {
        return '<tr data-act="scan-row" data-t="' + esc(r.t) + '"><td class="dim">' + (i + 1) + '</td>' + cols.map(function (k) {
          var f = COLS[k][1], v = r[k], txt = f ? f(v) : esc(v == null ? '—' : v), c = '';
          if (k === 'ch' || k === 'pw' || k === 'pm' || k === 'pq' || k === 'ph' || k === 'py' || k === 'pytd' || k === 'epsg' || k === 'sg') c = nz(v) ? (v > 0 ? 'up' : v < 0 ? 'down' : '') : '';
          if (k === 't') return '<td class="tk">' + esc(r.t) + '</td>';
          return '<td class="' + c + (k === 'n' || k === 'sec' || k === 'ind' ? ' txt' : '') + '">' + (f ? esc(txt) : txt) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    if (rows.length > shown.length) h += '<button class="btn sm" data-act="scan-more">Show ' + Math.min(100, rows.length - shown.length) + ' more</button>';
    if (!rows.length) h += '<div class="empty"><h3>No matches</h3><p>Loosen a filter or pick another signal.</p></div>';
    h += '<p class="foot">Sources: ' + esc((SC.sources || []).join(' · ')) + '. Prices refresh hourly; daily bars update after each session.</p>';
    return head + '<main class="main" id="main">' + h + '</main>';
  }
  function scanRowSheet(t) {
    var r = null; for (var i = 0; i < SC.rows.length; i++) if (SC.rows[i].t === t) { r = SC.rows[i]; break; }
    if (!r) return '';
    var kv = function (k) { var f = COLS[k][1]; return '<div><div class="k">' + esc(COLS[k][0]) + '</div><div class="v ' + (k === 'ch' ? cls(r.ch) : '') + '" style="font-size:14px">' + esc(f ? f(r[k]) : r[k]) + '</div></div>'; };
    var covered = !!T(t);
    return '<h2 class="disp" style="margin:0;font-size:22px">' + esc(t) + ' <span class="muted" style="font-size:14px;font-weight:400">' + esc(r.n || '') + '</span></h2><p class="muted" style="margin:2px 0 10px;font-size:12px">' + esc([r.sec, r.ind, r.ex].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="scroll"><div class="kv">' + ['p', 'ch', 'mc', 'pe', 'ps', 'dy', 'pm', 'pytd', 'py', 'rsi', 'beta', 'rv', 's50', 's200', 'hi52'].map(kv).join('') + '</div>' +
      '<div class="lnkrow" style="margin-top:12px">' + extLinks(t) + '</div></div>' +
      '<div class="btnrow" style="margin-top:12px">' + (covered ? '<button class="btn" data-act="battle" data-t="' + esc(t) + '">Open in Battleground</button>' : '<span class="muted" style="font-size:12px;align-self:center">News and sentiment cover ' + D.universe.length + ' tickers; add more in config/universe.json.</span>') + '</div>';
  }
  function extLinks(t) {
    var u = encodeURIComponent(t), x = encodeURIComponent('$' + t);
    var L = [['Finviz', 'https://finviz.com/quote.ashx?t=' + u], ['StockAnalysis', 'https://stockanalysis.com/stocks/' + u.toLowerCase().replace('.', '-') + '/'], ['Yahoo Finance', 'https://finance.yahoo.com/quote/' + u.replace('.', '-')], ['Stocktwits', 'https://stocktwits.com/symbol/' + u], ['X', 'https://x.com/search?q=' + x + '&f=live']];
    return L.map(function (l) { return '<a class="chip" href="' + esc(l[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(l[0]) + ' ↗</a>'; }).join('');
  }

  // ------------------------------------------------------------------ candlestick chart
  var CD = null, CDS = { loading: false, error: null };
  var CINTERVALS = ['1m', '2m', '5m', '1h', '2h', '4h', '5h', '1D', '2D', '1W'];
  // native apps fetch live candles straight from Yahoo; web uses the hourly snapshot
  var LIVE_Q = { '1m': ['1d', '1m'], '2m': ['5d', '2m'], '5m': ['5d', '5m'], '1h': ['1mo', '60m'], '2h': ['3mo', '60m'], '4h': ['3mo', '60m'], '5h': ['3mo', '60m'], '1D': ['1y', '1d'], '2D': ['2y', '1d'], '1W': ['5y', '1wk'] };
  var liveCache = {};
  function loadCandles() {
    if (CD || CDS.loading) return;
    CDS.loading = true;
    var snap = window.__CONVERGE_CANDLES__;
    fetchJson(CFG.remote.replace('market.json', 'candles.json') + '?t=' + Math.floor(Date.now() / 60000), 15000)
      .then(function (d) { if (!d || d.kind !== 'candles') throw new Error('bad'); return d; })
      .catch(function () { if (snap && snap.kind === 'candles') return snap; return fetchJson(CFG.bundled.replace('market.json', 'candles.json')).then(function (d) { if (!d || d.kind !== 'candles') throw new Error('bad'); return d; }); })
      .then(function (d) { CD = d; CDS.loading = false; CDS.error = null; refreshCandleBox(); })
      .catch(function () { CDS.loading = false; CDS.error = 'Candles are not available yet.'; refreshCandleBox(); });
  }
  function parseYahoo(j) {
    var r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r) return null;
    var q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {}, ts = r.timestamp || [], o = { t: [], o: [], h: [], l: [], c: [], v: [] };
    ts.forEach(function (x, i) { if (q.close && q.close[i] != null && q.open && q.open[i] != null) { o.t.push(x); o.o.push(q.open[i]); o.h.push(q.high[i]); o.l.push(q.low[i]); o.c.push(q.close[i]); o.v.push((q.volume && q.volume[i]) || 0); } });
    return o.t.length ? o : null;
  }
  function fetchLive(t, iv) {
    var key = t + '|' + iv, hit = liveCache[key];
    if (hit && Date.now() - hit.at < 60000) return Promise.resolve(hit.d);
    var q = LIVE_Q[iv];
    return fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(t.replace('.', '-')) + '?range=' + q[0] + '&interval=' + q[1] + '&includePrePost=false', 9000)
      .then(function (j) { var d = parseYahoo(j); if (!d) throw new Error('empty'); liveCache[key] = { at: Date.now(), d: d }; return d; });
  }
  function etDay(sec) { return new Date((sec - 4 * 3600) * 1000).toISOString().slice(0, 10); }
  function aggregate(s, n, bySession) {
    if (!s) return null;
    var out = { t: [], o: [], h: [], l: [], c: [], v: [] }, i = 0, len = s.t.length;
    var push = function (a, b) { out.t.push(s.t[a]); out.o.push(s.o[a]); out.c.push(s.c[b]); out.h.push(Math.max.apply(null, s.h.slice(a, b + 1))); out.l.push(Math.min.apply(null, s.l.slice(a, b + 1))); out.v.push(s.v.slice(a, b + 1).reduce(function (x, y) { return x + y; }, 0)); };
    if (bySession) {
      while (i < len) { var day = etDay(s.t[i]), j = i; while (j < len && etDay(s.t[j]) === day) j++; for (var k = i; k < j; k += n) push(k, Math.min(k + n, j) - 1); i = j; }
    } else {
      var start = (len % n); if (start) push(0, start - 1);
      for (var m = start; m < len; m += n) push(m, m + n - 1);
    }
    return out;
  }
  function snapshotSeries(t, iv) {
    var c = CD && CD.tickers && CD.tickers[t]; if (!c) return null;
    switch (iv) {
      case '1m': return c.m1; case '2m': return aggregate(c.m1, 2, true); case '5m': return c.m5;
      case '1h': return c.h1; case '2h': return aggregate(c.h1, 2, true); case '4h': return aggregate(c.h1, 4, true); case '5h': return aggregate(c.h1, 5, true);
      case '1D': return c.d1; case '2D': return aggregate(c.d1, 2, false); case '1W': return c.w1;
    }
    return null;
  }
  function candleSeries(t, iv) {
    if (isNative) {
      var key = t + '|' + iv, hit = liveCache[key];
      if (!hit || Date.now() - hit.at > 60000) fetchLive(t, iv).then(function () { refreshCandleBox(); }).catch(function () { });
      if (hit) { var d = hit.d; if (iv === '2m' || iv === '1m' || iv === '5m' || iv === '1h' || iv === '1D' || iv === '1W') return { s: d, live: true }; if (iv === '2h') return { s: aggregate(d, 2, true), live: true }; if (iv === '4h') return { s: aggregate(d, 4, true), live: true }; if (iv === '5h') return { s: aggregate(d, 5, true), live: true }; if (iv === '2D') return { s: aggregate(d, 2, false), live: true }; }
    }
    return { s: snapshotSeries(t, iv), live: false };
  }
  function candleLabel(sec, iv) {
    var d = new Date(sec * 1000);
    if (/m$|h$/.test(iv)) return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtP(x) { return x >= 1000 ? x.toFixed(1) : x >= 10 ? x.toFixed(2) : x.toFixed(3); }
  function candleSvg(t) {
    var iv = UI.civ || '1D', r = candleSeries(t, iv), s = r.s;
    if (!s || s.t.length < 2) return '<div class="muted" style="padding:28px 0;text-align:center;font-size:13px">' + (CDS.loading || (!CD && !CDS.error) ? 'Loading candles…' : 'No ' + iv + ' candles for ' + esc(t) + ' yet.') + '</div>';
    var N = UI.cN || 60, len = s.t.length; N = Math.min(N, len);
    var off = clamp(UI.cOff || 0, 0, Math.max(0, len - N)); UI.cOff = off;
    var a = len - N - off, b = len - off; // [a, b)
    var hi = -Infinity, lo = Infinity, vmax = 0;
    for (var i = a; i < b; i++) { hi = Math.max(hi, s.h[i]); lo = Math.min(lo, s.l[i]); vmax = Math.max(vmax, s.v[i]); }
    var pad = (hi - lo) * 0.06 || hi * 0.01; hi += pad; lo -= pad;
    var W = 330, PH = 176, VH = 34, GAP = 8, H = PH + GAP + VH, step = W / N, bw = Math.max(1, step * 0.66);
    var y = function (p) { return (hi - p) / (hi - lo) * PH; };
    var body = '';
    for (var g = 1; g < 4; g++) body += '<line x1="0" x2="' + W + '" y1="' + (PH * g / 4).toFixed(1) + '" y2="' + (PH * g / 4).toFixed(1) + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
    for (var k = a; k < b; k++) {
      var x = (k - a) * step + step / 2, up = s.c[k] >= s.o[k], col = up ? 'var(--bull)' : 'var(--bear)';
      var yo = y(s.o[k]), yc = y(s.c[k]), top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yo - yc));
      body += '<line x1="' + x.toFixed(2) + '" x2="' + x.toFixed(2) + '" y1="' + y(s.h[k]).toFixed(2) + '" y2="' + y(s.l[k]).toFixed(2) + '" stroke="' + col + '" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
      body += '<rect x="' + (x - bw / 2).toFixed(2) + '" y="' + top.toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + hgt.toFixed(2) + '" fill="' + col + '"' + (up ? '' : '') + '></rect>';
      if (vmax) { var vh = s.v[k] / vmax * VH; body += '<rect x="' + (x - bw / 2).toFixed(2) + '" y="' + (H - vh).toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + vh.toFixed(2) + '" fill="' + col + '" fill-opacity="0.35"></rect>'; }
    }
    var last = s.c[b - 1], ly = y(last);
    body += '<line x1="0" x2="' + W + '" y1="' + ly.toFixed(2) + '" y2="' + ly.toFixed(2) + '" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
    var sel = UI.cSel != null && UI.cSel >= a && UI.cSel < b ? UI.cSel : b - 1;
    if (UI.cSel != null && UI.cSel >= a && UI.cSel < b) { var sx = (sel - a) * step + step / 2; body += '<line x1="' + sx.toFixed(2) + '" x2="' + sx.toFixed(2) + '" y1="0" y2="' + H + '" stroke="var(--fg2)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"></line>'; }
    var chg = s.c[sel] - s.o[sel];
    var readout = '<div class="ohlc mono"><span>' + esc(candleLabel(s.t[sel], iv)) + '</span><span>O ' + fmtP(s.o[sel]) + '</span><span>H ' + fmtP(s.h[sel]) + '</span><span>L ' + fmtP(s.l[sel]) + '</span><span class="' + (chg >= 0 ? 'up' : 'down') + '">C ' + fmtP(s.c[sel]) + '</span><span>Vol ' + bigNum(s.v[sel]) + '</span></div>';
    return readout + '<div class="cwrap" id="cwrap" data-a="' + a + '" data-n="' + N + '" data-len="' + len + '"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px" role="img" aria-label="' + esc(t) + ' ' + iv + ' candlestick chart">' + body + '</svg>' +
      '<span class="cax top mono">' + fmtP(hi - pad) + '</span><span class="cax bot mono">' + fmtP(lo + pad) + '</span><span class="cax last mono" style="top:' + Math.max(0, Math.min(PH - 16, ly - 8)).toFixed(0) + 'px">' + fmtP(last) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px" class="muted mono"><span>' + esc(candleLabel(s.t[a], iv)) + '</span><span>' + (r.live ? 'Live' : 'Snapshot ' + (CD ? ago(CD.generatedAt) : '')) + '</span><span>' + esc(candleLabel(s.t[b - 1], iv)) + '</span></div>';
  }
  function candleCard(t) {
    if (!CD && !CDS.loading && !CDS.error) setTimeout(loadCandles, 0);
    var iv = UI.civ || '1D';
    return '<div class="civ">' + CINTERVALS.map(function (x) { return '<button data-act="civ" data-iv="' + x + '" aria-pressed="' + (iv === x) + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div id="candlebox" data-t="' + esc(t) + '">' + candleSvg(t) + '</div>' +
      '<div class="ctools"><button class="btn sm" data-act="czoom" data-z="out" aria-label="Show more candles">−</button><button class="btn sm" data-act="czoom" data-z="in" aria-label="Show fewer candles">+</button><button class="btn sm" data-act="cpan" data-p="back" aria-label="Earlier">◀</button><button class="btn sm" data-act="cpan" data-p="fwd" aria-label="Later">▶</button><button class="btn sm" data-act="cpan" data-p="end">Latest</button></div>';
  }
  function refreshCandleBox() { var box = document.getElementById('candlebox'); if (box) { box.innerHTML = candleSvg(box.dataset.t); bindCandles(); } }
  function bindCandles() {
    var box = document.getElementById('candlebox'); if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    var x0 = null, off0 = 0, moved = false;
    function geo() { var el = document.getElementById('cwrap'); if (!el) return null; var rc = el.getBoundingClientRect(); return { a: +el.dataset.a, n: +el.dataset.n, left: rc.left, width: rc.width, top: rc.top, bottom: rc.bottom }; }
    box.addEventListener('pointerdown', function (e) { var g = geo(); if (!g || e.clientY < g.top || e.clientY > g.bottom) return; x0 = e.clientX; off0 = UI.cOff || 0; moved = false; try { box.setPointerCapture(e.pointerId); } catch (er) { } });
    box.addEventListener('pointermove', function (e) {
      if (x0 == null) return; var g = geo(); if (!g) return;
      var dx = e.clientX - x0, per = g.width / g.n;
      if (Math.abs(dx) > 6) moved = true;
      if (moved) { var no = Math.max(0, off0 + Math.round(dx / per)); if (no !== UI.cOff) { UI.cOff = no; UI.cSel = null; box.innerHTML = candleSvg(box.dataset.t); } }
    });
    box.addEventListener('pointerup', function (e) { if (x0 != null && !moved) { var g = geo(); if (g) { UI.cSel = g.a + clamp(Math.floor((e.clientX - g.left) / g.width * g.n), 0, g.n - 1); box.innerHTML = candleSvg(box.dataset.t); } } x0 = null; });
    box.addEventListener('pointercancel', function () { x0 = null; });
  }
  // ------------------------------------------------------------------ forum (Supabase backend, signed-in users only)
  var FCONF = window.CONVERGE_CONFIG || {};
  var FORUM = { posts: {}, loading: {}, error: {}, busy: false, draft: '', mode: 'signin', form: { email: '', password: '', name: '' } };
  function forumReady() { return !!(FCONF.supabaseUrl && FCONF.supabaseKey) && !window.__CONVERGE_ARTIFACT__; }
  function sb(path, opts) {
    opts = opts || {};
    var headers = { apikey: FCONF.supabaseKey, 'Content-Type': 'application/json' };
    var tok = opts.auth && S.auth && S.auth.access_token;
    headers.Authorization = 'Bearer ' + (tok || FCONF.supabaseKey);
    if (opts.prefer) headers.Prefer = opts.prefer;
    return fetch(FCONF.supabaseUrl.replace(/\/$/, '') + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (!r.ok) { var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('Request failed (' + r.status + ')'); var err = new Error(m); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  function saveSession(j) {
    if (!j || !j.access_token) return;
    S.auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user && j.user.id, email: j.user && j.user.email }, name: (j.user && j.user.user_metadata && j.user.user_metadata.display_name) || (S.auth && S.auth.name) || '' };
    save();
  }
  function ensureSession() {
    if (!S.auth) return Promise.resolve(null);
    if (Date.now() < S.auth.expires_at - 60000) return Promise.resolve(S.auth);
    return sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: S.auth.refresh_token } })
      .then(function (j) { saveSession(j); return S.auth; })
      .catch(function () { S.auth = null; save(); return null; });
  }
  function loadPosts(t, force) {
    if (!forumReady() || (FORUM.loading[t] && !force)) return;
    FORUM.loading[t] = true;
    sb('/rest/v1/forum_posts?select=id,ticker,user_id,display_name,body,created_at&ticker=eq.' + encodeURIComponent(t) + '&order=created_at.desc&limit=60')
      .then(function (rows) { FORUM.posts[t] = rows || []; FORUM.error[t] = null; })
      .catch(function (e) { FORUM.error[t] = 'Could not load the discussion: ' + e.message; })
      .then(function () { FORUM.loading[t] = false; refreshForum(t); });
  }
  function refreshForum(t) { var box = document.getElementById('forumbox'); if (box && box.dataset.t === t) box.innerHTML = forumInner(t); }
  // --- profanity filter (same rules run server-side in supabase/schema.sql) ---
  var LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };
  function normText(t) {
    var x = String(t || '').toLowerCase();
    try { x = x.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { }
    x = x.replace(/[01!|3@4$57+89]/g, function (c) { return LEET[c] || c; }).replace(/[^a-z]+/g, ' ').trim();
    // join runs of single letters ("f u c k" -> "fuck")
    x = x.replace(/\b([a-z])(?: ([a-z])\b)+/g, function (m) { return m.replace(/ /g, ''); });
    return x;
  }
  var BAD = null;
  function badList() {
    if (BAD) return BAD;
    BAD = (window.CONVERGE_BADWORDS || []).map(function (w) { var n = normText(w); return { n: n, sq: n.replace(/(.)\1+/g, '$1') }; }).filter(function (w) { return w.n.length >= 3; });
    return BAD;
  }
  function isProfane(text) {
    var n = normText(text), sq = n.replace(/(.)\1+/g, '$1'), pn = ' ' + n + ' ', ps = ' ' + sq + ' ', joined = sq.replace(/ /g, '');
    if (/(fuck|fuk|shit|bitch|nigg|whore|motherf|cocksuck|dickhead|asshole|bastard|retard)/.test(joined)) return true;
    return badList().some(function (w) { return pn.indexOf(' ' + w.n + ' ') >= 0 || ps.indexOf(' ' + w.sq + ' ') >= 0 || (w.sq.length >= 5 && w.sq.indexOf(' ') < 0 && joined.indexOf(w.sq) >= 0); });
  }
  function forumCard(t) {
    if (!forumReady()) {
      var msg = window.__CONVERGE_ARTIFACT__ ? 'The discussion is available in the Converge app and on the Converge website, where you can sign in.' : 'The discussion board isn’t connected yet. The owner needs to add the Supabase settings described in the README.';
      return '<section class="card"><h2 class="eyebrow" style="margin-bottom:6px">Discussion · ' + esc(t) + '</h2><p class="muted" style="margin:0;font-size:13px;line-height:1.5">' + msg + '</p></section>';
    }
    if (FORUM.posts[t] === undefined && !FORUM.loading[t]) setTimeout(function () { loadPosts(t); }, 0);
    return '<section class="card" id="forumbox" data-t="' + esc(t) + '">' + forumInner(t) + '</section>';
  }
  function forumInner(t) {
    var h = '<div class="sechead"><h2 class="eyebrow">Discussion · ' + esc(t) + '</h2><button class="lnk" data-act="forum-refresh" data-t="' + esc(t) + '" style="color:var(--muted)">Refresh</button></div>';
    if (S.auth) {
      h += '<div class="field"><label for="forum-text">Post as <b>' + esc(S.auth.name || 'you') + '</b></label><textarea class="in" id="forum-text" rows="3" maxlength="1000" placeholder="Share your take on ' + esc(t) + '. Keep it civil.">' + esc(FORUM.draft) + '</textarea></div>' +
        '<div class="btnrow" style="margin-top:8px"><button class="btn sm" data-act="forum-signout">Sign out</button><button class="btn sm pri" data-act="forum-post" data-t="' + esc(t) + '"' + (FORUM.busy ? ' disabled' : '') + '>' + (FORUM.busy ? 'Posting…' : 'Post') + '</button></div>';
    } else {
      h += '<button class="btn sm pri" data-act="forum-auth" style="width:100%">Sign in to comment</button>';
    }
    if (FORUM.error[t]) h += '<p class="note" style="margin:10px 0 0">' + esc(FORUM.error[t]) + '</p>';
    var posts = FORUM.posts[t];
    if (!posts) h += '<p class="muted" style="margin:12px 0 0;font-size:13px">Loading…</p>';
    else if (!posts.length) h += '<p class="muted" style="margin:12px 0 0;font-size:13px">No comments yet. Start the conversation.</p>';
    else h += '<div class="posts">' + posts.map(function (p) {
      var mine = S.auth && S.auth.user && p.user_id === S.auth.user.id;
      return '<article class="post"><div class="post-h"><b>' + esc(p.display_name) + '</b><span class="muted">' + esc(ago(p.created_at)) + '</span>' + (mine ? '<button class="lnk" data-act="forum-del" data-id="' + esc(p.id) + '" data-t="' + esc(t) + '" style="color:var(--muted);padding:0;margin-left:auto">Delete</button>' : '') + '</div><p>' + esc(p.body) + '</p></article>';
    }).join('') + '</div>';
    h += '<p class="foot" style="text-align:left;margin:10px 0 0">Posts with offensive language are blocked. Not investment advice.</p>';
    return h;
  }
  function authSheet() {
    var m = FORUM.mode, f = FORUM.form;
    return '<h2 class="disp" style="margin:0 0 4px;font-size:22px">' + (m === 'signup' ? 'Create your account' : 'Sign in') + '</h2><p class="muted" style="margin:0 0 12px;font-size:13px">Your account is used only for the stock discussions.</p>' +
      '<div class="scroll" style="padding-top:0">' + (m === 'signup' ? '<div class="field"><label for="au-name">Display name</label><input class="in" id="au-name" data-au="name" maxlength="30" autocomplete="nickname" value="' + esc(f.name) + '"></div>' : '') +
      '<div class="field"><label for="au-email">Email</label><input class="in" id="au-email" data-au="email" type="email" autocomplete="email" value="' + esc(f.email) + '"></div>' +
      '<div class="field"><label for="au-pass">Password</label><input class="in" id="au-pass" data-au="password" type="password" autocomplete="' + (m === 'signup' ? 'new-password' : 'current-password') + '" value="' + esc(f.password) + '"></div>' +
      (FORUM.authMsg ? '<p class="note" style="margin:4px 0 0">' + esc(FORUM.authMsg) + '</p>' : '') + '</div>' +
      '<button class="btn pri" data-act="forum-auth-go" style="margin-top:12px"' + (FORUM.busy ? ' disabled' : '') + '>' + (FORUM.busy ? 'Please wait…' : m === 'signup' ? 'Create account' : 'Sign in') + '</button>' +
      '<button class="btn sm" data-act="forum-auth-mode" style="margin-top:8px;border:0;color:var(--accent)">' + (m === 'signup' ? 'I already have an account' : 'New here? Create an account') + '</button>';
  }
  var FA = {
    'forum-refresh': function (el) { loadPosts(el.dataset.t, true); },
    'forum-auth': function () { FORUM.authMsg = ''; UI.sheet = { kind: 'auth' }; render(); },
    'forum-auth-mode': function () { FORUM.mode = FORUM.mode === 'signup' ? 'signin' : 'signup'; FORUM.authMsg = ''; render(); },
    'forum-auth-go': function () {
      var f = FORUM.form, email = f.email.trim(), pw = f.password, name = f.name.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { FORUM.authMsg = 'Enter a valid email address.'; return render(); }
      if (pw.length < 8) { FORUM.authMsg = 'Use a password of at least 8 characters.'; return render(); }
      if (FORUM.mode === 'signup') {
        if (name.length < 2) { FORUM.authMsg = 'Pick a display name of at least 2 characters.'; return render(); }
        if (isProfane(name)) { FORUM.authMsg = 'Please choose a different display name.'; return render(); }
      }
      FORUM.busy = true; FORUM.authMsg = ''; render();
      var p = FORUM.mode === 'signup'
        ? sb('/auth/v1/signup', { method: 'POST', body: { email: email, password: pw, data: { display_name: name } } }).then(function (j) {
          if (j && j.access_token) { saveSession(j); S.auth.name = name; save(); return 'in'; }
          return 'confirm';
        })
        : sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pw } }).then(function (j) { saveSession(j); return 'in'; });
      p.then(function (res) {
        FORUM.busy = false; f.password = '';
        if (res === 'confirm') { FORUM.mode = 'signin'; FORUM.authMsg = 'Check your email to confirm your account, then sign in.'; render(); return; }
        UI.sheet = null; toast('Signed in as ' + (S.auth.name || email)); render();
      }).catch(function (e) { FORUM.busy = false; FORUM.authMsg = /invalid login/i.test(e.message) ? 'Wrong email or password.' : e.message; render(); });
    },
    'forum-signout': function () { var tok = S.auth; S.auth = null; save(); if (tok) sb('/auth/v1/logout', { method: 'POST', auth: false }).catch(function () { }); toast('Signed out'); render(); },
    'forum-post': function (el) {
      var t = el.dataset.t, body = (FORUM.draft || '').trim();
      if (!body) return toast('Write something first');
      if (isProfane(body)) { FORUM.error[t] = 'Your post contains language that isn’t allowed here. Please rephrase it.'; return refreshForum(t); }
      FORUM.busy = true; FORUM.error[t] = null; refreshForum(t);
      ensureSession().then(function (sess) {
        if (!sess) { FORUM.busy = false; FORUM.error[t] = 'Your session expired. Please sign in again.'; render(); return; }
        return sb('/rest/v1/forum_posts', { method: 'POST', auth: true, prefer: 'return=representation', body: { ticker: t, body: body, display_name: sess.name || 'Investor' } })
          .then(function (rows) { FORUM.draft = ''; FORUM.busy = false; FORUM.posts[t] = (rows || []).concat(FORUM.posts[t] || []); refreshForum(t); toast('Posted'); });
      }).catch(function (e) { FORUM.busy = false; FORUM.error[t] = /civil|blocked|language/i.test(e.message) ? 'Your post contains language that isn’t allowed here. Please rephrase it.' : e.message; refreshForum(t); });
    },
    'forum-del': function (el) {
      var t = el.dataset.t, id = el.dataset.id;
      ensureSession().then(function (sess) {
        if (!sess) return;
        return sb('/rest/v1/forum_posts?id=eq.' + encodeURIComponent(id), { method: 'DELETE', auth: true }).then(function () { FORUM.posts[t] = (FORUM.posts[t] || []).filter(function (p) { return String(p.id) !== String(id); }); refreshForum(t); toast('Post deleted'); });
      }).catch(function (e) { toast(e.message); });
    }
  };
  // ------------------------------------------------------------------ scanner strategy presets (from the user's playbook)
  function sectorMedianPE() {
    if (SC._medPE) return SC._medPE;
    var by = {}; SC.rows.forEach(function (r) { if (nz(r.pe) && r.pe > 0) (by[r.sec] = by[r.sec] || []).push(r.pe); });
    var out = {}; Object.keys(by).forEach(function (k) { var a = by[k].sort(function (x, y) { return x - y; }); out[k] = a[Math.floor(a.length / 2)]; });
    SC._medPE = out; return out;
  }
  // criterion: [label, predicate | null (not in free data), needsFundamentals]
  var PRESETS = [
    { id: 'scalp', name: 'Ultra-short scalping', horizon: '1–15 minute hold', crit: [
      ['Relative volume > 3', function (r) { return r.rv > 3; }],
      ['Today’s change > +3% or < −3%', function (r) { return nz(r.ch) && Math.abs(r.ch) > 3; }],
      ['Price $2 to $30', function (r) { return r.p >= 2 && r.p <= 30; }],
      ['Float < 20 million shares', null],
      ['Price above VWAP (long) / below (short)', null]],
      rules: 'Entry: buy when a 1-minute candle closes above the 9 EMA after a relative-volume spike. Exit: profit target at 1.5× ATR(14) or stop at the signal candle’s low.',
      note: 'Your playbook: ~58–65% win rate, ~1.1:1 payoff, very sensitive to slippage. Low-float stocks are rare in the S&P 500, so this scan often returns nothing here.' },
    { id: 'swing', name: 'Short-term swing', horizon: '2 days–2 weeks', crit: [
      ['Market cap > $1B', function (r) { return r.mc > 1e9; }],
      ['Average volume (30 days) > 1M', function (r) { return r.av30 > 1e6; }],
      ['RSI(14) between 45 and 60', function (r) { return r.rsi >= 45 && r.rsi <= 60; }],
      ['Price > SMA20 > SMA50', function (r) { return r.s20 > 0 && r.s20v50 === 1; }],
      ['3-day high breakout or touching SMA20', function (r) { return r.brk3 === 1 || (nz(r.s20) && Math.abs(r.s20) <= 1.5); }]],
      rules: 'Entry: buy at the next open after a close above the 10-day high. Exit: trailing stop at 2× ATR(14), or a close below SMA20.',
      note: 'Your playbook: ~45–52% win rate, profit factor ~1.8.' },
    { id: 'mswing', name: 'Medium-term swing', horizon: '1–5 weeks', crit: [
      ['Market cap > $5B', function (r) { return r.mc > 5e9; }],
      ['Up > 10% over 3 months and beating the S&P 500', function (r) { return r.pq > 10 && r.rs3m > 0; }],
      ['Price > SMA50 and SMA50 > SMA200', function (r) { return r.s50 > 0 && r.s50v200 === 1; }],
      ['ATR(14) under 3% of price (contraction)', function (r) { return nz(r.atrp) && r.atrp < 3; }],
      ['Up-day volume > down-day volume (20 days)', function (r) { return r.udv > 1; }]],
      rules: 'Entry: 20-day-high breakout on more than 1.5× the 20-day average volume. Exit: close below SMA50, or after 25 trading days.',
      note: 'Your playbook: ~50% win rate, 12–15% max drawdown in choppy markets; best in bull regimes.' },
    { id: 'position', name: 'Position / trend', horizon: '6 months–2 years', crit: [
      ['Quarterly EPS growth (YoY) > 20%', function (r) { return r.qepsg > 20; }, true],
      ['Quarterly sales growth (YoY) > 15%', function (r) { return r.qsg > 15; }, true],
      ['Return on equity > 15%', function (r) { return r.roe > 15; }, true],
      ['Price > SMA200 and SMA200 rising over 50 days', function (r) { return r.s200 > 0 && r.s200up === 1; }],
      ['Within 15% of the 52-week high', function (r) { return nz(r.hi52) && r.hi52 >= -15; }]],
      rules: 'Entry: 20-week EMA crosses above the 50-week EMA while price is within 10% of its 52-week high. Exit: close below SMA200, or a 20% drop from the peak.',
      note: 'Your playbook: ~38–45% win rate, reward-to-risk of 3:1 to 5:1.' },
    { id: 'value', name: 'Multi-year value', horizon: '2–5 years', crit: [
      ['Market cap > $10B', function (r) { return r.mc > 1e10; }],
      ['P/E below its sector’s median today (5-year sector history isn’t in free data)', function (r) { var m = sectorMedianPE()[r.sec]; return nz(r.pe) && r.pe > 0 && m && r.pe < m; }, true],
      ['Free cash flow yield > 5%', function (r) { return r.fcfy > 5; }, true],
      ['Long-term debt/equity < 1.0', function (r) { return nz(r.de) && r.de < 1; }, true],
      ['Dividend + buyback yield > 3%', function (r) { return r.shy > 3; }, true]],
      rules: 'Rebalance once a year into the top 10 matches. Sell only after two straight quarters of negative earnings, or if debt/equity goes above 1.5.',
      note: 'Your playbook: ~70%+ win rate over multi-year periods, low beta.' }
  ];
  function presetPreds() {
    var st = scanState(), on = st.presets || {}, preds = [];
    PRESETS.forEach(function (p) { if (!on[p.id]) return; p.crit.forEach(function (c) { if (c[1] && !(c[2] && !SC.fundamentals)) preds.push(c[1]); }); });
    return preds;
  }
  function presetsCard() {
    var st = scanState(), on = st.presets || {}, open = UI.presetOpen;
    return '<section class="card" style="padding:12px"><h2 class="eyebrow" style="margin:2px 2px 8px">Strategy scanners</h2>' + PRESETS.map(function (p) {
      var active = !!on[p.id];
      var rows = active || open === p.id ? '<div class="pdet">' + p.crit.map(function (c) {
        var avail = !!c[1], fundOff = c[2] && !SC.fundamentals;
        return '<div class="pcrit"><span class="' + (!avail || fundOff ? 'dim' : 'up') + '">' + (!avail || fundOff ? '○' : '●') + '</span><span>' + esc(c[0]) + (!avail ? ' <em class="dim">· not in free data, skipped</em>' : fundOff ? ' <em class="dim">· needs SEC data, skipped</em>' : '') + '</span></div>';
      }).join('') + '<p class="prule"><b>Rules:</b> ' + esc(p.rules) + '</p><p class="prule muted">' + esc(p.note) + '</p></div>' : '';
      return '<div class="preset' + (active ? ' on' : '') + '"><button class="rowtoggle" data-act="preset" data-id="' + p.id + '" aria-pressed="' + active + '" style="border:0;background:none;padding:6px 2px;min-height:48px"><span><span class="t1">' + esc(p.name) + '</span><span class="t2">' + esc(p.horizon) + '</span></span><span class="sw"></span></button>' +
        '<button class="lnk pmore" data-act="preset-info" data-id="' + p.id + '">' + (active || open === p.id ? 'Criteria' : 'Criteria ▾') + '</button>' + rows + '</div>';
    }).join('') + '</section>';
  }

  // ---- sheets (picker, pin)
  function sheetHtml() {
    var sh = UI.sheet; if (!sh) return '';
    var body = '';
    if (sh.kind === 'pick') {
      var q = UI.pickQuery.trim().toUpperCase();
      var list = D.universe.filter(function (u) { return !q || u.t.indexOf(q) >= 0 || (u.name || '').toUpperCase().indexOf(q) >= 0; });
      var multi = sh.mode === 'watch';
      body = '<h2 class="disp" style="margin:0 0 10px;font-size:20px">' + (multi ? 'Watchlist' : 'Choose a ticker') + '</h2><label class="sr" for="pickq">Search tickers</label><input class="in" id="pickq" data-pickq="1" placeholder="Search ' + D.universe.length + ' covered tickers" value="' + esc(UI.pickQuery) + '" autocomplete="off">' +
        '<div class="scroll">' + list.map(function (u) {
          var on = multi ? S.watchlist.indexOf(u.t) >= 0 : false, y = T(u.t);
          return '<button class="pickrow" data-act="picked" data-t="' + u.t + '" aria-pressed="' + on + '"><span class="tk">' + u.t + '</span><span class="nm">' + esc(u.name || '') + '</span><span class="mono ' + cls(y && y.changePct) + '" style="font-size:12px">' + (y ? arrowPct(y.changePct) : '') + '</span>' + (multi ? '<span style="width:20px;color:var(--accent)">' + (on ? ic('check', 18) : '') + '</span>' : '') + '</button>';
        }).join('') + (list.length ? '' : '<p class="muted" style="font-size:13px">No covered ticker matches. Add more in config/universe.json.</p>') + '</div>' +
        (multi ? '<button class="btn pri" data-act="sheet-close" style="margin-top:12px">Done</button>' : '');
    } else if (sh.kind === 'pin') {
      var d = UI.draft, t = d && d.t;
      if (sh.type === 'article') {
        var arts = (D.news || []).filter(function (n) { return n.t === t; }).slice(0, 15);
        body = '<h2 class="disp" style="margin:0 0 4px;font-size:20px">Pin an article</h2><p class="muted" style="margin:0 0 8px;font-size:12px">Recent coverage of ' + esc(t) + ', or paste any link.</p><div class="field"><label for="pin-url">Link</label><input class="in" id="pin-url" placeholder="https://…" inputmode="url"></div><div class="field"><label for="pin-ttl">Title</label><input class="in" id="pin-ttl" placeholder="What the article argues"></div><button class="btn sm pri" data-act="pin-save" style="margin-top:8px">Pin link</button>' +
          '<div class="scroll">' + arts.map(function (n, i) { return '<button class="pickrow" data-act="pin-art" data-i="' + i + '"><span class="tag ' + (n.sent > 0 ? 'tag-bull' : n.sent < 0 ? 'tag-bear' : 'tag-news') + '">' + (n.kind === 'analysis' ? 'ANALYSIS' : 'NEWS') + '</span><span class="nm" style="white-space:normal">' + esc(n.title) + '<br><span class="muted" style="font-size:11px">' + esc(n.source) + ' · ' + ago(n.date) + '</span></span></button>'; }).join('') + '</div>';
      } else {
        body = '<h2 class="disp" style="margin:0 0 10px;font-size:20px">' + (sh.type === 'excerpt' ? 'Pin an excerpt' : 'Add a note') + '</h2><div class="field"><label for="pin-txt">' + (sh.type === 'excerpt' ? 'Quote from an earnings call, filing or report' : 'Your note') + '</label><textarea class="in" id="pin-txt" rows="4"></textarea></div>' +
          (sh.type === 'excerpt' ? '<div class="field" style="margin-top:8px"><label for="pin-src">Source <span class="opt">(e.g. Q3 call, CFO)</span></label><input class="in" id="pin-src"></div>' : '') + '<button class="btn pri" data-act="pin-save" style="margin-top:12px">Pin</button>';
      }
    }
    if (sh.kind === 'scanrow') body = SC ? scanRowSheet(sh.t) : '';
    if (sh.kind === 'auth') body = authSheet();
    return '<div class="sheet" data-act="sheet-bg"><div class="panel" role="dialog" aria-modal="true" data-stop="1"><div class="grab"></div>' + body + '</div></div>';
  }

  // ------------------------------------------------------------------ render
  var lastScreenKey = '';
  function current() { return NAV.stack.length ? NAV.stack[NAV.stack.length - 1] : { name: NAV.tab }; }
  function render() {
    var root = document.getElementById('app');
    var scrollEl = document.getElementById('main'), keepScroll = scrollEl ? scrollEl.scrollTop : 0;
    var focusId = document.activeElement && document.activeElement.id, selStart = null;
    try { selStart = document.activeElement && document.activeElement.selectionStart; } catch (e) { selStart = null; }
    var html;
    if (!D) {
      html = '<div class="loading">' + (DS.error ? '<p style="margin:0">' + esc(DS.error) + '</p><button class="btn sm pri" data-act="refresh">Retry</button>' : '<span class="pulse" style="color:var(--accent)">' + ic('logo', 40) + '</span>Loading market data…') + '</div>';
    } else {
      var c = current(), body;
      switch (c.name) {
        case 'command': body = scrCommand(); break;
        case 'feed': body = scrFeed(); break;
        case 'battle': body = scrBattle(); break;
        case 'vault': body = scrVault(); break;
        case 'scan': body = scrScan(); break;
        case 'add': body = scrAdd(); break;
        case 'lot': body = scrLot(c.id); break;
        case 'wthesis': body = scrWThesis(c.t); break;
        case 'alert': body = scrAlert(c.t); break;
        case 'briefing': body = scrBriefing(); break;
        case 'source': body = scrSource(c.name2); break;
        case 'settings': body = scrSettings(); break;
        default: body = scrCommand();
      }
      var showNav = !NAV.stack.length || ['lot', 'alert', 'source', 'wthesis'].indexOf(c.name) >= 0;
      html = body + (showNav ? navBar() : '') + sheetHtml() + (UI.toast ? '<div class="toast" role="status">' + esc(UI.toast) + '</div>' : '');
    }
    root.innerHTML = '<div class="app">' + html + '</div>';
    var key = JSON.stringify(current());
    var main = document.getElementById('main');
    if (main) main.scrollTop = key === lastScreenKey ? keepScroll : 0;
    lastScreenKey = key;
    if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); try { if (selStart != null) f.setSelectionRange(selStart, selStart); } catch (e) { } } }
    bindSwipe();
    bindCandles();
  }
  function go(scr) { NAV.stack.push(scr); render(); }
  function back() {
    if (UI.sheet) { UI.sheet = null; render(); return true; }
    if (UI.reflect) { UI.reflect = null; render(); return true; }
    if (NAV.stack.length) { var top = NAV.stack.pop(); if (top.name === 'briefing') stopSpeech(); render(); return true; }
    if (NAV.tab !== 'command') { NAV.tab = 'command'; render(); return true; }
    return false;
  }
  var toastTimer;
  function toast(msg) { UI.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(function () { UI.toast = null; render(); }, 2600); }

  // ------------------------------------------------------------------ actions
  function snapFor(t) { var x = T(t); return x ? { price: x.price, quant: x.quant.score, bull: x.sentiment.bull, date: today() } : {}; }
  function readNum(s) { var n = parseFloat(String(s).replace(/[$,\s]/g, '')); return isFinite(n) ? n : null; }
  var A = {
    tab: function (el) { NAV.tab = el.dataset.tab; NAV.stack = []; UI.reflect = null; render(); },
    back: function () { back(); },
    signal: function () { S.signal = !S.signal; save(); render(); },
    toponly: function () { S.topOnly = !S.topOnly; save(); render(); },
    sel: function (el) { S.sel = el.dataset.t; save(); render(); },
    range: function (el) { S.range = el.dataset.r; save(); render(); },
    brange: function (el) { UI.battleRange = el.dataset.r; render(); },
    side: function (el) { UI.side = el.dataset.side; render(); },
    feedf: function (el) { S.feedFilter = el.dataset.f; save(); render(); },
    vtab: function (el) { UI.vaultTab = el.dataset.v; render(); },
    settings: function () { go({ name: 'settings' }); },
    battle: function (el) { S.sel = el.dataset.t; if (el.dataset.side) UI.side = el.dataset.side; save(); NAV.tab = 'battle'; NAV.stack = []; render(); },
    alert: function (el) { go({ name: 'alert', t: el.dataset.t }); },
    source: function (el) { go({ name: 'source', name2: el.dataset.name }); },
    briefing: function () { UI.briefIdx = 0; go({ name: 'briefing' }); },
    lot: function (el) { UI.reflect = null; UI.confirmDel = null; go({ name: 'lot', id: el.dataset.id }); },
    wthesis: function (el) { go({ name: 'wthesis', t: el.dataset.t }); },
    watch: function (el) { var t = el.dataset.t, i = S.watchlist.indexOf(t); if (i >= 0) { S.watchlist.splice(i, 1); save(); toast('Removed ' + t + ' from watchlist'); } else { S.watchlist.push(t); save(); toast('Watching ' + t); } },
    'wthesis-new': function (el) { UI.draft = newDraft(el.dataset.t, 'watch'); go({ name: 'add' }); },
    add: function (el) { UI.draft = newDraft(el.dataset.t || null, 'lot'); if (UI.draft.t) UI.draft.step = 1; go({ name: 'add' }); },
    'thesis-lot': function (el) {
      var l = el.dataset.id ? S.lots.filter(function (z) { return z.id === el.dataset.id; })[0] : openLots().filter(function (z) { return z.t === el.dataset.t; })[0];
      if (!l) return;
      var th = l.thesis || {}; UI.draft = newDraft(l.t, 'lot'); UI.draft.step = 2; UI.draft.lotId = l.id; UI.draft.shares = String(l.shares); UI.draft.price = String(l.price);
      if (l.thesis) { UI.draft.title = th.title; UI.draft.why = th.why || ''; UI.draft.pins = (th.pins || []).slice(); UI.draft.target = th.target ? String(th.target) : ''; UI.draft.horizon = th.horizon || '12M'; UI.draft.kill = th.kill || ''; }
      go({ name: 'add' });
    },
    pick: function (el) { UI.sheet = { kind: 'pick', mode: el.dataset.mode }; UI.pickQuery = ''; render(); },
    picked: function (el) {
      var t = el.dataset.t, mode = UI.sheet.mode;
      if (mode === 'watch') {
        var i = S.watchlist.indexOf(t);
        if (i >= 0) { S.watchlist.splice(i, 1); save(); render(); }
        else { S.watchlist.push(t); save(); render(); }
        return;
      }
      if (mode === 'draft') { UI.draft.t = t; UI.draft.price = String(T(t).price); }
      if (mode === 'battle') { S.sel = t; save(); }
      UI.sheet = null; render();
    },
    'sheet-close': function () { UI.sheet = null; render(); },
    'sheet-bg': function (el, e) { if (e.target === el) { UI.sheet = null; render(); } },
    horizon: function (el) { UI.draft.horizon = el.dataset.h; render(); },
    'draft-next': function () {
      var d = UI.draft, sh = readNum(d.shares), pr = readNum(d.price);
      if (!d.t) return toast('Choose a ticker first');
      if (!sh || sh <= 0) return toast('Enter how many shares you bought');
      if (!pr || pr <= 0) return toast('Enter the price you paid');
      finishDraft(false);
    },
    pinsheet: function (el) { UI.sheet = { kind: 'pin', type: el.dataset.type }; render(); },
    'pin-art': function (el) { var n = (D.news || []).filter(function (z) { return z.t === UI.draft.t; })[+el.dataset.i]; if (!n) return; UI.draft.pins.push({ type: 'article', text: n.title, url: n.url, meta: n.source + ' · ' + fmtDate(n.date) }); UI.sheet = null; render(); },
    'pin-save': function () {
      var type = UI.sheet.type;
      if (type === 'article') {
        var u = (document.getElementById('pin-url').value || '').trim(), ttl = (document.getElementById('pin-ttl').value || '').trim();
        if (!safeUrl(u)) return toast('Paste a full link starting with https://');
        UI.draft.pins.push({ type: 'article', text: ttl || u, url: u });
      } else {
        var tx = (document.getElementById('pin-txt').value || '').trim(); if (!tx) return toast('Type something to pin');
        var src = document.getElementById('pin-src'); UI.draft.pins.push({ type: type, text: tx, meta: src && src.value.trim() || '' });
      }
      UI.sheet = null; render();
    },
    unpin: function (el) { UI.draft.pins.splice(+el.dataset.i, 1); render(); },
    'draft-later': function () { finishDraft(false); },
    'draft-save': function () { if (!UI.draft.title.trim()) return toast('Write your thesis in one line first'); finishDraft(true); },
    sell: function (el) { var l = S.lots.filter(function (z) { return z.id === el.dataset.id; })[0]; var x = T(l.t); UI.reflect = { id: l.id, reason: null, price: x ? String(x.price) : String(l.price), date: today(), note: '' }; render(); },
    reason: function (el) { UI.reflect.reason = el.dataset.r; render(); },
    keep: function () { UI.reflect = null; toast('Kept. Good to check the thesis first.'); },
    'sell-confirm': function () {
      var R = UI.reflect, l = S.lots.filter(function (z) { return z.id === R.id; })[0], p = readNum(R.price);
      if (!R.reason) return; if (!p) return toast('Enter the sell price');
      l.status = 'closed'; l.sell = { price: p, date: R.date || today(), reason: R.reason, note: R.note }; UI.reflect = null; save(); toast('Lot closed and reason logged'); render();
    },
    tstatus: function (el) { var l = S.lots.filter(function (z) { return z.id === current().id; })[0]; l.thesis.status = el.dataset.s; save(); render(); },
    kill: function (el) { var l = S.lots.filter(function (z) { return z.id === el.dataset.id; })[0]; l.thesis.killed = !l.thesis.killed; if (l.thesis.killed) l.thesis.status = 'broken'; save(); render(); },
    'del-lot': function (el) {
      if (UI.confirmDel !== el.dataset.id) { UI.confirmDel = el.dataset.id; render(); return; }
      S.lots = S.lots.filter(function (z) { return z.id !== el.dataset.id; }); UI.confirmDel = null; save(); NAV.stack.pop(); toast('Lot deleted');
    },
    'del-wthesis': function (el) { delete S.watchTheses[el.dataset.t]; save(); NAV.stack.pop(); toast('Thesis deleted'); },
    mute: function (el) { var n = el.dataset.name, i = S.muted.indexOf(n); if (i >= 0) S.muted.splice(i, 1); else S.muted.push(n); save(); toast(i >= 0 ? 'Unmuted ' + n : 'Muted ' + n); },
    refresh: function () { loadData(true).then(function () { if (D) toast('Data refreshed'); }); },
    reset: function () { if (!UI.confirmReset) { UI.confirmReset = true; render(); return; } try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); },
    notify: function () {
      var LN = plugin('LocalNotifications'); if (!LN) return;
      if (S.notify) { S.notify = false; save(); render(); return; }
      LN.requestPermissions().then(function (r) { S.notify = r && r.display === 'granted'; save(); render(); if (!S.notify) toast('Notifications are off in system settings'); });
    },
    civ: function (el) { UI.civ = el.dataset.iv; UI.cOff = 0; UI.cSel = null; render(); },
    cmode: function (el) { UI.cmode = el.dataset.m; render(); },
    czoom: function (el) { var Ns = [30, 60, 120, 240], i = Ns.indexOf(UI.cN || 60); i = el.dataset.z === 'in' ? Math.max(0, i - 1) : Math.min(Ns.length - 1, i + 1); UI.cN = Ns[i]; UI.cSel = null; refreshCandleBox(); },
    cpan: function (el) { var n = UI.cN || 60; UI.cSel = null; if (el.dataset.p === 'end') UI.cOff = 0; else UI.cOff = Math.max(0, (UI.cOff || 0) + (el.dataset.p === 'back' ? Math.round(n / 2) : -Math.round(n / 2))); refreshCandleBox(); },
    preset: function (el) { var st = scanState(); st.presets = st.presets || {}; st.presets[el.dataset.id] = !st.presets[el.dataset.id]; if (st.presets[el.dataset.id]) st.view = 'strategy'; UI.scanLimit = 100; save(); render(); },
    'preset-info': function (el) { UI.presetOpen = UI.presetOpen === el.dataset.id ? null : el.dataset.id; render(); },
    'scan-refresh': function () { SC = null; SCS.error = null; loadScanner(true); },
    'scan-toggle': function () { var st = scanState(); st.open = !st.open; save(); render(); },
    'scan-group': function (el) { scanState().group = el.dataset.g; save(); render(); },
    'scan-view': function (el) { scanState().view = el.dataset.v; save(); render(); },
    'scan-sort': function (el) { var st = scanState(), k = el.dataset.k; if (st.sort.k === k) st.sort.dir *= -1; else st.sort = { k: k, dir: ['t', 'n', 'sec', 'ind', 'ctry'].indexOf(k) >= 0 ? 1 : -1 }; save(); render(); },
    'scan-row': function (el) { UI.sheet = { kind: 'scanrow', t: el.dataset.t }; render(); },
    'scan-more': function () { UI.scanLimit = (UI.scanLimit || 100) + 100; render(); },
    'scan-reset': function () { var st = scanState(); st.f = {}; st.signal = 'none'; save(); render(); },
    'scan-save': function () {
      var st = scanState(), parts = Object.keys(st.f).map(function (id) { return st.f[id]; });
      if (st.signal !== 'none') parts.unshift(sigDef(st.signal)[1]);
      if (!parts.length) return toast('Pick at least one filter or signal first');
      var name = parts.join(' + '); if (name.length > 40) name = name.slice(0, 38) + '…';
      st.saved = (st.saved || []).filter(function (x) { return x.name !== name; }); st.saved.unshift({ name: name, f: JSON.parse(JSON.stringify(st.f)), signal: st.signal }); st.saved = st.saved.slice(0, 12); save(); toast('Screen saved');
    },
    'scan-load': function (el) { var st = scanState(), sv = st.saved[+el.dataset.i]; if (!sv) return; st.f = JSON.parse(JSON.stringify(sv.f)); st.signal = sv.signal; save(); render(); },
    'brief-add': function () { swipeDecide(true); },
    'brief-skip': function () { swipeDecide(false); },
    'brief-reset': function () { S.brief = { day: today(), picked: [], skipped: [] }; save(); render(); },
    'brief-play': function () { if (UI.speaking) stopSpeech(); else playBriefing(); }
  };
  Object.keys(FA).forEach(function (k) { A[k] = FA[k]; });
  function finishDraft(withThesis) {
    var d = UI.draft, thesis = null;
    if (withThesis) {
      var prev = d.lotId ? (S.lots.filter(function (z) { return z.id === d.lotId; })[0] || {}).thesis : null;
      thesis = { title: d.title.trim(), why: d.why.trim(), pins: d.pins, target: readNum(d.target), horizon: d.horizon, kill: d.kill.trim(), createdAt: prev ? prev.createdAt : new Date().toISOString(), snap: prev ? prev.snap : snapFor(d.t), status: prev ? prev.status : null, killed: prev ? prev.killed : false };
    }
    if (d.mode === 'watch') {
      if (thesis) S.watchTheses[d.t] = thesis;
      save(); NAV.stack.pop(); toast(thesis ? 'Thesis saved for ' + d.t : d.t + ' added to watchlist');
      return;
    }
    if (d.lotId) {
      var l = S.lots.filter(function (z) { return z.id === d.lotId; })[0]; if (thesis) l.thesis = thesis;
    } else {
      S.lots.push({ id: uid(), t: d.t, shares: readNum(d.shares), price: readNum(d.price), date: d.date || today(), thesis: thesis, status: 'open' });
      if (S.watchlist.indexOf(d.t) < 0) S.watchlist.push(d.t);
      S.sel = d.t;
    }
    save(); NAV.stack.pop(); UI.draft = null; toast(thesis ? 'Thesis saved' : 'Lot saved');
  }

  // ------------------------------------------------------------------ briefing: swipe + speech
  function swipeDecide(keep) {
    var B = briefState(), c = B.pending[0]; if (!c) return;
    (keep ? S.brief.picked : S.brief.skipped).push(c.id); save();
    var el = document.getElementById('swipe');
    if (el) { el.style.transform = 'translateX(' + (keep ? 420 : -420) + 'px) rotate(' + (keep ? 12 : -12) + 'deg)'; setTimeout(render, 180); } else render();
  }
  function bindSwipe() {
    var el = document.getElementById('swipe'); if (!el) return;
    var x0 = null, dx = 0;
    el.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; el.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch (er) { } });
    el.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 25) + 'deg)'; });
    function end() { if (x0 == null) return; x0 = null; el.classList.remove('drag'); if (Math.abs(dx) > 90) swipeDecide(dx > 0); else el.style.transform = ''; }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  function ttsAvailable() { return !!plugin('TextToSpeech') || ('speechSynthesis' in window); }
  function naturalVoice() { return !!(D && D.briefingAudio && D.briefingAudio.base && (!window.__CONVERGE_ARTIFACT__ || window.__CONVERGE_AUDIO__)); }
  var SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAACAAAA/oAR0dHR0dHR0dHR0dHYmJiYmJiYmJiYmJifHx8fHx8fHx8fHx8fJaWlpaWlpaWlpaWlrGxsbGxsbGxsbGxsbHLy8vLy8vLy8vLy8vl5eXl5eXl5eXl5eXl////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQC1AAAAAAAAAP6yysejgAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsSjAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
  function bestVoice() {
    if (!('speechSynthesis' in window)) return null;
    var vs = window.speechSynthesis.getVoices().filter(function (v) { return /^en[-_]?(US|GB|AU|CA|IE)?/i.test(v.lang); });
    var pref = [/natural/i, /premium/i, /enhanced/i, /neural/i, /siri/i, /google us english/i, /\bava\b/i, /samantha/i, /\bzoe\b/i, /allison/i, /aria/i, /jenny/i, /daniel/i];
    for (var i = 0; i < pref.length; i++) for (var j = 0; j < vs.length; j++) if (pref[i].test(vs[j].name)) return vs[j];
    for (var k = 0; k < vs.length; k++) if (vs[k].lang === 'en-US' && vs[k].localService) return vs[k];
    return vs[0] || null;
  }
  if ('speechSynthesis' in window) { try { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = function () { }; } catch (e) { } }
  function speakOne(text) {
    var tts = plugin('TextToSpeech');
    if (tts) return tts.speak({ text: text, lang: 'en-US', rate: 0.95, pitch: 1.0 });
    return new Promise(function (res) {
      var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.96; u.pitch = 1.0;
      var v = bestVoice(); if (v) u.voice = v;
      u.onend = res; u.onerror = res; window.speechSynthesis.speak(u);
    });
  }
  function fetchClip(name) {
    var a = D.briefingAudio; if (!name || !a) return Promise.resolve(null);
    var inl = window.__CONVERGE_AUDIO__; if (inl) return Promise.resolve(inl[name] || null);
    return fetch(a.base + name).then(function (r) { if (!r.ok) throw new Error('clip'); return r.arrayBuffer(); })
      .then(function (b) { return URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' })); }).catch(function () { return null; });
  }
  function playClip(url) {
    return new Promise(function (res) {
      var el = UI.audioEl; if (!el) return res();
      el.onended = res; el.onerror = res; el.src = url;
      var p = el.play(); if (p && p.catch) p.catch(res);
    });
  }
  function stopSpeech() {
    UI.speaking = false; UI.speakIdx = -1;
    if (UI.audioEl) { try { UI.audioEl.pause(); } catch (e) { } }
    var tts = plugin('TextToSpeech'); if (tts) tts.stop().catch(function () { });
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  function spokenFor(b) { return b.say || (b.t + '. ' + b.title + '. ' + (b.why || '')); }
  function playBriefing() {
    var q = briefState().queue; if (!q.length) return;
    var natural = naturalVoice();
    if (!natural && !ttsAvailable()) return toast('Audio is not available in this browser');
    if (natural) { if (!UI.audioEl) UI.audioEl = new Audio(); UI.audioEl.src = SILENT; var pp = UI.audioEl.play(); if (pp && pp.catch) pp.catch(function () { }); }
    UI.speaking = true; UI.speakIdx = -1; render();
    var run = UI.runId = uid();
    var bv = D.briefingVoice || {}, ba = D.briefingAudio || {};
    var steps = [{ say: bv.intro || "Here's your Converge briefing.", audio: ba.intro }].concat(q.map(function (b) { return { say: spokenFor(b), audio: b.audio }; })).concat([{ say: bv.outro || "That's your briefing.", audio: ba.outro }]);
    var clips = natural ? Promise.all(steps.map(function (st) { return fetchClip(st.audio); })) : Promise.resolve(steps.map(function () { return null; }));
    clips.then(function (urls) {
      var i = 0;
      (function next() {
        if (!UI.speaking || UI.runId !== run) return;
        if (i >= steps.length) { stopSpeech(); render(); urls.forEach(function (u) { if (u) URL.revokeObjectURL(u); }); return; }
        UI.speakIdx = i >= 1 && i <= q.length ? i - 1 : -1; render();
        var k = i++;
        Promise.resolve(urls[k] ? playClip(urls[k]) : speakOne(steps[k].say)).then(next, next);
      })();
    });
  }

  // ------------------------------------------------------------------ notifications (native)
  function notifyNewAlerts() {
    if (!isNative || !S.notify) return;
    var LN = plugin('LocalNotifications'); if (!LN) return;
    var mine = myTickers();
    var fresh = (D.alerts || []).filter(function (a) { return mine.indexOf(a.t) >= 0 && S.seenAlerts.indexOf('n:' + alertKey(a)) < 0; });
    if (!fresh.length) return;
    LN.schedule({ notifications: fresh.slice(0, 3).map(function (a, i) { return { id: Math.floor(Date.now() / 1000) % 100000 + i, title: 'Converge · ' + a.title, body: a.text, extra: { t: a.t } }; }) }).catch(function () { });
    fresh.forEach(function (a) { S.seenAlerts.push('n:' + alertKey(a)); }); save();
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    if (el.closest('[data-stop]') && el.dataset.act === 'sheet-bg') return;
    var fn = A[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    if (el.disabled) return;
    fn(el, e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.f && UI.draft) UI.draft[el.dataset.f] = el.value;
    if (el.dataset.rf && UI.reflect) UI.reflect[el.dataset.rf] = el.value;
    if (el.dataset.pickq) { UI.pickQuery = el.value; render(); }
    if (el.dataset.au) FORUM.form[el.dataset.au] = el.value;
    if (el.id === 'forum-text') FORUM.draft = el.value;
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.scanf) { var st = scanState(); if (el.value) st.f[el.dataset.scanf] = el.value; else delete st.f[el.dataset.scanf]; UI.scanLimit = 100; save(); render(); }
    if (el.dataset && el.dataset.scan === 'signal') { var st2 = scanState(); st2.signal = el.value; var d = sigDef(el.value); if (d[3]) st2.sort = { k: d[3].k, dir: d[3].dir }; UI.scanLimit = 100; save(); render(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') back(); });
  if (isNative) {
    var AppP = plugin('App');
    if (AppP) {
      AppP.addListener('backButton', function () { if (!back() && AppP.exitApp) AppP.exitApp(); });
      AppP.addListener('appStateChange', function (st) { if (st.isActive && D && Date.now() - Date.parse(D.generatedAt) > 10 * 60000) loadData(); });
    }
    var LN0 = plugin('LocalNotifications');
    if (LN0) LN0.addListener('localNotificationActionPerformed', function (ev) { var t = ev && ev.notification && ev.notification.extra && ev.notification.extra.t; if (t && D) { NAV.stack = [{ name: 'alert', t: t }]; render(); } });
  }
  window.__convergeTest = { isProfane: isProfane };
  if (window.__CONVERGE_ARTIFACT__) document.documentElement.classList.add('in-artifact');

  render();
  loadData();
  setInterval(function () { if (document.visibilityState === 'visible') loadData(); }, 15 * 60000);
})();
