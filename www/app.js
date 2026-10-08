/* Converge — investing command center. Plain JS, no build step; shared by web, Android and iOS (Capacitor). */
(function () {
  'use strict';

  // ------------------------------------------------------------------ config
  var CFG = {
    remote: 'https://raw.githubusercontent.com/ZStamov/converge/data/market.json',
    bundled: 'data/market.json',
    pulse: 'https://raw.githubusercontent.com/ZStamov/converge/pulse/pulse.json',
    smart: 'https://raw.githubusercontent.com/ZStamov/converge/smart/',
    quotes: 'https://raw.githubusercontent.com/ZStamov/converge/quotes/',
    history: 'https://raw.githubusercontent.com/ZStamov/converge/history/',
    repo: 'https://github.com/ZStamov/converge'
  };
  var KEY = 'converge.v1';
  var DEFAULT = { watchlist: ['AAPL', 'NVDA', 'MSFT', 'AMZN'], lots: [], watchTheses: {}, signal: false, topOnly: false, range: '1M', brief: { day: null, picked: [], skipped: [] }, seenAlerts: [], muted: [], sel: null, notify: false, feedFilter: 'mine', onboarded: false, scan: null, auth: null, demoTier: 'free', prefs: { civ: '1D', csig: true }, sigAlerts: [], sigLog: [], _sync: { k: {}, tomb: {} } };

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
  var SY = { status: 'idle', at: null, err: null, busy: false, again: false, timer: null, applying: false };
  var SYNCSNAP = window.ConvergeSync ? window.ConvergeSync.snapshot(S) : null;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: session-only */ } }
  function save() {
    var Y = window.ConvergeSync;
    if (Y && !SY.applying) {
      if (!S._sync) S._sync = { k: {}, tomb: {} };
      if (SYNCSNAP && Y.stamp(S, S._sync, SYNCSNAP, Date.now())) { SYNCSNAP = Y.snapshot(S); schedulePush(); }
      else if (!SYNCSNAP) SYNCSNAP = Y.snapshot(S);
    }
    persist();
  }
  function schedulePush() { if (!S.auth && !ADB.ready) return; clearTimeout(SY.timer); SY.timer = setTimeout(function () { syncNow('change'); }, 1200); }

  var D = null;            // market data
  var DS = { source: null, error: null, loading: true };
  var NAV = { tab: 'command', stack: [] };
  var UI = { side: 'bull', battleRange: '6M', vaultTab: 'lots', draft: null, sheet: null, toast: null, reflect: null, briefIdx: 0, speaking: false, speakIdx: -1, pickQuery: '' };
  if (!S.prefs) S.prefs = { civ: '1D', csig: true };
  UI.civ = S.prefs.civ || '1D'; if (S.prefs.csig === false) UI.csig = false;
  UI.acct = { name: '', email: '', pw1: '', pw2: '', del: '' };

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
        if (LQ.q) Object.keys(D.tickers).forEach(function (t) { var q = LQ.q[t], x = D.tickers[t]; if (!q || !num(q[0])) return; x.price = q[0]; if (num(q[1])) { x.changePct = q[1]; x.prevClose = q[0] / (1 + q[1] / 100); } });
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
  var XC = {};
  function X(t) {
    var x = T(t); if (x) return x;
    if (!t) return null;
    var q = LQ.q && LQ.q[t], dr = typeof dirRow === 'function' ? dirRow(t) : null, hh = HIST[t] && HIST[t].d;
    if (!hh && !HIST[t] && !(window.__CONVERGE_ARTIFACT__ && !(window.__CONVERGE_HIST__ || {})[t])) setTimeout(function () { histSeries(t, '1D'); }, 0);
    if (!dr && !DIR.rows && !DIR.loading && !DIR.error) setTimeout(loadDir, 0);
    var price = q ? q[0] : dr && dr.p != null ? dr.p : hh ? hh.c[hh.c.length - 1] : null;
    if (price == null) return null;
    var ch = q ? q[1] : dr && dr.ch != null ? dr.ch : hh && hh.c.length > 1 ? (hh.c[hh.c.length - 1] / hh.c[hh.c.length - 2] - 1) * 100 : null;
    var o = XC[t] || (XC[t] = { t: t, lite: true, quant: { score: null }, sentiment: { bull: null } });
    o.name = (dr && dr.n) || o.name || t; o.price = price; o.changePct = ch; o.prevClose = ch != null ? price / (1 + ch / 100) : price;
    if (hh && o._h !== hh) { o._h = hh; o.hist = { d: hh.t.map(function (sec) { return new Date((sec - 4 * 3600) * 1000).toISOString().slice(0, 10); }), c: hh.c.slice() }; }
    if (!o.hist) o.hist = { d: [today()], c: [price] };
    return o;
  }
  function openLots() { return S.lots.filter(function (l) { return l.status !== 'closed'; }); }
  function holdings() {
    var m = {};
    openLots().forEach(function (l) {
      var h = m[l.t] || (m[l.t] = { t: l.t, shares: 0, cost: 0, lots: [] });
      h.shares += l.shares; h.cost += l.shares * l.price; h.lots.push(l);
    });
    return Object.keys(m).map(function (k) {
      var h = m[k], x = X(k);
      h.price = x ? x.price : null; h.value = x ? h.shares * x.price : null;
      h.day = x ? h.shares * (x.price - x.prevClose) : 0; h.pl = h.value != null ? h.value - h.cost : null;
      return h;
    }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
  }
  function myTickers() {
    var s = {}; openLots().forEach(function (l) { s[l.t] = 1; }); S.watchlist.forEach(function (t) { s[t] = 1; });
    return Object.keys(s).filter(function (t) { return X(t); });
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
    var x = X(l.t); if (!x) return 'ok';
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
    var sers = hs.filter(function (h) { return X(h.t); }).map(function (h) { return { h: h, s: rangeSlice(X(h.t), r) }; }); if (!sers.length) return { k: [], c: [] };
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
    return '<p class="foot">' + (LQ.at ? '<span id="livestamp">' + esc(liveStamp()) + '</span><br>News and scores as of ' : 'Market data as of ') + esc(new Date(D.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' · ' + src + '<br>Free public sources, may be delayed. Not investment advice.</p>';
  }
  function alertKey(a) { return a.t + '|' + a.type + '|' + a.date.slice(0, 10); }

  // ------------------------------------------------------------------ screens
  function scrCommand() {
    var hs = holdings(), sel = S.sel && T(S.sel) ? S.sel : firstTicker(), x = T(sel);
    var h = pulseCard();
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
      myTickers().map(function (t) { var y = X(t) || {}; return '<button class="wlc" data-act="sel" data-t="' + t + '" aria-pressed="' + (t === sel) + '"><div class="tk">' + t + '</div><div class="ch ' + cls(y.changePct) + '">' + arrowPct(y.changePct) + '</div></button>'; }).join('') +
      '<button class="wlc add" data-act="pick" data-mode="watch" aria-label="Add ticker">' + ic('plus', 18) + '</button></div></section>';
    if ((S.sigAlerts || []).length || (S.sigLog || []).length) h += alertsCard();
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
    h += smartCards(sel);
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">More on ' + sel + '</h2><div class="lnkrow">' + extLinks(sel) + '</div></section>';
    var watching = S.watchlist.indexOf(sel) >= 0;
    h += '<div class="btnrow"><button class="btn" data-act="watch" data-t="' + sel + '">' + (watching ? 'Watching ✓' : 'Watch') + '</button><button class="btn pri" data-act="add" data-t="' + sel + '">Add a lot</button></div>';
    h += '<section class="card" id="btbox" data-t="' + esc(sel) + '">' + backtestInner(sel) + '</section>';
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
    var x = X(l.t), st = lotStatus(l), cur = l.status === 'closed' ? l.sell.price : x ? x.price : null;
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
    var x = t ? X(t) : null;
    return { mode: mode || 'lot', t: t || null, shares: '', price: x ? String(x.price) : '', date: today(), title: '', why: '', pins: [], target: '', horizon: '12M', kill: '', step: t ? 2 : 1, lotId: null, watchOnly: mode === 'watch' };
  }
  function scrAdd() {
    var d = UI.draft, x = d.t ? X(d.t) : null, h = '';
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
    var x = X(l.t), th = l.thesis, h = '';
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
    var fake = { t: t, price: th.snap && th.snap.price || (X(t) ? X(t).price : 0), date: th.createdAt.slice(0, 10), thesis: th, id: 'w-' + t };
    var x = X(t);
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
  function selPref(name, cur, opts, label) {
    return '<label class="setrow"><span>' + label + '</span><select class="in sm" data-pref="' + name + '">' + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>';
  }
  function tog(act, on, t1, t2) { return '<button class="rowtoggle flat" data-act="' + act + '" aria-pressed="' + !!on + '"><span><span class="t1">' + t1 + '</span>' + (t2 ? '<span class="t2">' + t2 + '</span>' : '') + '</span><span class="sw"></span></button>'; }
  function scrSettings() {
    var A0 = UI.acct, h = '', msg = UI.acctMsg ? '<p class="note" style="margin:0 0 10px">' + esc(UI.acctMsg) + '</p>' : '';
    // --- account
    if (accountsReady() && S.auth) {
      var nm = S.auth.name || (S.auth.user.email || '').split('@')[0];
      h += '<section class="card" id="acct-profile"><div class="acct-h"><span class="avatar">' + esc((nm[0] || '?').toUpperCase()) + '</span><div style="min-width:0"><div style="font-weight:700;font-size:16px">' + esc(nm) + '</div><div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis">' + esc(S.auth.user.email || '') + '</div></div><span class="badge-prem" style="margin-left:auto">' + planName().toUpperCase() + '</span></div>' + msg +
        '<div class="field"><label for="ac-name">Display name <span class="opt">(shown on your posts)</span></label><div class="inrow"><input class="in" id="ac-name" data-acct="name" maxlength="30" autocomplete="nickname" value="' + esc(A0.name || nm) + '"><button class="btn sm" data-act="acct-name">Save</button></div></div>' +
        '<div class="field"><label for="ac-email">Email</label><div class="inrow"><input class="in" id="ac-email" data-acct="email" type="email" autocomplete="email" value="' + esc(A0.email || S.auth.user.email || '') + '"><button class="btn sm" data-act="acct-email">Change</button></div></div>' +
        '<div class="field"><label for="ac-pw1">New password</label><input class="in" id="ac-pw1" data-acct="pw1" type="password" autocomplete="new-password" placeholder="At least 8 characters" value="' + esc(A0.pw1) + '"></div>' +
        '<div class="field"><label for="ac-pw2">Repeat new password</label><div class="inrow"><input class="in" id="ac-pw2" data-acct="pw2" type="password" autocomplete="new-password" value="' + esc(A0.pw2) + '"><button class="btn sm" data-act="acct-pass">Update</button></div></div>' +
        '<div class="btnrow" style="margin-top:12px"><button class="btn sm" data-act="forum-signout">Sign out</button><button class="btn sm" data-act="device-wipe">Sign out &amp; clear this device</button></div></section>';
    } else if (accountsReady()) {
      h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:6px">Your account</h2>' + msg + '<p style="margin:0 0 10px;font-size:13px;line-height:1.5">Sign in to see the same lots, theses, watchlist and settings on your phone, tablet and computer. Anything you’ve already added on this device is kept and merged into your account.</p><button class="btn sm pri" data-act="forum-auth">Sign in or create an account</button></section>';
    } else {
      h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:6px">Your account</h2><p class="muted" style="margin:0;font-size:13px;line-height:1.5">' + (window.__CONVERGE_ARTIFACT__ ? 'This page uses your Claude login: open it on any phone, tablet or computer where you’re signed in to Claude and your lots, theses, watchlist and settings follow you. Converge accounts and subscriptions live in the Converge app and website.' : 'Converge accounts aren’t connected yet (the owner adds the Supabase settings from the README). Until then, use Copy my data and Import data below to move your holdings between devices.') + '</p></section>';
    }
    // --- sync
    h += '<section class="card"><div class="sechead"><h2 class="eyebrow">Sync across devices</h2>' + (syncMode() ? '<button class="lnk" data-act="sync-now">Sync now</button>' : '') + '</div><p id="syncstat" class="syncstat ' + SY.status + '">' + syncLine() + '</p><p class="muted" style="margin:6px 0 0;font-size:12px;line-height:1.5">Synced: lots and their theses, closed trades and sell reasons, watchlist and watchlist theses, scanner screens and strategy toggles, muted sources, today’s briefing picks and the preferences below. Each device keeps its own notification permission.</p></section>';
    // --- plan & subscription
    var price = FCONF.premiumPrice, portal = safeUrl(FCONF.premiumPortalUrl), checkout = safeUrl(FCONF.premiumUrl);
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Plan &amp; subscription</h2>' +
      '<div class="planrow"><div><div style="font-size:16px;font-weight:700" class="' + (isPremium() ? 'up' : '') + '">' + planName() + '</div><div class="muted" style="font-size:12px">' + (isPremium() ? 'Strategy scanners and posting unlocked' : 'Strategy scanners and posting are Premium') + (S.auth && S.auth.premium_until && premiumRequired() ? ' · until ' + esc(new Date(S.auth.premium_until).toLocaleDateString()) : '') + '</div></div>' + (price ? '<span class="mono">' + esc(price) + '</span>' : '') + '</div>' +
      (!premiumRequired() ? '<p class="note" style="margin:10px 0 0">Testing mode: every account has all Premium features and billing is off. The paywall turns on when the owner sets PREMIUM_REQUIRED to true.</p>' : '') +
      '<div class="btnrow" style="margin-top:10px">' +
      (premiumRequired() && !isPremium() ? '<button class="btn sm pri" data-act="subscribe">' + (checkout ? 'Upgrade to Premium' : 'See Premium') + '</button>' : '') +
      (premiumRequired() && isPremium() && portal ? '<a class="btn sm" href="' + esc(portal) + '" target="_blank" rel="noopener">Manage or cancel subscription</a>' : '') +
      (S.auth && accountsReady() ? '<button class="btn sm" data-act="tier-refresh">Refresh plan</button>' : '') + '</div>' +
      (premiumRequired() && isPremium() && !portal ? '<p class="muted" style="margin:8px 0 0;font-size:12px">To change or cancel, contact the Converge team (the billing portal isn’t connected yet).</p>' : '') +
      (!accountsReady() && premiumRequired() ? tog('demo-tier', S.demoTier === 'premium', 'Preview Premium', 'This copy has no accounts') : '') + '</section>';
    // --- preferences
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:6px">Preferences</h2><div class="setlist">' +
      tog('signal', S.signal, 'Signal Mode', 'Hide news, opinion and commentary; keep filings and quant updates') +
      tog('toponly', S.topOnly, 'Top performers only', 'Signal Feed shows only sources with the best track records') +
      tog('csig', UI.csig !== false, 'Buy &amp; sell signals on charts', 'BUY / SELL labels and the backtest') +
      selPref('range', S.range, RANGES, 'Portfolio chart range') +
      selPref('civ', S.prefs.civ || '1D', CINTERVALS, 'Default candle interval') +
      selPref('feed', S.feedFilter, [['mine', 'My holdings & watchlist'], ['all', 'All covered tickers']], 'Signal Feed shows') +
      (isNative && plugin('LocalNotifications') ? tog('notify', S.notify, 'Divergence alerts', 'Notifications on this device') : '') + '</div></section>';
    h += alertsCard();
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Muted sources</h2>' + (S.muted.length ? S.muted.map(function (m) { return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0"><span>' + esc(m) + '</span><button class="btn sm" data-act="mute" data-name="' + esc(m) + '">Unmute</button></div>'; }).join('') : '<p class="muted" style="margin:0;font-size:13px">None. Mute a source from its profile.</p>') + '</section>';
    // --- data
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Your data</h2><p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">' + (syncMode() === 'account' ? 'Stored on this device and in your Converge account. Only you can read it.' : syncMode() === 'page' ? 'Stored on this device and privately with your Claude account. Only you can read it.' : 'Stored only on this device.') + ' ' + S.lots.length + ' lot' + (S.lots.length === 1 ? '' : 's') + ', ' + S.watchlist.length + ' on the watchlist.</p>' +
      '<div class="btnrow" style="margin-bottom:8px"><button class="btn sm" data-act="data-copy">Copy my data</button><button class="btn sm" data-act="data-import">Import data</button></div>' +
      '<div class="btnrow">' + (window.__CONVERGE_ARTIFACT__ ? '' : '<button class="btn sm" data-act="export-data">Export file</button>') + '<button class="btn sm dng" data-act="reset">' + (UI.confirmReset ? 'Tap again to erase' + (syncMode() ? ' everywhere' : '') : 'Erase all my data' + (syncMode() ? ' (all devices)' : '')) + '</button></div></section>';
    if (accountsReady() && S.auth) h += '<section class="card dzone"><h2 class="eyebrow" style="margin-bottom:6px">Delete account</h2><p class="muted" style="margin:0 0 8px;font-size:13px;line-height:1.5">Permanently deletes your account, your synced data, your plan and your discussion posts. Type DELETE to confirm.</p><div class="inrow"><input class="in" id="ac-del" data-acct="del" autocomplete="off" placeholder="DELETE" value="' + esc(A0.del) + '"><button class="btn sm dng" data-act="acct-delete"' + (A0.del === 'DELETE' ? '' : ' disabled') + '>Delete</button></div></section>';
    // --- market data (unchanged information)
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Market data</h2><p style="margin:0;font-size:13px;line-height:1.5">Updated ' + esc(new Date(D.generatedAt).toLocaleString()) + ' (' + ago(D.generatedAt) + ').<br>Loaded from: ' + (DS.source === 'live' ? 'the live feed' : DS.source === 'snapshot' ? 'the snapshot built into this page' : 'the copy bundled with the app') + '.</p>' +
      '<p class="muted" style="margin:8px 0 0;font-size:12px;line-height:1.5">Sources: ' + esc((D.method && D.method.sources || []).join(' · ')) + '. Refreshed automatically every hour.</p>' +
      '<button class="btn sm" data-act="refresh" style="margin-top:10px">' + ic('refresh', 16) + 'Refresh now</button></section>';
    var ss = (D.method && D.method.sourceStatus) || {};
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">News &amp; data sources</h2>' + Object.keys(ss).map(function (k) { var x = ss[k], ok = x.ok > 0; return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)"><span>' + esc(k) + '</span><span class="mono ' + (ok ? 'up' : 'down') + '">' + (ok ? 'Live · ' + x.items + ' items' : 'Unavailable') + '</span></div>'; }).join('') +
      '<p class="muted" style="margin:8px 0 0;font-size:12px;line-height:1.5">Finviz, StockAnalysis and X open as links from each ticker. Their terms or paid APIs don’t allow pulling their data into the app.</p></section>';
    h += '<p class="foot">Converge · ' + esc(deviceName()) + ' · Covers ' + D.universe.length + ' tickers · <a href="' + CFG.repo + '" target="_blank" rel="noopener noreferrer">Source code</a><br>Information only, not investment advice.</p>';
    return subBar('Account & settings') + '<main class="main" id="main">' + h + '</main>';
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
    // one strategy scanner at a time (older saved screens could have several switched on)
    var on = Object.keys(S.scan.presets || {}).filter(function (k) { return S.scan.presets[k]; });
    if (on.length > 1) { S.scan.presets = {}; S.scan.presets[on[on.length - 1]] = true; }
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
      '<button class="btn sm" data-act="scan-toggle" aria-expanded="' + (!!st.open && !UI.scanCollapsed) + '">' + (UI.scanCollapsed ? 'Edit filters' : 'Filters') + (nActive ? ' (' + nActive + ')' : '') + '</button></div>';
    if (UI.scanCollapsed) {
      var onP = PRESETS.filter(function (p) { return isPremium() && (st.presets || {})[p.id]; });
      var fl = Object.keys(st.f).map(function (id) { var d = FIDX[id]; if (!d) return null; var o = d.o.filter(function (x) { return x[0] === st.f[id]; })[0]; return d.label + ': ' + (o ? o[0] : st.f[id]); }).filter(Boolean);
      var sigN = st.signal && st.signal !== 'none' ? sigDef(st.signal)[1] : null;
      h += '<section class="card scan-sum"><div class="sechead"><h2 class="eyebrow">Your screen</h2><button class="btn sm" data-act="scan-edit">Edit</button></div><div class="chips">' +
        (onP.length || fl.length || sigN ? onP.map(function (p) { return '<button class="chip on" data-act="scan-edit" aria-label="Edit ' + esc(p.name) + '">' + esc(p.name) + ' · Edit</button>'; }).join('') + (sigN ? '<button class="chip on" data-act="scan-edit">Signal: ' + esc(sigN) + ' · Edit</button>' : '') + fl.map(function (x) { return '<button class="chip on" data-act="scan-edit">' + esc(x) + ' · Edit</button>'; }).join('') : '<span class="muted" style="font-size:13px">No filters: all ' + SC.count + ' stocks.</span>') + '</div></section>';
    } else {
      h += presetsCard();
      if (st.saved && st.saved.length) h += '<div class="chips">' + st.saved.map(function (s, i) { return '<button class="chip" data-act="scan-load" data-i="' + i + '">' + esc(s.name) + '</button>'; }).join('') + '</div>';
    }
    if (st.open && !UI.scanCollapsed) {
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
      '<div class="btnrow" style="margin-top:12px"><button class="btn pri" data-act="open-chart" data-t="' + esc(t) + '">' + (covered ? 'Open in Battleground' : 'Open chart &amp; signals') + '</button></div>' +
      (covered ? '' : '<p class="muted" style="margin:6px 0 0;font-size:11px">Chart, BUY/SELL signals and backtest. News and sentiment cover the ' + D.universe.length + ' tracked tickers.</p>');
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
  var LIVE_Q = { '1m': ['1d', '1m'], '2m': ['5d', '2m'], '5m': ['5d', '5m'], '1h': ['3mo', '60m'], '2h': ['3mo', '60m'], '4h': ['3mo', '60m'], '5h': ['3mo', '60m'], '1D': ['2y', '1d'], '2D': ['5y', '1d'], '1W': ['5y', '1wk'] };
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
    return fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ysym(t)) + '?range=' + q[0] + '&interval=' + q[1] + '&includePrePost=false', 9000)
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
    var snap = snapshotSeries(t, iv); if (snap) return { s: snap, live: false };
    var hs = histSeries(t, iv); return { s: hs, live: false, hist: !!hs };
  }
  // ---- stock directory (every US exchange-listed stock) and daily history for stocks outside the tracked list
  var DIR = { rows: null, map: null, loading: false, error: null, at: null };
  function loadDir() {
    if (DIR.rows || DIR.loading) return;
    DIR.loading = true;
    var snap = window.__CONVERGE_SYMBOLS__;
    fetchJson(CFG.history + 'symbols.json?t=' + Math.floor(Date.now() / 3600000), 15000)
      .then(function (d) { if (!d || d.kind !== 'symbols') throw new Error('bad'); return d; })
      .catch(function () { if (snap && snap.kind === 'symbols') return snap; throw new Error('none'); })
      .then(function (d) { DIR.rows = d.rows; DIR.at = d.generatedAt; DIR.through = d.barsThrough; DIR.map = {}; d.rows.forEach(function (r, i) { DIR.map[r[0]] = i; }); })
      .catch(function () { DIR.error = 'The stock list isn’t available right now.'; })
      .then(function () { DIR.loading = false; if (UI.sheet && UI.sheet.kind === 'pick') render(); else if (current().name === 'quote' && DIR.rows) render(); });
  }
  function dirRow(t) { if (!DIR.map || DIR.map[t] == null) return null; var r = DIR.rows[DIR.map[t]]; return { t: r[0], n: r[1], ex: r[2], sp: !!r[3], sec: r[4], mc: r[5], p: r[6], ch: r[7], y: r[8] || null }; }
  function ysym(t) { var r = dirRow(t); return (r && r.y) || t.replace('.', '-'); }
  function dirSearch(q, limit) {
    if (!DIR.rows || !q) return [];
    var Q = q.toUpperCase(), a = [], b = [], c = [];
    for (var i = 0; i < DIR.rows.length; i++) {
      var r = DIR.rows[i], t = r[0];
      if (t === Q) a.push(r); else if (t.indexOf(Q) === 0) b.push(r); else if (Q.length >= 2 && String(r[1]).toUpperCase().indexOf(Q) >= 0) c.push(r);
    }
    return a.concat(b, c).slice(0, limit || 40); // rows are sorted by market cap
  }
  var HIST = {};
  function loadHist(t) {
    if (HIST[t]) return;
    HIST[t] = { loading: true };
    fetchJson(CFG.history + 'h/' + encodeURIComponent(t) + '.json?t=' + Math.floor(Date.now() / 3600000), 15000)
      .then(function (d) { if (!d || !d.t || d.t.length < 2) throw new Error('empty'); HIST[t] = { d: d }; })
      .catch(function () { HIST[t] = { error: true }; })
      .then(function () { refreshCandleBox(); if (current().name === 'quote') render(); });
  }
  function weekly(s) {
    if (!s) return null;
    var out = { t: [], o: [], h: [], l: [], c: [], v: [] }, wk = null;
    for (var i = 0; i < s.t.length; i++) {
      var d = new Date((s.t[i] - 4 * 3600) * 1000), mon = Math.floor((d.getTime() / 86400000 - ((d.getUTCDay() + 6) % 7)));
      if (mon !== wk) { wk = mon; out.t.push(s.t[i]); out.o.push(s.o[i]); out.h.push(s.h[i]); out.l.push(s.l[i]); out.c.push(s.c[i]); out.v.push(s.v[i] || 0); }
      else { var k = out.t.length - 1; out.h[k] = Math.max(out.h[k], s.h[i]); out.l[k] = Math.min(out.l[k], s.l[i]); out.c[k] = s.c[i]; out.v[k] += s.v[i] || 0; }
    }
    return out;
  }
  function histSeries(t, iv) {
    var EH = window.__CONVERGE_HIST__; if (!HIST[t] && EH && EH[t] && EH[t].t) HIST[t] = { d: EH[t] };
    if (T(t) || window.__CONVERGE_ARTIFACT__ && !HIST[t]) return null;
    if (!HIST[t]) { loadHist(t); return null; }
    var d = HIST[t].d; if (!d) return null;
    if (iv === '1D') return d; if (iv === '2D') return aggregate(d, 2, false); if (iv === '1W') return weekly(d);
    return null;
  }
  function candleLabel(sec, iv) {
    var d = new Date(sec * 1000);
    if (/m$|h$/.test(iv)) return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtP(x) { return x >= 1000 ? x.toFixed(1) : x >= 10 ? x.toFixed(2) : x.toFixed(3); }
  var SIGC = {};
  function marksFor(s, iv) {
    var SG = window.ConvergeSignals; if (!SG || !s || s.t.length < 30) return null;
    var d = SG.detect(s, iv), bt = SG.backtest(s, iv, { detected: d }), marks = {};
    var put = function (i, id, side) { if (i >= 0) (marks[i] = marks[i] || []).push({ i: i, id: id, side: side }); };
    bt.trades.forEach(function (tr) { put(tr.in - 1, tr.why, 'buy'); if (tr.exitWhy === 'atr') put(tr.out, 'atr', 'sell'); else put(tr.out - 1, tr.exitWhy, 'sell'); });
    if (bt.open) put(bt.open.in - 1, bt.open.why, 'buy');
    return { d: d, bt: bt, marks: marks };
  }
  // newest BUY/SELL on completed candles (the live candle can still change)
  function latestMark(t, iv, side) {
    var r = candleSeries(t, iv), s = r.s; if (!s || s.t.length < 30) return null;
    var M = marksFor(s, iv); if (!M) return null;
    var lastOk = s.t.length - ((r.live && /m$|h$/.test(iv)) ? 2 : 1);
    for (var i = lastOk; i >= 0; i--) { var mk = M.marks[i]; if (!mk) continue; for (var j = 0; j < mk.length; j++) if (side === 'both' || mk[j].side === side) return { at: s.t[i], side: mk[j].side, id: mk[j].id, price: s.c[i], i: i }; }
    return null;
  }
  function alertFor(t, iv) { return (S.sigAlerts || []).filter(function (a) { return a.t === t && a.iv === iv; })[0] || null; }
  var SAQ = { busy: false };
  function checkSignalAlerts() {
    var list = S.sigAlerts || []; if (!list.length || SAQ.busy) return;
    SAQ.busy = true; var fired = [], changed = false;
    list.forEach(function (a) {
      try {
        var m = latestMark(a.t, a.iv, a.side || 'both'); if (!m) return;
        if (a.last == null) { a.last = m.at; changed = true; return; } // start from the current state; only new signals notify
        if (m.at > a.last) { a.last = m.at; changed = true; fired.push({ a: a, m: m }); }
      } catch (e) { /* skip this one */ }
    });
    SAQ.busy = false;
    if (changed) save();
    fired.forEach(function (f) { fireSignal(f.a, f.m); });
  }
  function fireSignal(a, m) {
    var R = window.ConvergeSignals && window.ConvergeSignals.BY_ID[m.id], side = m.side === 'buy' ? 'BUY' : 'SELL';
    var title = a.t + ' · ' + side + ' signal (' + a.iv + ')', body = (R ? R.name + ' (lesson ' + R.lesson + ')' : 'Signal') + ' · ' + money(m.price) + ' · ' + new Date(m.at * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    S.sigLog = (S.sigLog || []).concat([{ t: a.t, iv: a.iv, side: m.side, id: m.id, price: m.price, at: m.at, seen: false, when: Date.now() }]).slice(-30); persist();
    var LN = isNative && plugin('LocalNotifications');
    if (LN) LN.schedule({ notifications: [{ id: Math.floor(Date.now() / 1000) % 1000000, title: 'Converge · ' + title, body: body, extra: { t: a.t, sig: 1 } }] }).catch(function () { });
    else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('Converge · ' + title, { body: body, tag: a.t + a.iv + m.at }); } catch (e) { } }
    toast('🔔 ' + title);
  }
  function notifPermission() {
    if (isNative) return plugin('LocalNotifications') ? 'app' : 'none';
    if (typeof Notification === 'undefined') return 'none';
    return Notification.permission; // granted | denied | default
  }
  function askNotify() {
    var LN = isNative && plugin('LocalNotifications');
    if (LN) return LN.requestPermissions().then(function (r) { return r && r.display === 'granted'; }).catch(function () { return false; });
    if (typeof Notification !== 'undefined' && Notification.requestPermission) return Promise.resolve(Notification.requestPermission()).then(function (p) { return p === 'granted'; }).catch(function () { return false; });
    return Promise.resolve(false);
  }
  function alertSheet() {
    var sh = UI.sheet, t = sh.t, iv = sh.iv, a = alertFor(t, iv), side = UI.alertSide || (a ? a.side : 'both');
    var perm = notifPermission(), cur = latestMark(t, iv, 'both');
    var opt = function (v, l) { return '<button class="chip" data-act="alert-side" data-v="' + v + '" aria-pressed="' + (side === v) + '">' + l + '</button>'; };
    return '<h2 class="disp" style="margin:0 0 4px;font-size:20px">Signal alert · ' + esc(t) + ' · ' + esc(iv) + '</h2>' +
      '<p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Get a notification when the ' + esc(iv) + ' chart prints a new signal: one BUY, then nothing until its SELL, like the labels on the chart.' + (cur ? ' Latest: <b class="' + (cur.side === 'buy' ? 'up' : 'down') + '">' + (cur.side === 'buy' ? 'BUY' : 'SELL') + '</b> on ' + esc(new Date(cur.at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + '.' : '') + '</p>' +
      '<div class="chips">' + opt('both', 'BUY and SELL') + opt('buy', 'BUY only') + opt('sell', 'SELL only') + '</div>' +
      (perm === 'denied' ? '<p class="note" style="margin:10px 0 0">Notifications are blocked for this ' + (isNative ? 'app' : 'browser') + '. Alerts still show inside Converge; turn notifications on in your device settings to get them on your lock screen.</p>' : perm === 'none' ? '<p class="note" style="margin:10px 0 0">This view can’t show system notifications, so alerts appear inside Converge while it’s open. The Android and iOS apps and the website can notify you.</p>' : '') +
      '<p class="muted" style="margin:10px 0 0;font-size:12px;line-height:1.5">Converge checks every minute while it’s open, and catches up on anything new as soon as you open it again.' + (!isNative && /m$|h$/.test(iv) && !T(t) ? ' On the website, intraday alerts work for the tracked tickers; pick 1D, 2D or 1W here, or use the apps.' : '') + '</p>' +
      '<div class="btnrow" style="margin-top:12px">' + (a ? '<button class="btn sm dng" data-act="alert-del" data-t="' + esc(t) + '" data-iv="' + esc(iv) + '">Remove alert</button>' : '') + '<button class="btn sm pri" data-act="alert-save" data-t="' + esc(t) + '" data-iv="' + esc(iv) + '">' + (a ? 'Update alert' : 'Turn on alert') + '</button></div>';
  }
  function alertsCard() {
    var list = S.sigAlerts || [], log = (S.sigLog || []).slice().reverse().slice(0, 8);
    var h = '<section class="card"><div class="sechead"><h2 class="eyebrow">Signal alerts</h2><span class="muted" style="font-size:11px">' + list.length + ' active</span></div>';
    if (!list.length) h += '<p class="muted" style="margin:0;font-size:13px;line-height:1.5">Open any chart and tap <b>🔔 Alert</b> to be notified of new BUY or SELL signals.</p>';
    else h += '<div class="srows">' + list.map(function (a) { return '<div class="srow"><div><b>' + esc(a.t) + '</b> · ' + esc(a.iv) + '<br><span class="muted">' + (a.side === 'buy' ? 'BUY only' : a.side === 'sell' ? 'SELL only' : 'BUY and SELL') + '</span></div><div class="scol"><button class="lnk" data-act="alert-open" data-t="' + esc(a.t) + '" data-iv="' + esc(a.iv) + '">Edit</button> <button class="lnk" data-act="alert-del" data-t="' + esc(a.t) + '" data-iv="' + esc(a.iv) + '" style="color:var(--muted)">Remove</button></div></div>'; }).join('') + '</div>';
    if (log.length) h += '<h3 class="eyebrow" style="margin:12px 0 4px">Recent signals</h3><div class="srows">' + log.map(function (g) { return '<div class="srow"><div><b>' + esc(g.t) + '</b> · ' + esc(g.iv) + '<br><span class="muted">' + esc(new Date(g.at * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</span></div><div class="scol"><b class="' + (g.side === 'buy' ? 'up' : 'down') + '">' + (g.side === 'buy' ? 'BUY' : 'SELL') + '</b><br><span class="muted mono">' + money(g.price) + '</span></div></div>'; }).join('') + '</div>';
    var perm = notifPermission();
    if (list.length && perm === 'default') h += '<button class="btn sm" data-act="alert-perm" style="margin-top:10px">Allow notifications on this device</button>';
    return h + '</section>';
  }
  function signalsFor(t, iv, s, live) {
    var SG = window.ConvergeSignals; if (!SG || !s || s.t.length < 30) return null;
    var key = t + '|' + iv + '|' + s.t.length + '|' + s.t[s.t.length - 1] + '|' + s.c[s.c.length - 1] + '|' + (live ? 1 : 0);
    if (SIGC[key]) return SIGC[key];
    var d = SG.detect(s, iv), bt = SG.backtest(s, iv, { detected: d }), marks = {};
    var put = function (i, id, side) { if (i >= 0) (marks[i] = marks[i] || []).push({ i: i, id: id, side: side }); };
    // one BUY per trade (the candle whose signal opened it), then one SELL when it closes (a trailing-stop exit is a SELL too)
    bt.trades.forEach(function (tr) { put(tr.in - 1, tr.why, 'buy'); if (tr.exitWhy === 'atr') put(tr.out, 'atr', 'sell'); else put(tr.out - 1, tr.exitWhy, 'sell'); });
    if (bt.open) put(bt.open.in - 1, bt.open.why, 'buy');
    SIGC = {}; SIGC[key] = { d: d, bt: bt, marks: marks }; // keep one chart's worth
    return SIGC[key];
  }
  function isLand() { return window.innerWidth > window.innerHeight && window.innerWidth >= 600; }
  function chartDims() {
    if (!UI.cfull) { var box = document.getElementById('candlebox'), bw0 = box && box.clientWidth; var w0 = bw0 > 200 ? bw0 : Math.min(window.innerWidth, window.innerWidth >= 768 ? 760 : 480) - 66; var wide = w0 > 420; return { W: Math.round(w0), PH: wide ? 230 : 176, VH: wide ? 44 : 34, AX: 46 }; }
    var land = isLand(), w = land ? Math.round(window.innerWidth * 0.66) - 28 : Math.min(window.innerWidth, 1600) - 24;
    var hAll = land ? Math.max(150, window.innerHeight - (window.innerHeight < 500 ? 190 : 220)) : Math.max(240, Math.round(window.innerHeight * 0.52));
    return { W: Math.max(280, w), PH: Math.round(hAll * 0.84), VH: Math.round(hAll * 0.16) - 8, AX: 58 };
  }
  function timeTick(sec, iv, prev) {
    var d = new Date(sec * 1000), p = prev != null ? new Date(prev * 1000) : null;
    if (/m$|h$/.test(iv)) {
      if (!p || d.toDateString() !== p.toDateString()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' AM', 'a').replace(' PM', 'p');
    }
    if (iv === '1W') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '");
    if (!p || d.getFullYear() !== p.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function niceStep(range, n) { var raw = range / n, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function emptyChartMsg(t, iv) {
    if (CDS.loading || (!CD && !CDS.error)) return 'Loading candles…';
    if (!T(t)) {
      if (window.__CONVERGE_ARTIFACT__) return (/m$|h$/.test(iv) && HIST[t] ? 'This page has daily history for ' + esc(t) + ': pick 1D, 2D or 1W. Intraday candles are in the Android and iOS apps.' : 'This page includes daily charts for the major indexes, popular ETFs and the 100 largest US stocks. ' + esc(t) + '’s chart loads in the Converge app and website.');
      var h = HIST[t];
      if (/m$|h$/.test(iv) && !isNative) return 'Intraday candles for ' + esc(t) + ' are in the Android and iOS apps. On the web, pick 1D, 2D or 1W (2 years of daily history).';
      if (!h || h.loading) return 'Loading ' + esc(t) + ' history…';
      if (h.error) return 'Daily history for ' + esc(t) + ' isn’t ready yet. New stocks are added every couple of hours.';
    }
    return 'No ' + esc(iv) + ' candles for ' + esc(t) + ' yet.';
  }
  function candleSvg(t) {
    var iv = UI.civ || '1D', r = candleSeries(t, iv), s = r.s;
    if (!s || s.t.length < 2) return '<div class="muted" style="padding:28px 8px;text-align:center;font-size:13px;line-height:1.5">' + emptyChartMsg(t, iv) + '</div>';
    var N = UI.cN || (UI.cfull ? 120 : 60), len = s.t.length; N = clamp(N, Math.min(15, len), len);
    var off = clamp(UI.cOff || 0, 0, Math.max(0, len - N)); UI.cOff = off;
    var a = len - N - off, b = len - off; // [a, b)
    var hi = -Infinity, lo = Infinity, vmax = 0;
    for (var i = a; i < b; i++) { hi = Math.max(hi, s.h[i]); lo = Math.min(lo, s.l[i]); vmax = Math.max(vmax, s.v[i]); }
    var SGN = UI.csig === false ? null : signalsFor(t, iv, s, r.live);
    var pad = (hi - lo) * (SGN ? 0.16 : 0.08) || hi * 0.01; hi += pad; lo -= pad;
    var dim = chartDims(), W = dim.W, PH = dim.PH, VH = dim.VH, AX = dim.AX, PW = W - AX, GAP = 8, H = PH + GAP + VH, step = PW / N, bw = Math.max(1, step * 0.66);
    var y = function (p) { return (hi - p) / (hi - lo) * PH; };
    var body = '', axis = '';
    // right-hand price scale
    var st = niceStep(hi - lo, UI.cfull ? 7 : 5), first = Math.ceil(lo / st) * st, dec = st >= 1 ? (st % 1 ? 1 : 0) : st >= 0.1 ? 1 : st >= 0.01 ? 2 : 3;
    for (var pv = first; pv <= hi; pv += st) {
      var gy = y(pv); if (gy < 6 || gy > PH - 6) continue;
      body += '<line x1="0" x2="' + PW + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
      axis += '<span class="cax tick mono" style="top:' + (gy - 7).toFixed(0) + 'px;width:' + AX + 'px">' + pv.toFixed(dec) + '</span>';
    }
    body += '<line x1="' + PW + '" x2="' + PW + '" y1="0" y2="' + H + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
    for (var k = a; k < b; k++) {
      var x = (k - a) * step + step / 2, up = s.c[k] >= s.o[k], col = up ? 'var(--bull)' : 'var(--bear)';
      var yo = y(s.o[k]), yc = y(s.c[k]), top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yo - yc));
      body += '<line x1="' + x.toFixed(2) + '" x2="' + x.toFixed(2) + '" y1="' + y(s.h[k]).toFixed(2) + '" y2="' + y(s.l[k]).toFixed(2) + '" stroke="' + col + '" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
      body += '<rect x="' + (x - bw / 2).toFixed(2) + '" y="' + top.toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + hgt.toFixed(2) + '" fill="' + col + '"></rect>';
      if (vmax) { var vh = s.v[k] / vmax * VH; body += '<rect x="' + (x - bw / 2).toFixed(2) + '" y="' + (H - vh).toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + vh.toFixed(2) + '" fill="' + col + '" fill-opacity="0.35"></rect>'; }
    }
    // BUY / SELL labels (staggered when they would overlap)
    var nlab = 0;
    if (SGN) {
      var endB = -1e9, endS = -1e9, rowB = 0, rowS = 0, LH = 12;
      for (var m = a; m < b; m++) {
        var mk = SGN.marks[m]; if (!mk) continue;
        var mx = (m - a) * step + step / 2, hasB = null, hasS = null;
        mk.forEach(function (g) { if (g.side === 'buy') hasB = hasB || g; else if (!hasS || hasS.id === 'atr') hasS = g; });
        var lab = function (txt, xx, yy, fill, ink) { var w = txt.length * 5.6 + 6; nlab++; xx = clamp(xx, w / 2 + 1, PW - w / 2 - 1); return '<g class="slab"><rect x="' + (xx - w / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + LH + '" rx="2.5" fill="' + fill + '"></rect><text x="' + xx.toFixed(1) + '" y="' + (yy + 9).toFixed(1) + '" text-anchor="middle" fill="' + ink + '">' + txt + '</text></g>'; };
        if (hasS) { var txt = 'SELL', wS = 4 * 5.6 + 6; rowS = mx - wS / 2 < endS + 1 ? (rowS + 1) % 3 : 0; endS = mx + wS / 2; var ys = clamp(y(s.h[m]) - 4 - LH - rowS * (LH + 2), 0, PH - LH); body += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + y(s.h[m]).toFixed(1) + '" y2="' + (ys + LH).toFixed(1) + '" stroke="' + 'var(--bear)' + '" stroke-width="1" vector-effect="non-scaling-stroke"></line>' + lab(txt, mx, ys, 'var(--bear)', 'var(--bear-ink)'); }
        if (hasB) { var wB = 3 * 5.6 + 6; rowB = mx - wB / 2 < endB + 1 ? (rowB + 1) % 3 : 0; endB = mx + wB / 2; var yb = clamp(y(s.l[m]) + 4 + rowB * (LH + 2), 0, PH - LH); body += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + y(s.l[m]).toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="var(--bull)" stroke-width="1" vector-effect="non-scaling-stroke"></line>' + lab('BUY', mx, yb, 'var(--bull)', 'var(--bull-ink)'); }
      }
    }
    var last = s.c[b - 1], ly = y(last);
    body += '<line x1="0" x2="' + PW + '" y1="' + ly.toFixed(2) + '" y2="' + ly.toFixed(2) + '" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke"></line>';
    // time axis along the bottom
    var tax = '', want = Math.max(2, Math.floor(PW / (UI.cfull ? 90 : 66))), every = Math.max(1, Math.ceil(N / want)), prevT = null;
    for (var q = a; q < b; q++) {
      if (q % every) continue;
      var tx = (q - a) * step + step / 2; if (tx < 16 || tx > PW - 16) continue;
      body += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="0" y2="' + PH + '" stroke="var(--line)" stroke-width="1" stroke-opacity=".55" vector-effect="non-scaling-stroke"></line>';
      tax += '<span class="tt mono" style="left:' + (tx / W * 100).toFixed(2) + '%">' + esc(timeTick(s.t[q], iv, prevT)) + '</span>'; prevT = s.t[q];
    }
    var marked = UI.cSel != null && UI.cSel >= a && UI.cSel < b, sel = marked ? UI.cSel : b - 1, markP = null, curPill = '', timePill = '';
    if (marked) {
      var sx = (sel - a) * step + step / 2;
      body += '<line x1="' + sx.toFixed(2) + '" x2="' + sx.toFixed(2) + '" y1="0" y2="' + H + '" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></line>';
      markP = UI.cSelP != null && UI.cSelP >= lo && UI.cSelP <= hi ? UI.cSelP : s.c[sel];
      var my = y(markP);
      body += '<line x1="0" x2="' + PW + '" y1="' + my.toFixed(2) + '" y2="' + my.toFixed(2) + '" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></line><circle cx="' + sx.toFixed(2) + '" cy="' + my.toFixed(2) + '" r="3" fill="var(--fg)"></circle>';
      curPill = '<span class="cax cur mono" style="top:' + Math.max(0, Math.min(PH - 16, my - 8)).toFixed(0) + 'px;width:' + AX + 'px">' + fmtP(markP) + '</span>';
      timePill = '<span class="tpill mono" style="left:' + clamp(sx / W * 100, 9, 100 * PW / W - 9).toFixed(2) + '%">' + esc(candleLabel(s.t[sel], iv)) + '</span>';
    }
    var chg = s.c[sel] - s.o[sel];
    var selSig = SGN && SGN.marks[sel] ? '<div class="sigline">' + SGN.marks[sel].map(function (g) { var R = window.ConvergeSignals.BY_ID[g.id]; return '<span><b class="lbl ' + (g.side === 'buy' ? 'lbuy' : 'lsell') + '">' + (g.side === 'buy' ? 'BUY' : 'SELL') + '</b> ' + esc(R.name) + ' (L' + R.lesson + ')</span>'; }).join('') + '</div>' : '';
    var readout = '<div class="ohlc mono">' + (marked ? '<span class="selmark">' + esc(candleLabel(s.t[sel], iv)) + ' · ' + fmtP(markP) + '<button class="lnk" data-act="csel-clear" aria-label="Clear the marker">✕</button></span>' : '<span>' + esc(candleLabel(s.t[sel], iv)) + '</span>') + '<span>O ' + fmtP(s.o[sel]) + '</span><span>H ' + fmtP(s.h[sel]) + '</span><span>L ' + fmtP(s.l[sel]) + '</span><span class="' + (chg >= 0 ? 'up' : 'down') + '">C ' + fmtP(s.c[sel]) + '</span><span>Vol ' + bigNum(s.v[sel]) + '</span></div>';
    var srcLbl = r.live ? 'Live' : r.hist ? 'Daily history' + (DIR.through ? ' through ' + DIR.through : '') : 'Snapshot ' + (CD ? ago(CD.generatedAt) : '');
    var strip = '';
    if (SGN && !UI.cfull) { var bt = SGN.bt; strip = '<button class="btstrip" data-act="bt-jump"><span>Backtest · ' + esc(iv) + '</span><b class="mono ' + cls(bt.total) + '">' + pct(bt.total * 100, 1) + '</b><span class="muted">vs hold <span class="mono ' + cls(bt.hold) + '">' + pct(bt.hold * 100, 1) + '</span> · ' + bt.n + ' trades' + (bt.winRate != null ? ' · ' + Math.round(bt.winRate * 100) + '% win' : '') + '</span><span class="go">Results ↓</span></button>'; }
    return readout + selSig + '<div class="cwrap' + (UI.cfull ? ' full' : '') + '" id="cwrap" data-a="' + a + '" data-n="' + N + '" data-len="' + len + '" data-pr="' + (PW / W).toFixed(4) + '" data-hi="' + hi + '" data-lo="' + lo + '" data-ph="' + PH + '" data-w="' + W + '"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px" role="img" aria-label="' + esc(t) + ' ' + iv + ' candlestick chart with ' + nlab + ' signal labels">' + body + '</svg>' +
      axis + '<span class="cax last mono" style="top:' + Math.max(0, Math.min(PH - 16, ly - 8)).toFixed(0) + 'px;width:' + AX + 'px">' + fmtP(last) + '</span>' + curPill + '</div>' +
      '<div class="tax" style="margin-right:0">' + tax + timePill + '</div>' +
      '<div class="siglegend">' + (SGN ? '<b class="lbl lbuy">BUY</b><b class="lbl lsell">SELL</b><span class="muted">One BUY, then nothing until its SELL; one SELL, then nothing until the next BUY.</span>' : '') + '<span class="muted">Tap the chart to mark the time and price · pinch to zoom · ' + esc(srcLbl) + '</span></div>' + strip;
  }
  function civRow(iv) { return '<div class="civ">' + CINTERVALS.map(function (x) { return '<button data-act="civ" data-iv="' + x + '" aria-pressed="' + (iv === x) + '">' + x + '</button>'; }).join('') + '</div>'; }
  function ctools() {
    return '<div class="ctools"><button class="btn sm" data-act="czoom" data-z="out" aria-label="Zoom out">−</button><button class="btn sm" data-act="czoom" data-z="in" aria-label="Zoom in">+</button><button class="btn sm" data-act="cpan" data-p="back" aria-label="Earlier">◀</button><button class="btn sm" data-act="cpan" data-p="fwd" aria-label="Later">▶</button><button class="btn sm" data-act="cpan" data-p="end">Latest</button>' +
      '<button class="btn sm" data-act="csig" aria-pressed="' + (UI.csig !== false) + '">Signals ' + (UI.csig === false ? 'off' : 'on') + '</button>' +
      '<button class="btn sm" data-act="alert-open" data-t="' + esc(UI.chartT || '') + '" data-iv="' + esc(UI.civ || '1D') + '" aria-pressed="' + !!alertFor(UI.chartT, UI.civ || '1D') + '">' + (alertFor(UI.chartT, UI.civ || '1D') ? '🔔 Alert on' : '🔔 Alert') + '</button>' +
      (UI.cfull ? '' : '<button class="btn sm" data-act="cfull" aria-label="Full screen">⤢ Full screen</button>') + '</div>';
  }
  function candleCard(t) {
    if (!CD && !CDS.loading && !CDS.error) setTimeout(loadCandles, 0);
    var iv = UI.civ || '1D'; UI.chartT = t;
    if (UI.cfull) return civRow(iv) + '<p class="muted" style="font-size:13px;text-align:center;padding:24px 0">Chart is open in full screen.</p>';
    return civRow(iv) + '<div id="candlebox" data-t="' + esc(t) + '">' + candleSvg(t) + '</div>' + ctools();
  }
  function fullChartHtml() {
    var t = UI.chartT || S.sel, iv = UI.civ || '1D', land = isLand(), x = T(t), dr = dirRow(t);
    var price = x ? money(x.price) + ' <span class="' + cls(x.changePct) + '">' + arrowPct(x.changePct) + '</span>' : dr && dr.p ? money(dr.p) + (dr.ch != null ? ' <span class="' + cls(dr.ch) + '">' + arrowPct(dr.ch) + '</span>' : '') : '';
    return '<div class="cfull' + (land ? ' land' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(t) + ' chart, full screen"><div class="cfull-h"><div style="min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><b class="disp" style="font-size:18px">' + esc(t) + '</b> <span class="muted mono" style="font-size:12px">' + esc(iv) + '</span> <span class="mono" style="font-size:13px;margin-left:6px">' + price + '</span></div><button class="iconbtn" data-act="cfull-close" aria-label="Close full screen">' + ic('x', 22) + '</button></div>' +
      '<div class="cfull-body"><div class="cfull-chart">' + civRow(iv) + '<div id="candlebox" data-t="' + esc(t) + '">' + candleSvg(t) + '</div>' + ctools() + '</div>' +
      '<aside class="cfull-bt" id="btfull" data-t="' + esc(t) + '">' + backtestInner(t, true) + '</aside></div></div>';
  }
  function refreshCandleBox() {
    var box = document.getElementById('candlebox'); if (box) { box.innerHTML = candleSvg(box.dataset.t); bindCandles(); }
    var bb = document.getElementById('btbox'); if (bb) bb.innerHTML = backtestInner(bb.dataset.t);
    var bf = document.getElementById('btfull'); if (bf) bf.innerHTML = backtestInner(bf.dataset.t, true);
  }
  function btFor(t) { var iv = UI.civ || '1D', r = candleSeries(t, iv); var g = r.s && signalsFor(t, iv, r.s, r.live); return g ? g.bt : null; }
  function backtestInner(t, compact) {
    var SG = window.ConvergeSignals, iv = UI.civ || '1D', r = candleSeries(t, iv), s = r.s;
    var head = '<div class="sechead"><h2 class="eyebrow">Signal backtest · ' + esc(t) + ' · <span style="text-transform:none">' + esc(iv) + '</span></h2></div>';
    if (!SG || !s || s.t.length < 30) return head + '<p class="muted" style="margin:0;font-size:13px;line-height:1.5">' + (!s ? emptyChartMsg(t, iv) : 'Not enough ' + esc(iv) + ' candles to test.') + '</p>';
    var g = signalsFor(t, iv, s, r.live), bt = g.bt, intra = !!SG.INTRADAY[iv];
    var stat = function (label, val, c) { return '<div class="bts"><span class="muted">' + label + '</span><b class="mono ' + (c || '') + '">' + val + '</b></div>'; };
    var h = head + '<p class="muted" style="margin:-4px 0 10px;font-size:12px">' + bt.bars + ' candles · ' + esc(candleLabel(s.t[0], iv)) + ' to ' + esc(candleLabel(s.t[s.t.length - 1], iv)) + (r.live ? ' · live' : '') + '</p>' +
      '<div class="btgrid">' + stat('Strategy return', pct(bt.total * 100, 1), cls(bt.total)) + stat('Buy &amp; hold', pct(bt.hold * 100, 1), cls(bt.hold)) +
      stat('Trades', bt.n + (bt.open ? ' + 1 open' : '')) + stat('Win rate', bt.winRate == null ? '—' : Math.round(bt.winRate * 100) + '%') +
      stat('Avg trade', bt.avg == null ? '—' : pct(bt.avg * 100, 2), cls(bt.avg)) + stat('Profit factor', bt.pf == null ? '—' : bt.pf === Infinity ? '∞' : bt.pf.toFixed(2)) +
      stat('Max drawdown', pct(bt.mdd * 100, 1), bt.mdd < 0 ? 'down' : '') + stat('Avg hold', bt.avgBars == null ? '—' : bt.avgBars.toFixed(1) + ' bars') + '</div>';
    if (bt.curve.length > 2) h += '<div style="margin-top:10px">' + lineChart(bt.curve, { h: 70, label: 'Strategy equity curve', color: bt.total >= 0 ? 'var(--bull)' : 'var(--bear)' }) + '</div>';
    if (bt.open) { var R0 = SG.BY_ID[bt.open.why]; h += '<p class="note" style="margin:10px 0 0">Open trade: bought ' + esc(candleLabel(s.t[bt.open.in], iv)) + ' at ' + fmtP(bt.open.entry) + ' on a ' + esc(R0.name) + ' signal · ' + pct(bt.open.ret * 100, 2) + (bt.open.stop ? ' · trailing stop ' + fmtP(bt.open.stop) : '') + '</p>'; }
    // per-rule table
    h += '<h3 class="eyebrow" style="margin:14px 0 6px">By signal · ' + bt.fwd + '-bar follow-through</h3><div class="bttbl"><div class="btr bth"><span>Signal</span><span>Count</span><span>Right</span><span>Avg move</span></div>' + SG.RULES.map(function (R) {
      var p = bt.per[R.id], na = (R.intraday && !intra) || (R.orb && !(intra && SG.INTRADAY[iv] <= 5));
      var right = p && p.done ? Math.round(p.hits / p.done * 100) + '%' : '—', mv = p && p.done ? pct(p.sum / p.done * 100, 2) : '—';
      if (R.id === 'atr') { right = '—'; mv = '—'; }
      return '<button class="btr" data-act="sig-info" data-id="' + R.id + '"><span><b class="lbl ' + (R.side === 'buy' ? 'lbuy' : 'lsell') + '">' + (R.side === 'buy' ? 'BUY' : 'SELL') + '</b> ' + esc(R.name) + ' <em class="muted">L' + R.lesson + '</em></span><span class="mono">' + (na ? '<em class="muted">n/a</em>' : p ? p.n : 0) + '</span><span class="mono">' + right + '</span><span class="mono ' + (p && p.done ? cls(p.sum) : '') + '">' + mv + '</span></button>' +
        (UI.sigInfo === R.id ? '<p class="prule" style="margin:0 0 6px">' + esc(R.rule) + (na ? ' Not used on ' + esc(iv) + ' candles.' : '') + '</p>' : '');
    }).join('') + '</div>';
    if (bt.trades.length) h += '<h3 class="eyebrow" style="margin:14px 0 6px">Last trades</h3>' + bt.trades.slice(-5).reverse().map(function (tr) {
      return '<div class="bttr"><span><b class="lbl lbuy">BUY</b> ' + esc(candleLabel(s.t[tr.in], iv)) + ' · ' + esc(SG.BY_ID[tr.why].name) + '<br><b class="lbl ' + ('lsell') + '">' + ('SELL') + '</b> <span class="muted">' + esc(candleLabel(s.t[tr.out], iv)) + ' · ' + esc(SG.BY_ID[tr.exitWhy].name) + '</span></span><b class="mono ' + cls(tr.ret) + '">' + pct(tr.ret * 100, 2) + '</b></div>';
    }).join('');
    if (!compact) h += '<div style="margin-top:10px">' + civRow(iv) + '</div>';
    h += '<p class="foot" style="text-align:left;margin:8px 0 0">Long only, on the ' + esc(iv) + ' candles shown above. Buys at the next candle’s open after any buy signal; sells at the next open after any sell signal, or when the 3× ATR trailing stop is hit. Includes 0.05% per side for costs and slippage' + (intra ? '; intraday trades can be held overnight' : '') + '. “Right” = price moved the signal’s way ' + bt.fwd + ' candles later. Rules from the Master Trader Manual, lessons 6–20. Past results don’t predict future returns; small samples are noisy. Not investment advice.</p>';
    return h;
  }
  function bindCandles() {
    var box = document.getElementById('candlebox'); if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    var x0 = null, off0 = 0, moved = false, pts = {}, pinch = null, pinched = false;
    function geo() { var el = document.getElementById('cwrap'); if (!el) return null; var rc = el.getBoundingClientRect(); return { a: +el.dataset.a, n: +el.dataset.n, len: +el.dataset.len, left: rc.left, width: rc.width * (+el.dataset.pr || 1), top: rc.top, bottom: rc.bottom, hi: +el.dataset.hi, lo: +el.dataset.lo, ph: +el.dataset.ph }; }
    function zoomTo(g, newN, frac) {
      var len = g.len, n = clamp(Math.round(newN), Math.min(15, len), Math.min(len, 600));
      var center = g.a + frac * g.n, na = clamp(Math.round(center - frac * n), 0, len - n);
      if (n === (UI.cN || g.n) && len - n - na === UI.cOff) return;
      UI.cN = n; UI.cOff = len - n - na; UI.cSel = null; box.innerHTML = candleSvg(box.dataset.t);
    }
    function ids() { return Object.keys(pts); }
    box.addEventListener('pointerdown', function (e) {
      var g = geo(); if (!g || e.clientY < g.top - 30 || e.clientY > g.bottom + 30) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; try { box.setPointerCapture(e.pointerId); } catch (er) { }
      var k = ids();
      if (k.length === 2) { var p1 = pts[k[0]], p2 = pts[k[1]]; pinch = { d0: Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y)), g: g, n0: g.n, frac: clamp(((p1.x + p2.x) / 2 - g.left) / g.width, 0, 1) }; pinched = true; x0 = null; return; }
      if (k.length === 1) { pinched = false; x0 = e.clientX; off0 = UI.cOff || 0; moved = false; }
    });
    box.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) { var k = ids(); if (k.length < 2) return; var p1 = pts[k[0]], p2 = pts[k[1]], d = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y)); var g0 = pinch.g; zoomTo({ a: g0.a, n: pinch.n0, len: g0.len }, pinch.n0 * pinch.d0 / d, pinch.frac); e.preventDefault(); return; }
      if (x0 == null) return; var g = geo(); if (!g) return;
      var dx = e.clientX - x0, per = g.width / g.n;
      if (Math.abs(dx) > 6) moved = true;
      if (moved) { var no = Math.max(0, off0 + Math.round(dx / per)); if (no !== UI.cOff) { UI.cOff = no; UI.cSel = null; box.innerHTML = candleSvg(box.dataset.t); } }
    });
    function up(e) { delete pts[e.pointerId]; if (ids().length < 2) pinch = null; if (!ids().length) x0 = null; }
    box.addEventListener('pointerup', function (e) { if (x0 != null && !moved && !pinched) { var g = geo(); if (g && e.clientY >= g.top && e.clientY <= g.bottom && e.clientX <= g.left + g.width) { var ry = e.clientY - g.top; UI.cSel = g.a + clamp(Math.floor((e.clientX - g.left) / g.width * g.n), 0, g.n - 1); UI.cSelP = ry <= g.ph ? g.hi - ry / g.ph * (g.hi - g.lo) : null; box.innerHTML = candleSvg(box.dataset.t); } } x0 = null; up(e); });
    box.addEventListener('pointercancel', function (e) { x0 = null; up(e); });
    box.addEventListener('wheel', function (e) {
      if (!UI.cfull && !e.ctrlKey) return; // page scroll stays normal; trackpad pinch (ctrl+wheel) or full screen zooms
      var g = geo(); if (!g) return; e.preventDefault();
      zoomTo(g, g.n * Math.pow(1.0018, e.deltaY), clamp((e.clientX - g.left) / g.width, 0, 1));
    }, { passive: false });
    box.addEventListener('gesturestart', function (e) { e.preventDefault(); });
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
  function deviceName() {
    var plat = window.__CONVERGE_ARTIFACT__ ? 'Claude page' : isNative && Cap.getPlatform ? (Cap.getPlatform() === 'ios' ? 'iOS app' : Cap.getPlatform() === 'android' ? 'Android app' : 'App') : 'Web';
    var w = Math.min(window.screen && window.screen.width || window.innerWidth, window.innerWidth);
    return plat + ' · ' + (w < 600 ? 'phone' : w < 1100 ? 'tablet' : 'computer');
  }
  // Two ways to sync: the Converge account (Supabase) in the apps and on the website, or, in the Converge page on
  // claude.ai, the viewer's own private record that follows their Claude login.
  var ADB = { ready: false, ref: null, unsub: null };
  function initPageSync() {
    if (!window.__CONVERGE_ARTIFACT__ || !window.claude || typeof window.claude.use !== 'function') return;
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (x) {
      var db = x[0], user = x[1]; if (!db || !user) return null;
      return user.id().then(function (id) {
        if (!id) return;
        PF.db = db; PF.user = user; PF.me = id;
        user.isOwner().then(function (o) { PF.owner = !!o; });
        if (user.can) user.can('data.write').then(function (w) { PF.canWrite = w; if (document.getElementById('forumbox')) refreshForum(document.getElementById('forumbox').dataset.t); });
        if (document.getElementById('forumbox')) { var ft = document.getElementById('forumbox').dataset.t; refreshForumCard(ft); }
        ADB.ref = db.doc('data/users/' + id + '/state'); ADB.ready = true;
        syncNow('boot').then(function () {
          // live: another device saved -> merge it in (only writes back if this device has something newer)
          ADB.unsub = ADB.ref.onSnapshot(function (snap) { if (snap && !snap.metadata.hasPendingWrites && snap.exists) { var d = snap.data(); if (d && d.savedBy !== SY.myTag) setTimeout(function () { syncNow('remote'); }, 30); } }, function () { });
        });
        if (current().name === 'settings') render();
      });
    }).catch(function () { });
  }
  SY.myTag = Math.random().toString(36).slice(2, 10);
  function syncMode() { return accountsReady() && S.auth ? 'account' : ADB.ready ? 'page' : null; }
  function syncNow(why) {
    var Y = window.ConvergeSync, mode = syncMode();
    if (!Y || !mode) return Promise.resolve(null);
    if (SY.busy) { SY.again = true; return SY.p; }
    SY.busy = true; SY.status = 'syncing'; refreshSyncUi();
    var pull, push;
    if (mode === 'page') {
      pull = function () { return ADB.ref.get().then(function (snap) { var d = snap.exists ? snap.data() : null; SY.remoteDevice = d && d.device; SY.remoteAt = d && d.savedAt; try { return d && d.json ? JSON.parse(d.json) : null; } catch (e) { return null; } }); };
      push = function (doc) { var at = new Date().toISOString(); return ADB.ref.set({ json: JSON.stringify(doc), device: deviceName(), savedAt: at, savedBy: SY.myTag }).then(function () { SY.remoteDevice = deviceName(); SY.remoteAt = at; }); };
    } else {
      var uid = null;
      pull = function () {
        return ensureSession().then(function (sess) {
          if (!sess) throw new Error('Your session expired. Please sign in again.');
          uid = sess.user.id;
          if (why !== 'change' && why !== 'poll') sb('/auth/v1/user', { auth: true }).then(function (u) { if (!u || !S.auth) return; var nm = u.user_metadata && u.user_metadata.display_name; var ch = (nm && nm !== S.auth.name) || (u.email && u.email !== S.auth.user.email); if (nm) S.auth.name = nm; if (u.email) S.auth.user.email = u.email; if (ch) { persist(); render(); } }).catch(function () { });
          return sb('/rest/v1/user_state?select=data,updated_at,device&user_id=eq.' + encodeURIComponent(uid), { auth: true }).then(function (rows) { var row = rows && rows[0]; SY.remoteDevice = row && row.device; SY.remoteAt = row && row.updated_at; return row && row.data && row.data.keys ? row.data : null; });
        });
      };
      push = function (doc) { return sb('/rest/v1/user_state?on_conflict=user_id', { method: 'POST', auth: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: uid, data: doc, device: deviceName(), updated_at: new Date().toISOString() } }).then(function () { SY.remoteDevice = deviceName(); SY.remoteAt = new Date().toISOString(); }); };
    }
    SY.p = pull().then(function (remote) {
      var local = Y.exportDoc(S, S._sync), merged = Y.merge(local, remote), changed = !Y.same(merged, local);
      if (changed) applyMerged(merged);
      if (remote && Y.same(merged, remote)) return changed;
      return push(merged).then(function () { return changed; });
    }).then(function (changed) {
      SY.status = 'synced'; SY.at = Date.now(); SY.err = null; SY.mode = mode;
      if (changed && D) { if (!S.sel || !T(S.sel)) S.sel = firstTicker(); render(); }
      return changed;
    }).catch(function (e) {
      var m = (e && (e.message || e.code)) || 'try again';
      SY.status = 'error'; SY.err = /user_state|relation|schema cache/i.test(m) ? 'The account database isn’t set up for sync yet (run supabase/schema.sql).' : m;
    }).then(function (x) {
      SY.busy = false; refreshSyncUi();
      if (SY.again) { SY.again = false; setTimeout(function () { syncNow('again'); }, 50); }
      return x;
    });
    return SY.p;
  }
  function applyMerged(merged) {
    var Y = window.ConvergeSync;
    SY.applying = true; Y.applyDoc(S, S._sync, merged); SYNCSNAP = Y.snapshot(S); persist(); SY.applying = false;
    UI.civ = (S.prefs && S.prefs.civ) || UI.civ; if (S.prefs && S.prefs.csig === false) UI.csig = false;
  }
  function syncLine() {
    var mode = syncMode();
    if (!mode) return window.__CONVERGE_ARTIFACT__ ? 'Connecting to your Claude account… (sign in to Claude to sync this page)' : accountsReady() ? 'Not signed in: everything stays on this device.' : 'Accounts aren’t connected yet: everything stays on this device. Use Copy / Import below to move data.';
    if (SY.status === 'syncing') return 'Syncing…';
    if (SY.status === 'error') return 'Couldn’t sync: ' + esc(SY.err || 'try again');
    if (SY.at) return 'Synced ' + esc(ago(new Date(SY.at).toISOString())) + (mode === 'page' ? ' through your Claude account' : '') + (SY.remoteDevice ? ' · last saved from ' + esc(SY.remoteDevice) : '');
    return 'Waiting to sync…';
  }
  function refreshSyncUi() { var el = document.getElementById('syncstat'); if (el) { el.innerHTML = syncLine(); el.className = 'syncstat ' + SY.status; } }
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
    var n = normText(text), sq = n.replace(/(.)\1+/g, '$1'), pn = ' ' + n + ' ', joined = sq.replace(/ /g, '');
    // stretched spellings ("fuuuck"): only words that actually repeat a letter are squeezed, so "but" never matches "butt"
    var ps = ' ' + n.split(' ').filter(function (w) { return /(.)\1/.test(w); }).map(function (w) { return w.replace(/(.)\1+/g, '$1'); }).join(' ') + ' ';
    if (/(fuck|fuk|shit|bitch|nigg|whore|motherf|cocksuck|dickhead|asshole|bastard|retard)/.test(joined)) return true;
    return badList().some(function (w) { return pn.indexOf(' ' + w.n + ' ') >= 0 || (w.sq.indexOf(' ') < 0 && ps.indexOf(' ' + w.sq + ' ') >= 0) || (w.sq.length >= 5 && w.sq.indexOf(' ') < 0 && joined.indexOf(w.sq) >= 0); });
  }
  var PF = { db: null, user: null, me: null, owner: false, canWrite: null, subs: {}, order: [], names: {}, sent: [] };
  function boardMode() { return forumReady() ? 'account' : PF.db && PF.me ? 'page' : null; }
  function refreshForumCard(t) { var box = document.getElementById('forumbox'); if (box) box.outerHTML = forumCard(t); }
  function pageSubscribe(t) {
    if (PF.subs[t] || !PF.db) return;
    // keep a few live boards (the platform allows 64 subscriptions per view)
    PF.order.push(t); while (PF.order.length > 4) { var old = PF.order.shift(); try { PF.subs[old](); } catch (e) { } delete PF.subs[old]; }
    FORUM.loading[t] = true;
    PF.subs[t] = PF.db.collection('forum/' + t + '/posts').orderBy('at', 'desc').limit(80).onSnapshot(function (snap) {
      var rows = snap.docs.map(function (d) { var x = d.data() || {}; return { id: d.id, user_id: x.uid, body: x.body, created_at: x.at }; }).filter(function (p) { return p.body && p.created_at; });
      FORUM.posts[t] = rows; FORUM.loading[t] = false; FORUM.error[t] = null;
      var ids = rows.map(function (p) { return p.user_id; }).filter(function (id, i, a) { return id && a.indexOf(id) === i && PF.names[id] === undefined; });
      if (ids.length && PF.user && PF.user.profiles) PF.user.profiles(ids).then(function (ps) { ids.forEach(function (id) { PF.names[id] = (ps[id] && ps[id].name) || ''; }); refreshForum(t); });
      refreshForum(t);
    }, function (e) { FORUM.loading[t] = false; FORUM.error[t] = 'Couldn’t load the discussion (' + ((e && e.code) || 'error') + ').'; refreshForum(t); });
  }
  function forumCard(t) {
    if (boardMode() === 'page') {
      setTimeout(function () { pageSubscribe(t); }, 0);
      return '<section class="card" id="forumbox" data-t="' + esc(t) + '">' + forumInner(t) + '</section>';
    }
    if (!forumReady()) {
      var msg = window.__CONVERGE_ARTIFACT__ ? 'Connecting to the discussion… If this stays, sign in to Claude to read and post.' : 'The discussion board isn’t connected yet. The owner needs to add the Supabase settings described in the README.';
      return '<section class="card"><h2 class="eyebrow" style="margin-bottom:6px">Discussion · ' + esc(t) + '</h2>' + (isPremium() ? '' : '<button class="upsell" data-act="subscribe" data-why="forum" style="margin-bottom:8px">' + ic('bolt', 16) + '<span>Want to comment? Posting is for Premium members. <b>Subscribe to Premium</b></span></button>') + '<p class="muted" style="margin:0;font-size:13px;line-height:1.5">' + msg + '</p></section>';
    }
    if (FORUM.posts[t] === undefined && !FORUM.loading[t]) setTimeout(function () { loadPosts(t); }, 0);
    return '<section class="card" id="forumbox" data-t="' + esc(t) + '">' + forumInner(t) + '</section>';
  }
  function forumInner(t) {
    if (boardMode() === 'page') return pageForumInner(t);
    var h = '<div class="sechead"><h2 class="eyebrow">Discussion · ' + esc(t) + '</h2><button class="lnk" data-act="forum-refresh" data-t="' + esc(t) + '" style="color:var(--muted)">Refresh</button></div>';
    if (S.auth && !isPremium()) {
      h += '<button class="upsell" data-act="subscribe" data-why="forum">' + ic('bolt', 16) + '<span>Want to join the conversation? Commenting is for Premium members. <b>Subscribe to Premium</b></span></button>';
    } else if (!S.auth) {
      h += '<button class="upsell" data-act="subscribe" data-why="forum">' + ic('bolt', 16) + '<span>Want to comment? Posting is for Premium members. <b>Subscribe to Premium</b></span></button>' + (accountsReady() ? '<button class="btn sm" data-act="forum-auth" style="width:100%;margin-top:8px">Already Premium? Sign in</button>' : '');
    } else {
      h += '<div class="field"><label for="forum-text">Post as <b>' + esc(S.auth.name || 'you') + '</b></label><textarea class="in" id="forum-text" rows="3" maxlength="1000" placeholder="Share your take on ' + esc(t) + '. Keep it civil.">' + esc(FORUM.draft) + '</textarea></div>' +
        '<div class="btnrow" style="margin-top:8px"><button class="btn sm" data-act="forum-signout">Sign out</button><button class="btn sm pri" data-act="forum-post" data-t="' + esc(t) + '"' + (FORUM.busy ? ' disabled' : '') + '>' + (FORUM.busy ? 'Posting…' : 'Post') + '</button></div>';
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
  function pageForumInner(t) {
    var posts = FORUM.posts[t], h = '<div class="sechead"><h2 class="eyebrow">Discussion · ' + esc(t) + '</h2><span class="muted" style="font-size:11px">' + (posts ? posts.length + ' post' + (posts.length === 1 ? '' : 's') : '') + '</span></div>';
    if (PF.canWrite === false) h += '<p class="note" style="margin:0 0 8px">You can read this discussion. Posting is open to people the owner has invited to this page.</p>';
    else h += '<div class="field"><label for="forum-text">Post as <b>you</b> <span class="opt">(your Claude name is shown)</span></label><textarea class="in" id="forum-text" rows="3" maxlength="1000" placeholder="Share your take on ' + esc(t) + '. Keep it civil.">' + esc(FORUM.draft) + '</textarea></div>' +
      '<div class="btnrow" style="margin-top:8px"><button class="btn sm pri" data-act="pforum-post" data-t="' + esc(t) + '"' + (FORUM.busy ? ' disabled' : '') + '>' + (FORUM.busy ? 'Posting…' : 'Post') + '</button></div>';
    if (FORUM.error[t]) h += '<p class="note" style="margin:10px 0 0">' + esc(FORUM.error[t]) + '</p>';
    if (!posts) h += '<p class="muted" style="margin:12px 0 0;font-size:13px">Loading…</p>';
    else if (!posts.length) h += '<p class="muted" style="margin:12px 0 0;font-size:13px">No comments yet. Start the conversation.</p>';
    else h += '<div class="posts">' + posts.map(function (p) {
      var mine = p.user_id === PF.me, nm = mine ? 'You' : (PF.names[p.user_id] || 'Member');
      return '<article class="post"><div class="post-h"><b>' + esc(nm) + '</b><span class="muted">' + esc(ago(p.created_at)) + '</span>' + (mine || PF.owner ? '<button class="lnk" data-act="pforum-del" data-id="' + esc(p.id) + '" data-t="' + esc(t) + '" style="color:var(--muted);padding:0;margin-left:auto">Delete</button>' : '') + '</div><p>' + esc(p.body) + '</p></article>';
    }).join('') + '</div>';
    h += '<p class="foot" style="text-align:left;margin:10px 0 0">Live for everyone viewing this page. Posts with offensive language are blocked. Not investment advice.</p>';
    return h;
  }
  function authSheet() {
    var m = FORUM.mode, f = FORUM.form;
    return '<h2 class="disp" style="margin:0 0 4px;font-size:22px">' + (m === 'signup' ? 'Create your account' : 'Sign in') + '</h2><p class="muted" style="margin:0 0 12px;font-size:13px">One account keeps your lots, theses, watchlist and settings in sync on every device, and lets you join the discussions.</p>' +
      '<div class="scroll" style="padding-top:0">' + (m === 'signup' ? '<div class="field"><label for="au-name">Display name</label><input class="in" id="au-name" data-au="name" maxlength="30" autocomplete="nickname" value="' + esc(f.name) + '"></div>' : '') +
      '<div class="field"><label for="au-email">Email</label><input class="in" id="au-email" data-au="email" type="email" autocomplete="email" value="' + esc(f.email) + '"></div>' +
      '<div class="field"><label for="au-pass">Password</label><input class="in" id="au-pass" data-au="password" type="password" autocomplete="' + (m === 'signup' ? 'new-password' : 'current-password') + '" value="' + esc(f.password) + '"></div>' +
      (FORUM.authMsg ? '<p class="note" style="margin:4px 0 0">' + esc(FORUM.authMsg) + '</p>' : '') + '</div>' +
      '<button class="btn pri" data-act="forum-auth-go" style="margin-top:12px"' + (FORUM.busy ? ' disabled' : '') + '>' + (FORUM.busy ? 'Please wait…' : m === 'signup' ? 'Create account' : 'Sign in') + '</button>' +
      '<button class="btn sm" data-act="forum-auth-mode" style="margin-top:8px;border:0;color:var(--accent)">' + (m === 'signup' ? 'I already have an account' : 'New here? Create an account') + '</button>' +
      (m === 'signup' ? '' : '<button class="btn sm" data-act="acct-forgot" style="margin-top:2px;border:0;color:var(--muted)">Forgot password?</button>');
  }
  var FA = {
    'pforum-post': function (el) {
      var t = el.dataset.t, body = (FORUM.draft || '').trim();
      if (!body) return toast('Write something first');
      if (body.length > 1000) { FORUM.error[t] = 'Keep posts under 1,000 characters.'; return refreshForum(t); }
      if (isProfane(body)) { FORUM.error[t] = 'Your post contains language that isn’t allowed here. Please rephrase it.'; return refreshForum(t); }
      var now = Date.now(); PF.sent = PF.sent.filter(function (x) { return now - x < 60000; });
      if (PF.sent.length >= 5) { FORUM.error[t] = 'You are posting too fast. Please wait a minute.'; return refreshForum(t); }
      FORUM.busy = true; FORUM.error[t] = null; refreshForum(t);
      PF.db.collection('forum/' + t + '/posts').add({ uid: PF.me, body: body, at: new Date().toISOString(), t: t }).then(function () { PF.sent.push(Date.now()); FORUM.draft = ''; FORUM.busy = false; refreshForum(t); toast('Posted'); })
        .catch(function (e) { FORUM.busy = false; var c = e && e.code; FORUM.error[t] = c === 'not_granted' || c === 'invalid_argument' ? 'Posting is open to people the owner has invited to this page.' : c === 'quota_exceeded' ? 'The discussion is full right now. Older posts need to be cleared first.' : 'Couldn’t post (' + (c || 'error') + '). Try again.'; if (c === 'not_granted') PF.canWrite = false; refreshForum(t); });
    },
    'pforum-del': function (el) { var t = el.dataset.t; PF.db.doc('forum/' + t + '/posts/' + el.dataset.id).delete().then(function () { toast('Post deleted'); }).catch(function (e) { toast('Couldn’t delete (' + ((e && e.code) || 'error') + ')'); }); },
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
        UI.sheet = null; render(); fetchTier();
        var before = S.lots.length;
        syncNow('signin').then(function () { var n = S.lots.length; toast(SY.status === 'synced' ? 'Signed in · ' + n + ' lot' + (n === 1 ? '' : 's') + ' synced' + (n !== before ? ' (' + (n - before >= 0 ? '+' : '') + (n - before) + ' from your account)' : '') : 'Signed in as ' + (S.auth.name || email)); });
      }).catch(function (e) { FORUM.busy = false; FORUM.authMsg = /invalid login/i.test(e.message) ? 'Wrong email or password.' : e.message; render(); });
    },
    'forum-signout': function () { var tok = S.auth; clearTimeout(SY.timer); (tok ? syncNow('signout') : Promise.resolve()).then(function () { S.auth = null; SY.status = 'idle'; SY.at = null; persist(); if (tok) sb('/auth/v1/logout', { method: 'POST', auth: false }).catch(function () { }); toast('Signed out. Your data stays on this device and in your account.'); render(); }); },
    'forum-post': function (el) {
      var t = el.dataset.t, body = (FORUM.draft || '').trim();
      if (!body) return toast('Write something first');
      if (isProfane(body)) { FORUM.error[t] = 'Your post contains language that isn’t allowed here. Please rephrase it.'; return refreshForum(t); }
      FORUM.busy = true; FORUM.error[t] = null; refreshForum(t);
      ensureSession().then(function (sess) {
        if (sess && !isPremium()) { FORUM.busy = false; UI.sheet = { kind: 'subscribe', why: 'forum' }; render(); return; }
        if (!sess) { FORUM.busy = false; FORUM.error[t] = 'Your session expired. Please sign in again.'; render(); return; }
        return sb('/rest/v1/forum_posts', { method: 'POST', auth: true, prefer: 'return=representation', body: { ticker: t, body: body, display_name: sess.name || 'Investor' } })
          .then(function (rows) { FORUM.draft = ''; FORUM.busy = false; FORUM.posts[t] = (rows || []).concat(FORUM.posts[t] || []); refreshForum(t); toast('Posted'); });
      }).catch(function (e) { FORUM.busy = false; if (/premium/i.test(e.message)) { if (S.auth) S.auth.tier = 'free'; save(); UI.sheet = { kind: 'subscribe', why: 'forum' }; render(); return; } FORUM.error[t] = /civil|blocked|language/i.test(e.message) ? 'Your post contains language that isn’t allowed here. Please rephrase it.' : e.message; refreshForum(t); });
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
    var st = scanState(), on = isPremium() ? (st.presets || {}) : {}, preds = [];
    PRESETS.forEach(function (p) { if (!on[p.id]) return; p.crit.forEach(function (c) { if (c[1] && !(c[2] && !SC.fundamentals)) preds.push(c[1]); }); });
    return preds;
  }
  function presetsCard() {
    var st = scanState(), prem = isPremium(), on = prem ? (st.presets || {}) : {}, open = UI.presetOpen;
    return '<section class="card" style="padding:12px"><div class="sechead" style="margin:2px 2px 8px"><h2 class="eyebrow">Strategy scanners</h2><span class="badge-prem">' + (prem ? 'PREMIUM' : 'PREMIUM · LOCKED') + '</span></div>' + (prem ? '' : '<button class="upsell" data-act="subscribe" data-why="preset">' + ic('bolt', 16) + '<span>Subscribe to Premium to switch on the 5 strategy scanners. You can still read each one’s criteria.</span></button>') + PRESETS.map(function (p) {
      var active = !!on[p.id];
      var rows = active || open === p.id ? '<div class="pdet">' + p.crit.map(function (c) {
        var avail = !!c[1], fundOff = c[2] && !SC.fundamentals;
        return '<div class="pcrit"><span class="' + (!avail || fundOff ? 'dim' : 'up') + '">' + (!avail || fundOff ? '○' : '●') + '</span><span>' + esc(c[0]) + (!avail ? ' <em class="dim">· not in free data, skipped</em>' : fundOff ? ' <em class="dim">· needs SEC data, skipped</em>' : '') + '</span></div>';
      }).join('') + '<p class="prule"><b>Rules:</b> ' + esc(p.rules) + '</p><p class="prule muted">' + esc(p.note) + '</p></div>' : '';
      return '<div class="preset' + (active ? ' on' : '') + '"><button class="rowtoggle" data-act="preset" data-id="' + p.id + '" aria-pressed="' + active + '" style="border:0;background:none;padding:6px 2px;min-height:48px"><span><span class="t1">' + esc(p.name) + '</span><span class="t2">' + esc(p.horizon) + '</span></span><span class="sw' + (prem ? '' : ' locked') + '"></span></button>' +
        '<button class="lnk pmore" data-act="preset-info" data-id="' + p.id + '">' + (active || open === p.id ? 'Criteria' : 'Criteria ▾') + '</button>' + rows + '</div>';
    }).join('') + '</section>';
  }

  // ------------------------------------------------------------------ live quotes (every minute while open)
  var LQ = { q: null, at: null, minute: null, busy: false, fails: 0 };
  function minuteKey(ms) { return new Date(ms).toISOString().slice(0, 16).replace(/[-:T]/g, ''); }
  function loadQuotes() {
    if (LQ.busy) return;
    if (window.__CONVERGE_ARTIFACT__ && !isNative && LQ.fails > 2) return; // this page can't reach the internet
    LQ.busy = true;
    var now = Date.now(), keys = [1, 2, 3, 4, 6, 9, 14].map(function (m) { return minuteKey(now - m * 60000); });
    // small "hot" file every minute (S&P 500, popular ETFs, indexes); the full file every 10 minutes or when a stock you follow isn't in it
    var need = myTickers().concat(UI.chartT ? [UI.chartT] : []), missing = LQ.hot && need.some(function (t) { return !LQ.hot[t]; });
    var full = !LQ.fullAt || now - LQ.fullAt > 10 * 60000 || missing, dir = full ? 'q/' : 'h/';
    (function next(i) {
      if (i >= keys.length || (LQ.minute && keys[i] <= LQ.minute && !full)) { LQ.busy = false; if (i >= keys.length) LQ.fails++; return; }
      fetchJson(CFG.quotes + dir + keys[i] + '.json', 9000).then(function (d) { if (!d || !d.q) throw new Error('bad'); if (full) LQ.fullAt = now; else LQ.hot = d.q; applyQuotes(d); LQ.busy = false; LQ.fails = 0; })
        .catch(function () { next(i + 1); });
    })(0);
  }
  function applyQuotes(d) {
    // merge (the hot file has only part of the market)
    LQ.q = LQ.q || {}; Object.keys(d.q).forEach(function (t) { var o = LQ.q[t], n = d.q[t]; if (o && o[2] && n[2] && n[2] < o[2]) return; LQ.q[t] = n; }); if (d.hot) LQ.hot = d.q;
    LQ.at = d.at; LQ.minute = d.minute;
    if (D && D.tickers) Object.keys(D.tickers).forEach(function (t) {
      var q = d.q[t] && LQ.q[t], x = D.tickers[t]; if (!q || !num(q[0])) return;
      x.price = q[0]; if (num(q[1])) { x.changePct = q[1]; x.prevClose = q[0] / (1 + q[1] / 100); }
    });
    checkSignalAlerts();
    softRender();
  }
  function nativeLive() {
    if (!isNative) return;
    var list = myTickers().concat(UI.chartT ? [UI.chartT] : []).filter(function (t, i, a) { return t && a.indexOf(t) === i; }).slice(0, 60); if (!list.length) return;
    var chunks = []; for (var k = 0; k < list.length; k += 20) chunks.push(list.slice(k, k + 20));
    chunks.forEach(function (ch) {
      fetchJson('https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + ch.map(function (t) { return encodeURIComponent(ysym(t)); }).join(',') + '&range=1d&interval=1d', 9000).then(function (j) {
        var q = {}; ((j && j.spark && j.spark.result) || []).forEach(function (r) { var m = r.response && r.response[0] && r.response[0].meta; if (!m || m.regularMarketPrice == null) return; var t = ch.filter(function (x) { return ysym(x) === r.symbol; })[0] || r.symbol, pc = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose; q[t] = [m.regularMarketPrice, pc ? (m.regularMarketPrice / pc - 1) * 100 : null, m.regularMarketTime || 0]; });
        if (Object.keys(q).length) applyQuotes({ q: q, at: new Date().toISOString(), minute: LQ.minute });
      }).catch(function () { });
    });
  }
  function softRender() {
    var a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; // don't disturb typing
    if (UI.sheet || UI.cfull) { var lb = document.getElementById('livestamp'); if (lb) lb.textContent = liveStamp(); return; }
    render();
  }
  function liveStamp() { return LQ.at ? 'Prices ' + ago(LQ.at) + ' · updates every minute' : ''; }

  // ------------------------------------------------------------------ market pulse (today's mood from 5-minute bars, refreshed every 5 minutes)
  var PULSE = { d: null, src: null, at: 0, loading: false };
  var PULSE_IDX = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX'];
  var PULSE_SEC = { XLK: 'Technology', XLF: 'Financials', XLV: 'Health Care', XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLE: 'Energy', XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate', XLC: 'Communication Services' };
  function validPulse(p) { return p && p.kind === 'pulse' && p.index && p.index.SPY && p.index.SPY.c && p.index.SPY.c.length; }
  function pulseLive() {
    // phones: straight from Yahoo (native HTTP has no CORS limits)
    function one(sym) {
      return fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1d&interval=5m&includePrePost=false', 9000).then(function (j) {
        var r = j && j.chart && j.chart.result && j.chart.result[0], o = parseYahoo(j); if (!r || !o) throw new Error('empty');
        o.prevClose = r.meta && (r.meta.chartPreviousClose != null ? r.meta.chartPreviousClose : r.meta.previousClose);
        o.price = r.meta && r.meta.regularMarketPrice != null ? r.meta.regularMarketPrice : o.c[o.c.length - 1];
        o.time = (r.meta && r.meta.regularMarketTime) || o.t[o.t.length - 1];
        return o;
      });
    }
    var out = { kind: 'pulse', generatedAt: new Date().toISOString(), source: 'Yahoo Finance (5-minute bars, live)', index: {}, sectors: {} };
    var jobs = PULSE_IDX.map(function (s) { return one(s).then(function (o) { out.index[s] = o; }).catch(function () { }); })
      .concat(Object.keys(PULSE_SEC).map(function (s) { return one(s).then(function (o) { out.sectors[s] = { name: PULSE_SEC[s], prevClose: o.prevClose, price: o.price, c: o.c }; }).catch(function () { }); }));
    return Promise.all(jobs).then(function () { if (!validPulse(out)) throw new Error('no SPY'); return out; });
  }
  // the live-quotes job writes p/<YYYYMMDDHHmm>.json every 5 minutes; a new name each time skips GitHub's 5-minute file cache
  function pulseFeed() {
    var now = Date.now(), slot = Math.floor(now / 300000) * 300000, keys = [0, 1, 2, 3, 4, 6].map(function (k) { return minuteKey(slot - k * 300000); });
    var have = PULSE.d && PULSE.src === 'feed' ? minuteKey(Date.parse(PULSE.d.generatedAt) - 60000) : '';
    return new Promise(function (res, rej) {
      (function next(i) {
        if (i >= keys.length || keys[i] < have) return fetchJson(CFG.pulse + '?t=' + Math.floor(Date.now() / 60000)).then(function (d) { if (!validPulse(d)) throw new Error('bad'); res(d); }).catch(rej);
        fetchJson(CFG.quotes + 'p/' + keys[i] + '.json', 9000).then(function (d) { if (!validPulse(d)) throw new Error('bad'); res(d); }).catch(function () { next(i + 1); });
      })(0);
    });
  }
  function loadPulse() {
    if (PULSE.loading) return;
    PULSE.loading = true;
    var snap = window.__CONVERGE_PULSE__;
    var p = isNative ? pulseLive().then(function (d) { return { d: d, src: 'live' }; })
        : pulseFeed().then(function (d) { return { d: d, src: 'feed' }; });
    p.catch(function () { if (validPulse(snap)) return { d: snap, src: 'snapshot' }; throw new Error('none'); })
      .then(function (r) { if (!PULSE.d || Date.parse(r.d.generatedAt) >= Date.parse(PULSE.d.generatedAt)) { PULSE.d = r.d; PULSE.src = r.src; } PULSE.at = Date.now(); })
      .catch(function () { })
      .then(function () { PULSE.loading = false; refreshPulse(); });
  }
  function refreshPulse() { var box = document.getElementById('pulsebox'); if (box) box.outerHTML = pulseCard(); else if (D && NAV.tab === 'command' && !NAV.stack.length) render(); }
  function chg(o) { return o && num(o.price) && num(o.prevClose) && o.prevClose ? (o.price / o.prevClose - 1) * 100 : null; }
  function vwap(o) { var pv = 0, v = 0; for (var i = 0; i < o.c.length; i++) { var tp = (o.h[i] + o.l[i] + o.c[i]) / 3; pv += tp * (o.v[i] || 0); v += o.v[i] || 0; } return v ? pv / v : null; }
  function computePulse(P) {
    if (!validPulse(P)) return null;
    var spy = P.index.SPY, parts = [];
    function add(key, label, w, score, detail) { if (num(score)) parts.push({ key: key, label: label, w: w, s: clamp(score, 0, 100), detail: detail }); }
    var c = chg(spy); add('chg', 'S&P 500 vs. yesterday’s close', 30, num(c) ? 50 + c * 25 : null, num(c) ? pct(c, 2) : '—');
    var vs = []; ['SPY', 'QQQ'].forEach(function (s) { var o = P.index[s]; if (o && o.c && o.c.length) { var vw = vwap(o); if (vw) vs.push({ s: s, d: (o.c[o.c.length - 1] / vw - 1) * 100 }); } });
    if (vs.length) { var avg = vs.reduce(function (a, b) { return a + b.d; }, 0) / vs.length; add('vwap', 'Price vs. VWAP (SPY, QQQ)', 20, 50 + avg * 50, vs.map(function (x) { return x.s + ' ' + pct(x.d, 2); }).join(' · ')); }
    if (spy.c.length >= 2) { var k = Math.max(0, spy.c.length - 7), m = (spy.c[spy.c.length - 1] / spy.c[k] - 1) * 100; add('mom', 'Last 30 minutes', 20, 50 + m * 100, pct(m, 2)); }
    var up = 0, tot = 0; ['SPY', 'QQQ', 'DIA', 'IWM'].forEach(function (s) { var x = chg(P.index[s]); if (num(x)) { tot++; if (x > 0) up++; } });
    Object.keys(P.sectors || {}).forEach(function (s) { var x = chg(P.sectors[s]); if (num(x)) { tot++; if (x > 0) up++; } });
    if (tot) add('breadth', 'Breadth (indexes + 11 sectors up)', 20, up / tot * 100, up + ' of ' + tot + ' up');
    var vx = chg(P.index['^VIX']); add('vix', 'Volatility (VIX)', 10, num(vx) ? 50 - vx * 5 : null, num(vx) ? 'VIX ' + (P.index['^VIX'].price || 0).toFixed(2) + ' (' + pct(vx, 1) + ')' : '—');
    var W = parts.reduce(function (a, p) { return a + p.w; }, 0); if (!W) return null;
    var score = Math.round(parts.reduce(function (a, p) { return a + p.s * p.w; }, 0) / W);
    var secs = Object.keys(P.sectors || {}).map(function (s) { return { s: s, name: P.sectors[s].name, ch: chg(P.sectors[s]) }; }).filter(function (x) { return num(x.ch); }).sort(function (a, b) { return b.ch - a.ch; });
    var last = spy.time || spy.t[spy.t.length - 1], live = Date.now() / 1000 - last < 20 * 60;
    return { score: score, mood: score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral', parts: parts, spy: spy, spyChg: c, secs: secs, last: last, live: live };
  }
  function pulseSpark(o) {
    var w = 330, h = 56, v = o.c, base = num(o.prevClose) ? o.prevClose : v[0];
    var lo = Math.min.apply(null, v.concat([base])), hi = Math.max.apply(null, v.concat([base])), rg = hi - lo || 1;
    var n = Math.max(v.length - 1, 77); // a full session is 78 five-minute bars
    var y = function (x) { return (h - 4 - (x - lo) / rg * (h - 8)).toFixed(1); };
    var d = v.map(function (x, i) { return (i ? 'L' : 'M') + (i / n * w).toFixed(1) + ' ' + y(x); }).join(' ');
    var col = v[v.length - 1] >= base ? 'var(--bull)' : 'var(--bear)';
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="S&amp;P 500 (SPY) today, 5-minute chart" style="height:' + h + 'px"><line x1="0" x2="' + w + '" y1="' + y(base) + '" y2="' + y(base) + '" stroke="var(--muted)" stroke-dasharray="3 4" stroke-width="1" vector-effect="non-scaling-stroke"></line><path d="' + d + '" stroke="' + col + '" stroke-width="2" fill="none" vector-effect="non-scaling-stroke" stroke-linejoin="round"></path></svg>';
  }
  function pulseCard() {
    var R = PULSE.d && computePulse(PULSE.d);
    if (!R) return '<section class="card pulse-card" id="pulsebox"><h2 class="eyebrow">Market sentiment today</h2><p class="muted" style="margin:6px 0 0;font-size:13px">' + (PULSE.loading || !PULSE.at ? 'Loading the 5-minute market data…' : 'Market data isn’t available right now. Retrying every 5 minutes.') + '</p></section>';
    var tone = R.mood === 'Bullish' ? 'bull' : R.mood === 'Bearish' ? 'bear' : 'neu';
    var when = new Date(R.last * 1000).toLocaleString('en-US', { weekday: R.live ? undefined : 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    var open = UI.pulseOpen;
    var h = '<section class="card pulse-card ' + tone + '" id="pulsebox"><button class="pulse-head" data-act="pulse-open" aria-expanded="' + !!open + '">' +
      '<span><span class="eyebrow">Market sentiment today</span><span class="pulse-mood">' + R.mood + ' <span class="mono">' + R.score + '</span><span class="muted" style="font-size:12px;font-weight:400">/100</span></span></span>' +
      '<span style="text-align:right"><span class="mono" style="display:block;font-size:13px">S&amp;P 500 <span class="' + cls(R.spyChg) + '">' + arrowPct(R.spyChg) + '</span></span><span class="muted" style="font-size:11px">' + (R.live ? '<i class="live-dot"></i>Live · ' : 'Closed · ') + esc(when) + ' ET</span></span></button>' +
      '<div class="pulse-meter" aria-hidden="true"><i style="left:' + R.score + '%"></i></div>' +
      '<div style="margin-top:8px">' + pulseSpark(R.spy) + '</div>';
    if (open) {
      h += '<div class="pulse-parts">' + R.parts.map(function (p) { return '<div class="pp"><span>' + esc(p.label) + '<br><span class="muted mono" style="font-size:11px">' + esc(p.detail) + '</span></span><span class="mono ' + (p.s >= 60 ? 'up' : p.s <= 40 ? 'down' : 'neu') + '">' + Math.round(p.s) + '</span></div>'; }).join('') + '</div>';
      if (R.secs.length) h += '<div class="pulse-secs">' + R.secs.map(function (s) { return '<span class="' + cls(s.ch) + '" title="' + esc(s.name) + '">' + esc(s.s) + ' ' + pct(s.ch, 1) + '</span>'; }).join('') + '</div>';
      h += '<p class="foot" style="text-align:left;margin:8px 0 0">Score: 30% S&amp;P 500 change, 20% price vs. VWAP, 20% last-30-minute momentum, 20% breadth, 10% VIX. 60+ is bullish, 40 or less bearish. Source: ' + esc(PULSE.d.source || 'Yahoo Finance') + (PULSE.src === 'snapshot' ? ' (copy built into this page)' : '') + '.</p>';
    }
    h += '<p class="foot" style="text-align:left;margin:6px 0 0">Updated ' + esc(ago(PULSE.d.generatedAt)) + ' · refreshes every 5 min' + (open ? '' : ' · tap for details') + '</p></section>';
    return h;
  }

  // ------------------------------------------------------------------ membership tiers (free / premium)
  function accountsReady() { return forumReady(); }
  function premiumRequired() { return FCONF.premiumRequired === true || FCONF.premiumRequired === 'true'; }
  function isPremium() {
    if (!premiumRequired()) return true; // testing: every account gets every feature (set PREMIUM_REQUIRED=true to switch the paywall on)
    if (!accountsReady()) return S.demoTier === 'premium'; // no account system in this copy: labeled preview switch in Settings
    var a = S.auth; if (!a || a.tier !== 'premium') return false;
    return !a.premium_until || Date.parse(a.premium_until) > Date.now();
  }
  function fetchTier() {
    if (!accountsReady() || !S.auth) return Promise.resolve(null);
    return ensureSession().then(function (sess) {
      if (!sess) return null;
      return sb('/rest/v1/profiles?select=tier,premium_until&id=eq.' + encodeURIComponent(sess.user.id), { auth: true }).then(function (rows) {
        var r = rows && rows[0]; if (!S.auth) return null;
        S.auth.tier = (r && r.tier) || 'free'; S.auth.premium_until = (r && r.premium_until) || null; save(); render(); return S.auth.tier;
      });
    }).catch(function () { return null; });
  }
  function planName() { return isPremium() ? 'Premium' : 'Free'; }
  function subscribeSheet() {
    var price = FCONF.premiumPrice, url = safeUrl(FCONF.premiumUrl), why = UI.sheet.why;
    var h = '<h2 class="disp" style="margin:0 0 4px;font-size:22px">Converge Premium</h2><p class="muted" style="margin:0 0 12px;font-size:13px">' + (why === 'forum' ? 'Commenting in the stock discussions is a Premium feature.' : why === 'preset' ? 'Strategy scanners are a Premium feature.' : 'Unlock the tools active traders use most.') + '</p>' +
      '<div class="scroll" style="padding-top:0"><div class="plan-cmp"><div><b>Free</b><ul><li>Command Center, Signal Feed, Battleground, Vault</li><li>Market sentiment, candles, alerts, briefing</li><li>Full scanner with filters and signals</li><li>Read the stock discussions</li></ul></div>' +
      '<div class="prem"><b>Premium</b>' + (price ? '<span class="mono" style="float:right">' + esc(price) + '</span>' : '') + '<ul><li>Everything in Free</li><li>5 strategy scanners: scalping, short swing, medium swing, position/trend, multi-year value</li><li>Post in the discussion under every stock</li></ul></div></div></div>';
    if (accountsReady() && !S.auth) return h + '<p class="muted" style="font-size:13px;margin:12px 0 0">Create a free account or sign in first. Premium is added to your account.</p><button class="btn pri" data-act="forum-auth" style="margin-top:10px">Sign in or create an account</button>';
    if (url && accountsReady()) {
      var full = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(S.auth.user.id) + '&prefilled_email=' + encodeURIComponent(S.auth.user.email || '');
      return h + '<a class="btn pri" href="' + esc(full) + '" target="_blank" rel="noopener" style="margin-top:12px;text-decoration:none">Subscribe' + (price ? ' · ' + esc(price) : '') + '</a><button class="btn sm" data-act="tier-refresh" style="margin-top:8px;border:0;color:var(--accent)">I’ve subscribed: refresh my plan</button>';
    }
    return h + '<p class="note" style="margin:12px 0 0">Online checkout isn’t open yet. ' + (accountsReady() ? 'Ask the Converge team to upgrade your account, then tap Refresh.' : 'This copy of Converge has no account system, so you can preview Premium in Settings.') + '</p>' +
      (accountsReady() ? '<button class="btn sm" data-act="tier-refresh" style="margin-top:8px">Refresh my plan</button>' : '<button class="btn sm pri" data-act="settings" style="margin-top:8px">Open Settings</button>');
  }
  function authPut(body) { return ensureSession().then(function (sess) { if (!sess) throw new Error('Please sign in again.'); return sb('/auth/v1/user', { method: 'PUT', auth: true, body: body }); }); }
  function acctDone(m) { UI.acctMsg = m; render(); }
  function dataText() { var Y = window.ConvergeSync; return JSON.stringify({ app: 'Converge', kind: 'converge-data', exportedAt: new Date().toISOString(), data: Y ? Y.exportDoc(S, S._sync || {}) : null }); }
  function importText(txt) {
    var Y = window.ConvergeSync, j;
    try { j = JSON.parse(String(txt || '').trim()); } catch (e) { return { error: 'That doesn’t look like Converge data. Copy it again with Copy my data.' }; }
    var doc = j && j.data && j.data.keys ? j.data : j && j.keys ? j : null;
    if (!doc || !Array.isArray(doc.lots)) return { error: 'That doesn’t look like Converge data. Copy it again with Copy my data.' };
    var before = S.lots.length, local = Y.exportDoc(S, S._sync || {});
    // the pasted copy counts as the newer one for settings it changed; lots merge one by one
    var merged = Y.merge(local, doc);
    applyMerged(merged); schedulePush();
    return { added: S.lots.length - before, lots: S.lots.length };
  }
  window.__convergeImport = importText;
  var AA = {
    'alert-open': function (el) { UI.alertSide = null; UI.sheet = { kind: 'sigalert', t: el.dataset.t || UI.chartT, iv: el.dataset.iv || UI.civ || '1D' }; render(); },
    'alert-side': function (el) { UI.alertSide = el.dataset.v; render(); },
    'alert-save': function (el) {
      var t = el.dataset.t, iv = el.dataset.iv, side = UI.alertSide || ((alertFor(t, iv) || {}).side) || 'both';
      S.sigAlerts = (S.sigAlerts || []).filter(function (a) { return !(a.t === t && a.iv === iv); });
      var cur = latestMark(t, iv, side);
      S.sigAlerts.push({ id: uid(), t: t, iv: iv, side: side, created: Date.now(), last: cur ? cur.at : null });
      save(); UI.sheet = null; render();
      askNotify().then(function (ok) { toast(ok ? '🔔 Alert on: ' + t + ' ' + iv : '🔔 Alert on (shows inside Converge)'); });
    },
    'alert-del': function (el) { var t = el.dataset.t, iv = el.dataset.iv; S.sigAlerts = (S.sigAlerts || []).filter(function (a) { return !(a.t === t && a.iv === iv); }); save(); if (UI.sheet && UI.sheet.kind === 'sigalert') UI.sheet = null; render(); toast('Alert removed'); },
    'alert-perm': function () { askNotify().then(function (ok) { toast(ok ? 'Notifications allowed' : 'Notifications not allowed'); render(); }); },
    'data-copy': function () { UI.sheet = { kind: 'datacopy' }; render(); var ta = document.getElementById('datacopy'); if (ta) { ta.focus(); ta.select(); } },
    'data-copy-go': function () {
      var ta = document.getElementById('datacopy'), txt = dataText();
      var done = function () { toast('Copied. Paste it into Import data on your other device.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(function () { if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it'); } } });
      else if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it'); } }
    },
    'data-import': function () { UI.impText = ''; UI.impMsg = ''; UI.sheet = { kind: 'dataimport' }; render(); },
    'data-import-go': function () {
      var r = importText(UI.impText);
      if (r.error) { UI.impMsg = r.error; return render(); }
      UI.sheet = null; render(); toast('Imported · ' + r.lots + ' lot' + (r.lots === 1 ? '' : 's') + (r.added > 0 ? ' (' + r.added + ' new)' : '') + (syncMode() ? ', syncing to your other devices' : ''));
    },
    'acct-name': function () {
      var n = (UI.acct.name || '').trim();
      if (n.length < 2) return acctDone('Pick a display name of at least 2 characters.');
      if (isProfane(n)) return acctDone('Please choose a different display name.');
      authPut({ data: { display_name: n } }).then(function () { S.auth.name = n; persist(); UI.acct.name = ''; acctDone('Display name saved.'); }).catch(function (e) { acctDone(e.message); });
    },
    'acct-email': function () {
      var e1 = (UI.acct.email || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e1)) return acctDone('Enter a valid email address.');
      if (e1 === S.auth.user.email) return acctDone('That’s already your email.');
      authPut({ email: e1 }).then(function () { UI.acct.email = ''; acctDone('Check your inbox (and your current one) to confirm the change. Your email updates after you confirm.'); }).catch(function (e) { acctDone(e.message); });
    },
    'acct-pass': function () {
      var a = UI.acct.pw1 || '', b = UI.acct.pw2 || '';
      if (a.length < 8) return acctDone('Use a password of at least 8 characters.');
      if (a !== b) return acctDone('The two passwords don’t match.');
      authPut({ password: a }).then(function () { UI.acct.pw1 = UI.acct.pw2 = ''; acctDone('Password updated.'); }).catch(function (e) { acctDone(/reauth|recent/i.test(e.message) ? 'For security, sign out and back in, then change your password.' : e.message); });
    },
    'acct-forgot': function () {
      var em = (FORUM.form.email || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { FORUM.authMsg = 'Enter your email above, then tap “Forgot password?”.'; return render(); }
      sb('/auth/v1/recover', { method: 'POST', body: { email: em } }).then(function () { FORUM.authMsg = 'If that email has an account, a reset link is on its way. Open it on this device to set a new password.'; render(); }).catch(function (e) { FORUM.authMsg = e.message; render(); });
    },
    'acct-delete': function () {
      if (UI.acct.del !== 'DELETE') return;
      ensureSession().then(function (sess) { if (!sess) throw new Error('Please sign in again.'); return sb('/rest/v1/rpc/converge_delete_me', { method: 'POST', auth: true, body: {} }); })
        .then(function () { try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); })
        .catch(function (e) { acctDone('Couldn’t delete the account: ' + e.message); });
    },
    'sync-now': function () { syncNow('manual').then(function () { toast(SY.status === 'synced' ? 'Synced' : 'Couldn’t sync'); }); },
    'device-wipe': function () {
      var go2 = function () { try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); };
      syncNow('wipe').then(function () { if (S.auth) sb('/auth/v1/logout', { method: 'POST', auth: true }).catch(function () { }); setTimeout(go2, 300); });
    },
    'export-data': function () {
      var doc = { app: 'Converge', exportedAt: new Date().toISOString(), account: S.auth ? S.auth.user.email : null, data: window.ConvergeSync ? window.ConvergeSync.exportDoc(S, S._sync || {}) : { lots: S.lots } };
      var txt = JSON.stringify(doc, null, 2);
      try {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'converge-data-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
        if (isNative && navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Your data is copied to the clipboard'); });
      } catch (e) { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Your data is copied to the clipboard'); }); }
    }
  };
  var TA = {
    'pulse-open': function () { UI.pulseOpen = !UI.pulseOpen; refreshPulse(); },
    subscribe: function (el) { UI.sheet = { kind: 'subscribe', why: el && el.dataset.why }; render(); },
    'tier-refresh': function () { fetchTier().then(function (t) { toast(t ? 'Your plan: ' + planName() : 'Couldn’t check your plan. Try again.'); if (isPremium() && UI.sheet && UI.sheet.kind === 'subscribe') { UI.sheet = null; render(); } }); },
    'demo-tier': function () { S.demoTier = S.demoTier === 'premium' ? 'free' : 'premium'; save(); toast('Previewing the ' + planName() + ' plan'); render(); }
  };

  function extResults(q, covered, mode) {
    var seen = {}; covered.forEach(function (u) { seen[u.t] = 1; });
    if (!q) return '<p class="muted" style="font-size:12px;margin:10px 2px">' + (DIR.rows ? 'Type a ticker or company name to search all ' + DIR.rows.length.toLocaleString('en-US') + ' US stocks, ETFs and indexes (Nasdaq, NYSE, NYSE American).' : DIR.loading ? 'Loading US stocks, ETFs and indexes…' : esc(DIR.error || '')) + '</p>';
    if (!DIR.rows) return '<p class="muted" style="font-size:12px;margin:10px 2px">' + (DIR.loading ? 'Searching all US stocks, ETFs and indexes…' : esc(DIR.error || 'The full stock list isn’t available here.')) + '</p>';
    var hits = dirSearch(q, 40).filter(function (r) { return !seen[r[0]]; });
    if (!hits.length) return covered.length ? '' : '<p class="muted" style="font-size:13px;margin:10px 2px">No US stock, ETF or index matches “' + esc(q) + '”. OTC stocks aren’t included.</p>';
    return '<h3 class="eyebrow" style="margin:14px 2px 6px">All US stocks, ETFs &amp; indexes</h3>' + hits.map(function (r) {
      var inWl = mode === 'watch' && S.watchlist.indexOf(r[0]) >= 0;
      return '<button class="pickrow" data-act="' + (mode === 'watch' || mode === 'draft' ? 'picked' : 'picked-ext') + '" data-t="' + esc(r[0]) + '"' + (mode === 'watch' ? ' aria-pressed="' + inWl + '"' : '') + '><span class="tk">' + esc(r[0]) + '</span><span class="nm">' + esc(r[1]) + '<br><span class="muted" style="font-size:11px">' + (r[3] ? 'S&amp;P 500 · ' : '') + esc(r[2] === 'NASDAQ' ? 'Nasdaq' : r[2]) + (r[5] ? ' · ' + compact(r[5]).replace('$', '$') : '') + '</span></span><span class="mono ' + cls(r[7]) + '" style="font-size:12px">' + (r[7] != null ? arrowPct(r[7]) : '') + '</span>' + (mode === 'watch' ? '<span style="width:20px;color:var(--accent)">' + (inWl ? ic('check', 18) : '') + '</span>' : '') + '</button>';
    }).join('');
  }
  // ---- smart money: politicians' trades, hedge funds (13F), insider trades (Form 4)
  var SMART = {};
  function loadSmart(t) {
    if (SMART[t]) return;
    var emb = window.__CONVERGE_SMART__;
    if (emb && emb[t]) { SMART[t] = { d: emb[t] }; return; }
    if (window.__CONVERGE_ARTIFACT__ && !isNative) { SMART[t] = { none: true, page: true }; return; }
    SMART[t] = { loading: true };
    fetchJson(CFG.smart + 's/' + encodeURIComponent(t) + '.json?t=' + Math.floor(Date.now() / 3600000), 15000)
      .then(function (d) { SMART[t] = { d: d }; }).catch(function () { SMART[t] = { none: true }; })
      .then(function () { var b = document.getElementById('smartbox'); if (b && b.dataset.t === t) b.innerHTML = smartInner(t); });
  }
  function smartCards(t) { loadSmart(t); return '<div id="smartbox" data-t="' + esc(t) + '" class="smart">' + smartInner(t) + '</div>'; }
  function fdate(iso) { if (!iso) return '—'; var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function nfmt(x) { return num(x) ? x.toLocaleString('en-US') : '—'; }
  function moreBtn(key, n, shown) { return n > shown ? '<button class="lnk" data-act="smart-more" data-k="' + key + '">Show all ' + n + '</button>' : ''; }
  function smartInner(t) {
    var S0 = SMART[t] || {}, d = S0.d, open = UI.smartOpen || {};
    var head = function (k, title, sub) { return '<div class="sechead"><h2 class="eyebrow">' + title + '</h2>' + (sub ? '<span class="muted" style="font-size:11px">' + sub + '</span>' : '') + '</div>'; };
    if (S0.loading) return '<section class="card"><p class="muted" style="margin:0;font-size:13px">Loading politicians, hedge funds and insider trades…</p></section>';
    var none = '';
    if (!d) { d = { congress: [] }; none = '<p class="muted" style="margin:0 2px;font-size:12px;line-height:1.5">' + (S0.page ? 'This page carries politician, fund and insider data for the tracked tickers, the major indexes’ biggest stocks and popular names. ' + esc(t) + '’s is in the Converge app and website.' : 'No congressional trades, fund filings or insider trades on record for ' + esc(t) + ' yet. The data refreshes every 4 hours.') + '</p>'; }
    var h = '';
    // 1. politicians
    var C = d.congress || [], ck = t + ':c', nC = open[ck] ? C.length : 5, buys = C.filter(function (x) { return x.type === 'buy'; }).length;
    h += '<section class="card smartc">' + head('c', 'Politicians', C.length ? buys + ' buys · ' + (C.length - buys) + ' sells · 2 yrs' : '') +
      (C.length ? '<div class="srows">' + C.slice(0, nC).map(function (x) {
        var tag = (x.party || '?') + (x.state ? '-' + x.state + (x.ch === 'House' && x.district != null ? String(x.district).padStart(2, '0') : '') : '');
        return '<div class="srow"><div><b>' + esc(String(x.who || '').replace(/\b(Mr|Mrs|Ms|Dr|Hon)\.?(?=\s|$)/g, '').replace(/\s+/g, ' ').trim()) + '</b> <span class="ptag p' + esc(x.party || 'x') + '">' + esc(tag) + '</span><br><span class="muted">' + esc(x.ch) + (x.owner && x.owner !== 'Self' ? ' · ' + esc(x.owner) : '') + (x.option ? ' · option' : '') + ' · traded ' + esc(fdate(x.date)) + (x.filed ? ' · filed ' + esc(fdate(x.filed)) : '') + '</span></div><div class="scol"><b class="' + (x.type === 'buy' ? 'up' : 'down') + '">' + esc(x.type === 'buy' ? 'BUY' : x.type === 'exchange' ? 'EXCH' : 'SELL') + '</b><br><span class="muted mono">' + esc(x.amount || '') + '</span>' + (safeUrl(x.url) ? '<br><a class="lnk" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">Filing ↗</a>' : '') + '</div></div>';
      }).join('') + '</div>' + moreBtn(ck, C.length, nC) : '<p class="muted" style="margin:0;font-size:13px">No member of Congress disclosed a trade in ' + esc(t) + ' in the last 2 years.</p>') +
      '<p class="foot" style="text-align:left;margin:8px 0 0">STOCK Act Periodic Transaction Reports from the House Clerk and Senate eFD. Amounts are the ranges members must report; filings can come up to 45 days after the trade.</p></section>';
    var hC = h; h = '';
    // 2. hedge funds
    var F = d.funds, fk = t + ':f';
    h += '<section class="card smartc">' + head('f', 'Hedge funds &amp; institutions', F && F.instPct != null ? F.instPct + '% held by institutions' : '');
    if (!F) h += '<p class="muted" style="margin:0;font-size:13px">No 13F filings available for ' + esc(t) + '.</p>';
    else {
      h += '<div class="kv smallkv"><div><div class="k">Holders</div><div class="v">' + nfmt(F.holders) + '</div></div><div><div class="k">Increased</div><div class="v up">' + nfmt(F.increased && F.increased[0]) + '</div></div><div><div class="k">Decreased</div><div class="v down">' + nfmt(F.decreased && F.decreased[0]) + '</div></div><div><div class="k">New</div><div class="v up">' + nfmt(F.newPos && F.newPos[0]) + '</div></div><div><div class="k">Sold out</div><div class="v down">' + nfmt(F.soldOut && F.soldOut[0]) + '</div></div></div>';
      var HF = F.hedge || [], nH = open[fk] ? HF.length : 5;
      var frow = function (x) { return '<div class="srow"><div><b>' + esc(x.who) + '</b><br><span class="muted">' + nfmt(x.shares) + ' shares · as of ' + esc(fdate(x.date)) + '</span></div><div class="scol"><b class="mono ' + cls(x.chg) + '">' + (x.chg > 0 ? '+' : '') + nfmt(x.chg) + '</b><br><span class="muted mono">' + (num(x.chgPct) ? pct(x.chgPct, 1) : '') + (num(x.value) ? ' · ' + compact(x.value * 1000) : '') + '</span></div></div>'; };
      h += '<h3 class="eyebrow" style="margin:12px 0 4px">Hedge funds</h3>' + (HF.length ? '<div class="srows">' + HF.slice(0, nH).map(frow).join('') + '</div>' + moreBtn(fk, HF.length, nH) : '<p class="muted" style="margin:0;font-size:13px">No well-known hedge funds among the ' + nfmt(F.scanned) + ' largest holders.</p>');
      if ((F.buyers || []).length) h += '<h3 class="eyebrow" style="margin:12px 0 4px">Biggest buyers last quarter</h3><div class="srows">' + F.buyers.slice(0, 3).map(frow).join('') + '</div>';
      if ((F.sellers || []).length) h += '<h3 class="eyebrow" style="margin:12px 0 4px">Biggest sellers last quarter</h3><div class="srows">' + F.sellers.slice(0, 3).map(frow).join('') + '</div>';
    }
    h += '<p class="foot" style="text-align:left;margin:8px 0 0">13F holdings via Nasdaq. Funds report 45 days after each quarter ends; hedge funds are matched by name from a list of well-known managers.</p></section>';
    var hF = h; h = '';
    // 3. insiders
    var I = d.insider, ik = t + ':i', showSells = !!open[t + ':is'], isBuy0 = function (x) { return /buy|purchase/i.test(x.type || ''); };
    if (I && open[t + ':is'] === undefined) showSells = !((I.buyTrades && I.buyTrades.length) || (I.trades || []).some(isBuy0)); // nothing bought recently: show every trade
    h += '<section class="card smartc">' + head('i', 'Insider trades', I && I.buys ? I.buys[0] + ' buys in 3 mo · ' + I.buys[1] + ' in 12 mo' : '');
    if (!I) h += '<p class="muted" style="margin:0;font-size:13px">No Form 4 insider filings available for ' + esc(t) + '.</p>';
    else {
      var all = I.trades || [], isBuy = function (x) { return /buy|purchase/i.test(x.type || ''); };
      var buysL = (I.buyTrades && I.buyTrades.length) ? I.buyTrades : all.filter(isBuy), list = showSells ? all : buysL, nI = open[ik] ? list.length : 5;
      h += '<div class="kv smallkv"><div><div class="k">Buys 12 mo</div><div class="v up">' + nfmt(I.buys && I.buys[1]) + '</div></div><div><div class="k">Sells 12 mo</div><div class="v down">' + nfmt(I.sells && I.sells[1]) + '</div></div><div><div class="k">Shares bought</div><div class="v">' + bigNum(I.sharesBought && I.sharesBought[1]) + '</div></div><div><div class="k">Shares sold</div><div class="v">' + bigNum(I.sharesSold && I.sharesSold[1]) + '</div></div></div>';
      h += '<div class="chips" style="margin:10px 0 2px"><button class="chip" data-act="smart-sells" data-v="0" data-t="' + esc(t) + '" aria-pressed="' + !showSells + '">Buys only</button><button class="chip" data-act="smart-sells" data-v="1" data-t="' + esc(t) + '" aria-pressed="' + showSells + '">All trades</button></div>';
      h += list.length ? '<div class="srows">' + list.slice(0, nI).map(function (x) {
        var buy = isBuy(x);
        return '<div class="srow"><div><b>' + esc(x.who) + '</b><br><span class="muted">' + esc(x.rel || '') + ' · ' + esc(fdate(x.date)) + (x.own ? ' · ' + esc(x.own) : '') + '</span></div><div class="scol"><b class="' + (buy ? 'up' : /sell/i.test(x.type || '') ? 'down' : '') + '">' + esc(x.type || '') + '</b><br><span class="muted mono">' + nfmt(x.shares) + (num(x.price) ? ' @ ' + money(x.price) : '') + '</span></div></div>';
      }).join('') + '</div>' + moreBtn(ik, list.length, nI) : '<p class="muted" style="margin:6px 0 0;font-size:13px">No open-market insider buys in the latest filings' + (all.length ? ' (' + all.length + ' other trades, mostly sales and option exercises).' : '.') + '</p>';
    }
    h += '<p class="foot" style="text-align:left;margin:8px 0 0">SEC Form 4 filings via Nasdaq. Insider buys with their own money are the stronger signal; many sales are planned (10b5-1) or for taxes.' + (d.nasdaqAt ? ' Updated ' + esc(ago(d.nasdaqAt)) + '.' : '') + '</p></section>';
    var hI = h;
    // three ownership columns; tap one for its detail
    var tab = (UI.ownTab && UI.ownTab[t]) || 'c', F2 = d.funds || {}, I2 = d.insider || {}, shOut = F2.shOut;
    var members = {}; C.forEach(function (x) { members[x.who] = (members[x.who] || 0) + (x.type === 'buy' ? 1 : -1); });
    var nMem = Object.keys(members).length, netBuyers = Object.keys(members).filter(function (k) { return members[k] > 0; }).length;
    var hfShares = (F2.hedge || []).reduce(function (a, x) { return a + (x.shares || 0); }, 0), hfUp = (F2.hedge || []).filter(function (x) { return x.chg > 0; }).length, hfDn = (F2.hedge || []).filter(function (x) { return x.chg < 0; }).length;
    var held = {}; (I2.trades || []).concat(I2.buyTrades || []).forEach(function (x) { if (x.who && num(x.held) && (!held[x.who] || (x.date || '') > held[x.who].date)) held[x.who] = { date: x.date || '', n: x.held }; });
    var insShares = Object.keys(held).reduce(function (a, k) { return a + held[k].n; }, 0);
    var pctOf = function (n) { return shOut && n ? (n / shOut * 100 < 0.01 ? '<0.01%' : (n / shOut * 100).toFixed(n / shOut * 100 < 1 ? 2 : 1) + '%') : null; };
    var col = function (k, title, big, bigLbl, lines, tone) { return '<button class="ocol' + (tab === k ? ' on' : '') + '" data-act="own-tab" data-t="' + esc(t) + '" data-k="' + k + '" aria-pressed="' + (tab === k) + '"><span class="ot">' + title + '</span><span class="ob ' + (tone || '') + '">' + big + '</span><span class="ol">' + bigLbl + '</span>' + lines.map(function (l) { return '<span class="ox">' + l + '</span>'; }).join('') + '</button>'; };
    var g = '<section class="card own"><div class="sechead" style="margin-bottom:8px"><h2 class="eyebrow">Who owns ' + esc(t) + '</h2><span class="muted" style="font-size:11px">Tap a column or tab</span></div><div class="own3">' +
      col('c', 'Politicians', String(nMem), nMem === 1 ? 'member traded' : 'members traded', [buys + ' buys · ' + (C.length - buys) + ' sells', nMem ? (netBuyers * 2 > nMem ? '<b class="up">Net buying</b>' : netBuyers * 2 < nMem ? '<b class="down">Net selling</b>' : 'Mixed') : '2 years'], '') +
      col('f', 'Hedge funds', pctOf(hfShares) || String((F2.hedge || []).length), pctOf(hfShares) ? 'of shares' : 'funds found', [(F2.hedge || []).length + ' funds · ' + (F2.instPct != null ? F2.instPct + '% inst.' : ''), (hfUp || hfDn) ? '<b class="up">' + hfUp + ' added</b> · <b class="down">' + hfDn + ' cut</b>' : 'No change data'], '') +
      col('i', 'Insiders', pctOf(insShares) || (I2.buys ? String(I2.buys[1]) : '—'), pctOf(insShares) ? 'held by filers' : 'buys in 12 mo', [I2.buys ? '<b class="up">' + I2.buys[1] + ' buys</b> · <b class="down">' + (I2.sells ? I2.sells[1] : 0) + ' sells</b>' : 'No filings', I2.buys ? '12 months' : ''], '') +
      '</div>' +
      '<div class="seg amber owntabs" role="tablist" aria-label="Ownership detail">' + [['c', 'Politicians', C.length], ['f', 'Hedge funds', (F2.hedge || []).length], ['i', 'Insider trades', (I2.trades || []).length || (I2.buyTrades || []).length]].map(function (x) {
        return '<button role="tab" data-act="own-tab" data-t="' + esc(t) + '" data-k="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + (x[2] ? ' <span class="tcount">' + x[2] + '</span>' : '') + '</button>';
      }).join('') + '</div>' + none + '</section>';
    return g + (tab === 'f' ? hF : tab === 'i' ? hI : hC) + '<p class="foot" style="text-align:left;margin:-4px 2px 0">' + (shOut ? 'Percentages use ' + bigNum(shOut) + ' shares outstanding. Hedge-fund share = well-known funds among the largest holders; insider share = latest holdings of insiders who filed recently.' : 'Ownership percentages appear after the next data refresh.') + '</p>';
  }

  // ---- quote page for any US-listed stock outside the tracked list
  function scrQuote(t) {
    if (!DIR.rows && !DIR.loading && !DIR.error) setTimeout(loadDir, 0);
    var dr = dirRow(t), sr = null;
    if (!dr && SC && SC.rows) for (var si = 0; si < SC.rows.length; si++) if (SC.rows[si].t === t) { sr = SC.rows[si]; break; }
    if (!dr) dr = sr ? { t: t, n: sr.n || '', ex: sr.ex || '', sp: (sr.idx || []).indexOf('S&P 500') >= 0, sec: sr.sec || '', mc: sr.mc, p: sr.p, ch: sr.ch } : { t: t, n: '', ex: '', sp: false, sec: '', mc: null, p: null, ch: null };
    var r1 = candleSeries(t, '1D').s, lastC = r1 && r1.c.length ? r1.c[r1.c.length - 1] : null, prevC = r1 && r1.c.length > 1 ? r1.c[r1.c.length - 2] : null;
    var price = dr.p != null ? dr.p : lastC, ch = dr.ch != null ? dr.ch : (lastC && prevC ? (lastC / prevC - 1) * 100 : null);
    var h = '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div style="min-width:0"><h1 class="disp" style="margin:0;font-size:24px;font-weight:700;line-height:1.15">' + esc(dr.n || t) + '</h1><div class="muted" style="font-size:12px;margin-top:2px">' + esc(t) + (dr.ex ? ' · ' + esc(dr.ex === 'NASDAQ' ? 'Nasdaq' : dr.ex) : '') + (dr.sp ? ' · S&amp;P 500' : '') + (dr.sec ? ' · ' + esc(dr.sec) : '') + (dr.mc ? ' · ' + compact(dr.mc) : '') + '</div></div>' +
      '<div style="text-align:right;flex:none"><div class="mono" style="font-size:22px">' + (price != null ? money(price) : '—') + '</div><div class="mono ' + cls(ch) + '" style="font-size:12px">' + (ch != null ? arrowPct(ch) : '') + '</div></div></div>';
    h += '<section class="card"><div class="sechead"><h2 class="eyebrow">Chart · buy &amp; sell signals</h2></div>' + candleCard(t) + '</section>';
    h += '<p class="note" style="margin:0">News, sentiment and quant grades cover the ' + D.universe.length + ' tracked tickers. Charts, signals, backtests, the discussion and the politicians, hedge funds and insiders panels work for every US stock.' + (dr.p != null && DIR.at ? ' Price as of ' + esc(ago(DIR.at)) + '.' : '') + '</p>';
    h += forumCard(t);
    h += smartCards(t);
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">More on ' + esc(t) + '</h2><div class="lnkrow">' + extLinks(t) + '</div></section>';
    h += '<section class="card" id="btbox" data-t="' + esc(t) + '">' + backtestInner(t) + '</section>';
    h += '<p class="foot">Free public sources, may be delayed. Not investment advice.</p>';
    return subBar(t) + '<main class="main" id="main">' + h + '</main>';
  }

  // ---- sheets (picker, pin)
  function sheetHtml() {
    var sh = UI.sheet; if (!sh) return '';
    var body = '';
    if (sh.kind === 'pick') {
      var q = UI.pickQuery.trim().toUpperCase();
      var list = D.universe.filter(function (u) { return !q || u.t.indexOf(q) >= 0 || (u.name || '').toUpperCase().indexOf(q) >= 0; });
      var multi = sh.mode === 'watch';
      body = '<h2 class="disp" style="margin:0 0 10px;font-size:20px">' + (multi ? 'Watchlist' : 'Choose a ticker') + '</h2><label class="sr" for="pickq">Search tickers</label><input class="in" id="pickq" data-pickq="1" placeholder="Search stocks, ETFs, indexes" value="' + esc(UI.pickQuery) + '" autocomplete="off">' +
        '<div class="scroll">' + list.map(function (u) {
          var on = multi ? S.watchlist.indexOf(u.t) >= 0 : false, y = T(u.t);
          return '<button class="pickrow" data-act="picked" data-t="' + u.t + '" aria-pressed="' + on + '"><span class="tk">' + u.t + '</span><span class="nm">' + esc(u.name || '') + '</span><span class="mono ' + cls(y && y.changePct) + '" style="font-size:12px">' + (y ? arrowPct(y.changePct) : '') + '</span>' + (multi ? '<span style="width:20px;color:var(--accent)">' + (on ? ic('check', 18) : '') + '</span>' : '') + '</button>';
        }).join('') + extResults(q, list, sh.mode) + '</div>' +
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
    if (sh.kind === 'subscribe') body = subscribeSheet();
    if (sh.kind === 'sigalert') body = alertSheet();
    if (sh.kind === 'datacopy') body = '<h2 class="disp" style="margin:0 0 4px;font-size:20px">Copy my data</h2><p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Copy this text, then on the other device open Account &amp; settings → Import data and paste it. Your lots, theses, watchlist and settings merge in; nothing there is deleted.</p><textarea class="in mono" id="datacopy" rows="9" readonly style="font-size:11px">' + esc(dataText()) + '</textarea><button class="btn pri" data-act="data-copy-go" style="margin-top:10px">Copy to clipboard</button>';
    if (sh.kind === 'dataimport') body = '<h2 class="disp" style="margin:0 0 4px;font-size:20px">Import data</h2><p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Paste the text from Copy my data on your other device. It’s merged with what’s here: matching lots keep their newest edit, new ones are added.</p><textarea class="in mono" id="dataimport" data-imp="1" rows="9" placeholder="Paste here" style="font-size:11px">' + esc(UI.impText || '') + '</textarea>' + (UI.impMsg ? '<p class="note" style="margin:8px 0 0">' + esc(UI.impMsg) + '</p>' : '') + '<button class="btn pri" data-act="data-import-go" style="margin-top:10px">Import</button>';
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
        case 'quote': body = scrQuote(c.t); break;
        default: body = scrCommand();
      }
      var showNav = !NAV.stack.length || ['lot', 'alert', 'source', 'wthesis', 'quote'].indexOf(c.name) >= 0;
      if (UI.cfull && c.name !== 'battle' && c.name !== 'quote') UI.cfull = false;
      html = body + (showNav ? navBar() : '') + (UI.cfull ? fullChartHtml() : '') + sheetHtml() + (UI.toast ? '<div class="toast" role="status">' + esc(UI.toast) + '</div>' : '');
    }
    root.innerHTML = '<div class="app">' + html + '</div>';
    var key = JSON.stringify(current());
    var main = document.getElementById('main');
    if (main) main.scrollTop = key === lastScreenKey ? keepScroll : 0;
    lastScreenKey = key;
    if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); try { if (selStart != null) f.setSelectionRange(selStart, selStart); } catch (e) { } } }
    bindSwipe();
    bindCandles();
    var cw = document.getElementById('cwrap'); if (cw && !UI.cfull && cw.clientWidth && Math.abs(cw.clientWidth - +cw.dataset.w) > 6 && !UI._fit) { UI._fit = true; refreshCandleBox(); UI._fit = false; }
  }
  function go(scr) { NAV.stack.push(scr); render(); }
  function back() {
    if (UI.cfull) { UI.cfull = false; render(); return true; }
    if (UI.sheet) { UI.sheet = null; render(); return true; }
    if (UI.reflect) { UI.reflect = null; render(); return true; }
    if (NAV.stack.length) { var top = NAV.stack.pop(); if (top.name === 'briefing') stopSpeech(); render(); return true; }
    if (NAV.tab !== 'command') { NAV.tab = 'command'; render(); return true; }
    return false;
  }
  var toastTimer;
  function toast(msg) { UI.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(function () { UI.toast = null; render(); }, 2600); }

  // ------------------------------------------------------------------ actions
  function snapFor(t) { var x = X(t); return x ? { price: x.price, quant: x.quant.score, bull: x.sentiment.bull, date: today() } : {}; }
  function readNum(s) { var n = parseFloat(String(s).replace(/[$,\s]/g, '')); return isFinite(n) ? n : null; }
  var A = {
    tab: function (el) { NAV.tab = el.dataset.tab; NAV.stack = []; UI.reflect = null; render(); },
    back: function () { back(); },
    signal: function () { S.signal = !S.signal; save(); render(); },
    toponly: function () { S.topOnly = !S.topOnly; save(); render(); },
    sel: function (el) { var t = el.dataset.t; if (!T(t)) { UI.cOff = 0; UI.cSel = null; go({ name: 'quote', t: t }); return; } S.sel = t; save(); render(); },
    range: function (el) { S.range = el.dataset.r; save(); render(); },
    brange: function (el) { UI.battleRange = el.dataset.r; render(); },
    side: function (el) { UI.side = el.dataset.side; render(); },
    feedf: function (el) { S.feedFilter = el.dataset.f; save(); render(); },
    vtab: function (el) { UI.vaultTab = el.dataset.v; render(); },
    settings: function () { UI.sheet = null; go({ name: 'settings' }); },
    battle: function (el) { UI.sheet = null; S.sel = el.dataset.t; if (el.dataset.side) UI.side = el.dataset.side; save(); NAV.tab = 'battle'; NAV.stack = []; render(); },
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
    pick: function (el) { UI.sheet = { kind: 'pick', mode: el.dataset.mode }; UI.pickQuery = ''; if (DIR.error && !DIR.rows) DIR.error = null; loadDir(); render(); },
    picked: function (el) {
      var t = el.dataset.t, mode = UI.sheet.mode;
      if (mode === 'watch') {
        var i = S.watchlist.indexOf(t);
        if (i >= 0) { S.watchlist.splice(i, 1); save(); render(); }
        else { S.watchlist.push(t); save(); render(); }
        return;
      }
      if (mode === 'draft') { var xd = X(t); UI.draft.t = t; UI.draft.price = xd ? String(xd.price) : ''; }
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
    sell: function (el) { var l = S.lots.filter(function (z) { return z.id === el.dataset.id; })[0]; var x = X(l.t); UI.reflect = { id: l.id, reason: null, price: x ? String(x.price) : String(l.price), date: today(), note: '' }; render(); },
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
    reset: function () {
      if (!UI.confirmReset) { UI.confirmReset = true; render(); return; }
      if (syncMode()) {
        S.lots = []; S.watchTheses = {}; S.watchlist = DEFAULT.watchlist.slice(); S.muted = []; S.scan = null; S.brief = { day: null, picked: [], skipped: [] }; S.seenAlerts = [];
        UI.confirmReset = false; save(); syncNow('erase').then(function () { toast('Erased on every device'); render(); }); return;
      }
      try { localStorage.removeItem(KEY); } catch (e) { } location.reload();
    },
    notify: function () {
      var LN = plugin('LocalNotifications'); if (!LN) return;
      if (S.notify) { S.notify = false; save(); render(); return; }
      LN.requestPermissions().then(function (r) { S.notify = r && r.display === 'granted'; save(); render(); if (!S.notify) toast('Notifications are off in system settings'); });
    },
    civ: function (el) { UI.civ = el.dataset.iv; UI.cOff = 0; UI.cSel = null; render(); },
    cmode: function (el) { UI.cmode = el.dataset.m; render(); },
    czoom: function (el) { var n = UI.cN || (UI.cfull ? 120 : 60); UI.cN = Math.max(15, Math.min(600, Math.round(el.dataset.z === 'in' ? n / 1.5 : n * 1.5))); UI.cSel = null; refreshCandleBox(); },
    csig: function () { UI.csig = UI.csig === false; S.prefs.csig = UI.csig !== false; save(); render(); },
    cfull: function () { UI.cfull = true; UI.cSel = null; render(); },
    'csel-clear': function () { UI.cSel = null; UI.cSelP = null; refreshCandleBox(); },
    'bt-jump': function () { var bb = document.getElementById('btbox'); if (bb) bb.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'picked-ext': function (el) { var t = el.dataset.t; UI.sheet = null; UI.cOff = 0; UI.cSel = null; if (T(t)) { S.sel = t; save(); NAV.tab = 'battle'; NAV.stack = []; render(); return; } go({ name: 'quote', t: t }); },
    'cfull-close': function () { UI.cfull = false; render(); },
    'sig-info': function (el) { UI.sigInfo = UI.sigInfo === el.dataset.id ? null : el.dataset.id; refreshCandleBox(); },
    cpan: function (el) { var n = UI.cN || 60; UI.cSel = null; if (el.dataset.p === 'end') UI.cOff = 0; else UI.cOff = Math.max(0, (UI.cOff || 0) + (el.dataset.p === 'back' ? Math.round(n / 2) : -Math.round(n / 2))); refreshCandleBox(); },
    preset: function (el) { if (!isPremium()) { UI.sheet = { kind: 'subscribe', why: 'preset' }; return render(); } var st = scanState(); st.presets = st.presets || {}; var was = !!st.presets[el.dataset.id]; st.presets = {}; st.presets[el.dataset.id] = !was; if (st.presets[el.dataset.id]) st.view = 'strategy'; UI.scanLimit = 100; save(); render(); },
    'preset-info': function (el) { UI.presetOpen = UI.presetOpen === el.dataset.id ? null : el.dataset.id; render(); },
    'scan-refresh': function () { SC = null; SCS.error = null; loadScanner(true); },
    'scan-toggle': function () { var st = scanState(); if (UI.scanCollapsed) { UI.scanCollapsed = false; st.open = true; } else st.open = !st.open; save(); render(); },
    'scan-group': function (el) { scanState().group = el.dataset.g; save(); render(); },
    'scan-view': function (el) { scanState().view = el.dataset.v; save(); render(); },
    'scan-sort': function (el) { var st = scanState(), k = el.dataset.k; if (st.sort.k === k) st.sort.dir *= -1; else st.sort = { k: k, dir: ['t', 'n', 'sec', 'ind', 'ctry'].indexOf(k) >= 0 ? 1 : -1 }; save(); render(); },
    'scan-row': function (el) { var st = scanState(); UI.scanCollapsed = true; if (st.open) { st.open = false; save(); } UI.sheet = { kind: 'scanrow', t: el.dataset.t }; render(); },
    'open-chart': function (el) {
      var t = el.dataset.t; UI.sheet = null; UI.cOff = 0; UI.cSel = null; UI.scanCollapsed = true;
      if (T(t)) { S.sel = t; save(); NAV.tab = 'battle'; NAV.stack = []; render(); return; }
      go({ name: 'quote', t: t });
    },
    'own-tab': function (el) { UI.ownTab = UI.ownTab || {}; UI.ownTab[el.dataset.t] = el.dataset.k; var b = document.getElementById('smartbox'); if (b) b.innerHTML = smartInner(b.dataset.t); },
    'smart-more': function (el) { UI.smartOpen = UI.smartOpen || {}; UI.smartOpen[el.dataset.k] = true; var b = document.getElementById('smartbox'); if (b) b.innerHTML = smartInner(b.dataset.t); },
    'smart-sells': function (el) { UI.smartOpen = UI.smartOpen || {}; var k = el.dataset.t + ':is'; UI.smartOpen[k] = el.dataset.v === '1'; var b = document.getElementById('smartbox'); if (b) b.innerHTML = smartInner(b.dataset.t); },
    'scan-edit': function () { var st = scanState(); UI.scanCollapsed = false; st.open = true; save(); render(); },
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
  Object.keys(TA).forEach(function (k) { A[k] = TA[k]; });
  Object.keys(AA).forEach(function (k) { A[k] = AA[k]; });
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
    if (el.dataset.imp) UI.impText = el.value;
    if (el.dataset.acct) { UI.acct[el.dataset.acct] = el.value; if (el.dataset.acct === 'del') { var bd = document.querySelector('[data-act="acct-delete"]'); if (bd) bd.disabled = el.value !== 'DELETE'; } }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.pref) {
      var k = el.dataset.pref, v = el.value;
      if (k === 'range') S.range = v; else if (k === 'civ') { S.prefs.civ = v; UI.civ = v; } else if (k === 'feed') S.feedFilter = v;
      save(); toast('Saved'); return;
    }
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
    if (LN0) LN0.addListener('localNotificationActionPerformed', function (ev) { var ex = ev && ev.notification && ev.notification.extra, t = ex && ex.t; if (t && D) { if (ex.sig) { if (T(t)) { S.sel = t; NAV.tab = 'battle'; NAV.stack = []; } else NAV.stack = [{ name: 'quote', t: t }]; } else NAV.stack = [{ name: 'alert', t: t }]; render(); } });
  }
  window.__convergeTest = { isProfane: isProfane, computePulse: computePulse, isPremium: isPremium, checkSignalAlerts: checkSignalAlerts, state: function () { return S; }, loadQuotes: loadQuotes };
  if (window.__CONVERGE_ARTIFACT__) document.documentElement.classList.add('in-artifact');

  render();
  loadData();
  setInterval(function () { if (document.visibilityState === 'visible') loadData(); }, 15 * 60000);
  var rsT, lastW = window.innerWidth; window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(function () { if (UI.cfull) render(); else if (Math.abs(window.innerWidth - lastW) > 8) { lastW = window.innerWidth; refreshCandleBox(); } }, 150); });
  loadQuotes(); setTimeout(nativeLive, 1500);
  setInterval(function () { if (document.visibilityState === 'visible') { loadQuotes(); nativeLive(); } }, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') loadQuotes(); });
  loadPulse();
  // check every minute; a new 5-minute reading is picked up as soon as it's published
  setInterval(function () { if (document.visibilityState !== 'visible') return; var g = PULSE.d && Date.parse(PULSE.d.generatedAt); var age = g ? Date.now() - g : 1e12; if (!g || Date.now() - PULSE.at > 4.5 * 60000 || (age > 5.5 * 60000 && age < 30 * 60000)) loadPulse(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - PULSE.at > 5 * 60000) loadPulse(); });
  fetchTier();
  // account links (password reset / email confirmation) land with a session in the URL hash
  (function () {
    var hs = location.hash || ''; if (!/access_token=/.test(hs) || !accountsReady()) return;
    var P = {}; hs.slice(1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) P[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    S.auth = { access_token: P.access_token, refresh_token: P.refresh_token, expires_at: Date.now() + (+P.expires_in || 3600) * 1000, user: {} };
    sb('/auth/v1/user', { auth: true }).then(function (u) {
      saveSession({ access_token: P.access_token, refresh_token: P.refresh_token, expires_in: +P.expires_in || 3600, user: u });
      NAV.stack = [{ name: 'settings' }];
      UI.acctMsg = P.type === 'recovery' ? 'You’re signed in from the reset link. Set a new password below.' : 'Your email is confirmed.';
      render(); fetchTier(); syncNow('link');
    }).catch(function () { S.auth = null; persist(); });
  })();
  if (S.auth) setTimeout(function () { syncNow('boot'); }, 600);
  initPageSync();
  setInterval(function () { if (syncMode() && document.visibilityState === 'visible') syncNow('poll'); }, 30000);
  document.addEventListener('visibilitychange', function () { if (syncMode() && document.visibilityState === 'visible') syncNow('focus'); });
  window.addEventListener('focus', function () { if (syncMode()) syncNow('focus'); });
  if (isNative && plugin('App')) plugin('App').addListener('appStateChange', function (st) { if (st.isActive && syncMode()) syncNow('resume'); });
  window.__convergeSyncNow = syncNow;
})();
