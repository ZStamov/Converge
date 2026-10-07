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
  var DEFAULT = { watchlist: ['AAPL', 'NVDA', 'MSFT', 'AMZN'], lots: [], watchTheses: {}, signal: false, topOnly: false, range: '1M', brief: { day: null, picked: [], skipped: [] }, seenAlerts: [], muted: [], sel: null, notify: false, feedFilter: 'mine', onboarded: false };

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
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 4v7h-7"></path>'
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
  function rangeSlice(x, r) { var n = { '1M': 22, '6M': 127, '1Y': 9999 }[r] || 22; return { d: x.hist.d.slice(-n), c: x.hist.c.slice(-n) }; }
  function portfolioSeries(r) {
    var hs = holdings(); if (!hs.length) return [];
    var ref = T(hs[0].t); var days = rangeSlice(ref, r).d;
    return days.map(function (day) { var v = 0; hs.forEach(function (h) { v += h.shares * (closeOn(h.t, day) || 0); }); return v; });
  }

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
    var tabs = [['command', 'cmd', 'Command'], ['feed', 'bolt', 'Signal Feed'], ['battle', 'scale', 'Battleground'], ['vault', 'vault', 'Vault']];
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
      var prev = val - day, ser = portfolioSeries(S.range);
      h += '<section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><h2 class="eyebrow">Portfolio value</h2><div class="big">' + money(val) + '</div>' +
        '<div class="mono ' + cls(day) + '" style="font-size:13px;margin-top:2px">' + (day >= 0 ? '▲ ' : '▼ ') + money(Math.abs(day)) + ' (' + pct(prev ? day / prev * 100 : 0, 2) + ') today</div>' +
        '<div class="mono ' + cls(val - cost) + '" style="font-size:12px;margin-top:2px">' + (val - cost >= 0 ? '+' : '−') + money(Math.abs(val - cost)).replace('−', '') + ' total (' + pct(cost ? (val / cost - 1) * 100 : 0) + ')</div></div>' +
        rangeBtns('range', S.range) + '</div><div style="margin-top:10px">' + lineChart(ser, { h: 70, label: 'Value of current holdings, ' + S.range }) + '</div></section>';
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
  function rangeBtns(act, cur) { return '<div class="ranges">' + ['1M', '6M', '1Y'].map(function (r) { return '<button data-act="' + act + '" data-r="' + r + '" aria-pressed="' + (cur === r) + '">' + r + '</button>'; }).join('') + '</div>'; }
  function sentBar(s, small) {
    if (!s) return '';
    return '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span class="up">' + s.bull + '% Bull</span><span class="down">' + s.bear + '% Bear</span></div><div class="bar" style="height:' + (small ? 8 : 10) + 'px"><div class="b" style="width:' + s.bull + '%"></div><div class="s"></div></div></div>';
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
    var s = x.sentiment, r = rangeSlice(x, UI.battleRange);
    var h = '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div style="min-width:0"><h1 class="disp" style="margin:0;font-size:26px;font-weight:700;letter-spacing:-.4px;line-height:1.15">' + esc(x.name || sel) + '</h1><div class="muted" style="font-size:12px;margin-top:2px">' + sel + ' · ' + esc(x.priceSource) + ' · ' + ago(x.asOf) + '</div></div>' +
      '<div style="text-align:right;flex:none"><div class="mono" style="font-size:22px">' + money(x.price) + '</div><div class="mono ' + cls(x.changePct) + '" style="font-size:12px">' + (x.changePct >= 0 ? '▲ +' : '▼ ') + money(Math.abs(x.price - x.prevClose)) + ' (' + Math.abs(x.changePct).toFixed(1) + '%)</div></div></div>';
    // slider
    h += '<section class="card"><div class="sechead" style="margin-bottom:12px"><h2 class="eyebrow">Consensus balance</h2><span class="muted" style="font-size:11px">' + s.n + ' stories · weighted</span></div>' +
      '<div class="slider"><button class="bl" style="width:' + clamp(s.bull, 18, 82) + '%" data-act="side" data-side="bull" aria-pressed="' + (UI.side === 'bull') + '" aria-label="Bull case, ' + s.bull + ' percent"><span class="pct">' + s.bull + '%</span><span class="sd">BULLISH</span></button>' +
      '<button class="br" data-act="side" data-side="bear" aria-pressed="' + (UI.side === 'bear') + '" aria-label="Bear case, ' + s.bear + ' percent"><span class="pct">' + s.bear + '%</span><span class="sd">BEARISH</span></button></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:8px" class="muted"><span>News tone this week: ' + s.newsBull7d + '% bull (prior week ' + s.newsBullPrev7d + '%)</span><span>Tap a side</span></div>';
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
    h += '<section class="card"><div class="sechead"><h2 class="eyebrow">Price</h2>' + rangeBtns('brange', UI.battleRange) + '</div>' + lineChart(r.c, { h: 120, label: sel + ' price, ' + UI.battleRange }) +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px" class="muted mono"><span>' + esc(fmtDate(r.d[0])) + '</span><span>' + esc(fmtDate(r.d[r.d.length - 1])) + '</span></div></section>';
    // drivers
    h += '<section class="card drv"><h2 class="eyebrow" style="margin-bottom:10px">What drives the score</h2><div style="display:flex;flex-direction:column;gap:12px">' + s.drivers.map(function (d) {
      return '<div><div class="r"><span>' + esc(d.label) + (d.key === 'quant' && Object.keys(x.grades).length < 5 ? ' (' + Object.keys(x.grades).length + ' of 5 available)' : '') + '</span><span class="mono ' + (d.bull >= 50 ? 'up' : 'down') + '" style="white-space:nowrap">' + d.bull + '% bull · w ' + d.w + '%</span></div><div class="track"><i style="width:' + d.bull + '%"></i></div></div>';
    }).join('') + '</div></section>';
    // grades
    var order = ['value', 'growth', 'profit', 'momentum', 'trend'];
    h += '<section><div class="sechead"><h2 class="eyebrow">Quant grades</h2><span class="mono muted" style="font-size:12px">Score ' + (x.quant.score == null ? '—' : x.quant.score) + '/100' + (Object.keys(x.grades).length < 5 ? ' · ' + Object.keys(x.grades).length + ' of 5 grades' : '') + '</span></div><div class="grades">' + order.map(function (k) {
      var g = x.grades[k]; return '<div class="grade"><div class="g g' + (g ? g.g : '') + '">' + (g ? g.g : '—') + '</div><div class="l">' + (g ? g.label : k) + '</div><div class="v">' + esc(g ? g.v : 'n/a') + '</div></div>';
    }).join('') + '</div>' + (x.fundamentals && x.fundamentals.fy ? '<p class="foot" style="text-align:left">Fundamentals from SEC filings, fiscal ' + esc(x.fundamentals.fy) + ': revenue ' + compact(x.fundamentals.revenue) + ', net income ' + compact(x.fundamentals.netIncome) + ', diluted EPS ' + money(x.fundamentals.eps) + '.</p>' : '') + '</section>';
    // filings + headlines
    var st = streamFor([sel], { limit: 10 });
    h += '<section><h2 class="eyebrow" style="margin-bottom:8px">Latest on ' + sel + '</h2><div class="list">' + (st.length ? st.map(itemRow).join('') : '<p class="muted" style="font-size:13px;margin:0">No recent items.</p>') + '</div></section>';
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
      h += '<div><h1 class="disp" style="margin:0;font-size:26px;font-weight:700">Add a lot</h1><p class="muted" style="margin:4px 0 0;font-size:13px">Record a purchase. Next, Converge asks for your thesis.</p></div>';
      h += '<div class="field"><span class="lab">Ticker</span><button class="in" data-act="pick" data-mode="draft" style="text-align:left;display:flex;align-items:center;justify-content:space-between">' + (d.t ? '<span><span class="mono">' + d.t + '</span> <span class="muted">' + esc(x ? x.name : '') + '</span></span>' : '<span class="muted">Choose a ticker</span>') + ic('chev', 16) + '</button></div>';
      h += '<div class="grid2"><div class="field"><label for="f-shares">Shares</label><input class="in mono" id="f-shares" data-f="shares" inputmode="decimal" placeholder="e.g. 25" value="' + esc(d.shares) + '"></div><div class="field"><label for="f-price">Price paid</label><input class="in mono" id="f-price" data-f="price" inputmode="decimal" value="' + esc(d.price) + '"></div></div>';
      h += '<div class="field"><label for="f-date">Purchase date</label><input class="in" id="f-date" data-f="date" type="date" max="' + today() + '" value="' + esc(d.date) + '"></div>';
      h += '<div class="btnrow" style="margin-top:auto"><button class="btn" data-act="back">Cancel</button><button class="btn pri" data-act="draft-next" style="flex:2">Continue</button></div>';
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
    h += '<div class="player" style="margin-top:auto"><button class="pb" data-act="brief-play" aria-label="' + (UI.speaking ? 'Stop briefing' : 'Play briefing') + '"' + (B.queue.length ? '' : ' disabled') + '>' + ic(UI.speaking ? 'pause' : 'play', 18) + '</button><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + (UI.speaking ? 'Playing ' + (UI.speakIdx + 1) + ' of ' + B.queue.length : 'Today’s briefing · ' + fmtSec(total)) + '</div><div style="font-size:12px">' + (ttsAvailable() ? 'Read aloud on this device' : 'Audio is not available in this browser') + '</div></div></div>';
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
      '<p class="muted" style="margin:8px 0 0;font-size:12px;line-height:1.5">Sources: ' + esc((D.method && D.method.sources || []).join(' · ')) + '. Refreshed automatically about every 30 minutes on market days.</p>' +
      '<button class="btn sm" data-act="refresh" style="margin-top:10px">' + ic('refresh', 16) + 'Refresh now</button></section>';
    if (isNative && plugin('LocalNotifications')) h += '<button class="rowtoggle" data-act="notify" aria-pressed="' + S.notify + '"><span><span class="t1">Divergence alerts</span><span class="t2">Notify me when a stock I hold or watch diverges</span></span><span class="sw"></span></button>';
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Muted sources</h2>' + (S.muted.length ? S.muted.map(function (m) { return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0"><span>' + esc(m) + '</span><button class="btn sm" data-act="mute" data-name="' + esc(m) + '">Unmute</button></div>'; }).join('') : '<p class="muted" style="margin:0;font-size:13px">None. Mute a source from its profile.</p>') + '</section>';
    h += '<section class="card"><h2 class="eyebrow" style="margin-bottom:8px">Your data</h2><p class="muted" style="margin:0 0 10px;font-size:13px;line-height:1.5">Lots, theses and your watchlist are stored only on this device.</p><button class="btn sm dng" data-act="reset">' + (UI.confirmReset ? 'Tap again to erase everything' : 'Erase all my data') + '</button></section>';
    h += '<p class="foot">Converge · Covers ' + D.universe.length + ' tickers · <a href="' + CFG.repo + '" target="_blank" rel="noopener noreferrer">Source code</a><br>Information only, not investment advice.</p>';
    return subBar('Settings') + '<main class="main" id="main">' + h + '</main>';
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
    watch: function (el) { var t = el.dataset.t, i = S.watchlist.indexOf(t); if (i >= 0) { S.watchlist.splice(i, 1); save(); toast('Removed ' + t + ' from watchlist'); } else { S.watchlist.push(t); save(); UI.draft = newDraft(t, 'watch'); go({ name: 'add' }); } },
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
        else { S.watchlist.push(t); save(); UI.sheet = null; UI.draft = newDraft(t, 'watch'); go({ name: 'add' }); }
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
      d.step = 2; render();
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
    'brief-add': function () { swipeDecide(true); },
    'brief-skip': function () { swipeDecide(false); },
    'brief-reset': function () { S.brief = { day: today(), picked: [], skipped: [] }; save(); render(); },
    'brief-play': function () { if (UI.speaking) stopSpeech(); else playBriefing(); }
  };
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
    save(); NAV.stack.pop(); UI.draft = null; toast(thesis ? 'Lot and thesis saved' : 'Lot saved. Add the thesis any time from the Vault.');
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
  function speakOne(text) {
    var tts = plugin('TextToSpeech');
    if (tts) return tts.speak({ text: text, lang: 'en-US', rate: 1.0 });
    return new Promise(function (res) {
      var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 1.03;
      u.onend = res; u.onerror = res; window.speechSynthesis.speak(u);
    });
  }
  function stopSpeech() {
    UI.speaking = false; UI.speakIdx = -1;
    var tts = plugin('TextToSpeech'); if (tts) tts.stop().catch(function () { });
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  function playBriefing() {
    var q = briefState().queue; if (!q.length) return;
    if (!ttsAvailable()) return toast('Audio is not available in this browser');
    UI.speaking = true; UI.speakIdx = -1; render();
    var run = UI.runId = uid();
    var intro = 'Your Converge briefing for ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '. ' + q.length + ' items.';
    var steps = [intro].concat(q.map(function (b) { return b.t.split('').join(' ') + '. ' + b.title + '. ' + b.why; }));
    var i = 0;
    (function next() {
      if (!UI.speaking || UI.runId !== run) return;
      if (i >= steps.length) { stopSpeech(); render(); return; }
      UI.speakIdx = i - 1; render();
      Promise.resolve(speakOne(steps[i++])).then(next, next);
    })();
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
  if (window.__CONVERGE_ARTIFACT__) document.documentElement.classList.add('in-artifact');

  render();
  loadData();
  setInterval(function () { if (document.visibilityState === 'visible') loadData(); }, 15 * 60000);
})();
