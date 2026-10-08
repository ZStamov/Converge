/* Converge — account sync. Turns the app state into a document that can be merged between devices.
   Rules: each setting is last-write-wins by its own timestamp; lots merge one by one (newest edit wins,
   deletions are remembered as tombstones), so two devices editing different lots never lose each other's work. */
(function (root) {
  'use strict';
  var KEYS = ['watchlist', 'watchTheses', 'signal', 'topOnly', 'range', 'brief', 'seenAlerts', 'muted', 'feedFilter', 'scan', 'prefs', 'onboarded'];
  // canonical JSON (sorted object keys) so copies that went through the database compare equal
  function canon(x) {
    if (x === undefined || x === null) return 'null';
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (typeof x === 'object') return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
    return JSON.stringify(x);
  }
  var J = canon;
  var clone = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  function lotBody(l) { var o = {}; Object.keys(l).forEach(function (k) { if (k !== 'u') o[k] = l[k]; }); return J(o); }

  // Snapshot of what was last saved/applied, used to see which parts changed.
  function snapshot(S) {
    var snap = { k: {}, lots: {} };
    KEYS.forEach(function (k) { snap.k[k] = J(S[k]); });
    (S.lots || []).forEach(function (l) { snap.lots[l.id] = lotBody(l); });
    return snap;
  }
  // Stamp changes since `snap` with `now`; returns true when anything changed.
  function stamp(S, meta, snap, now) {
    var changed = false;
    meta.k = meta.k || {}; meta.tomb = meta.tomb || {};
    KEYS.forEach(function (k) { if (J(S[k]) !== snap.k[k]) { meta.k[k] = now; changed = true; } });
    var seen = {};
    (S.lots || []).forEach(function (l) { seen[l.id] = 1; if (lotBody(l) !== snap.lots[l.id]) { l.u = now; changed = true; delete meta.tomb[l.id]; } });
    Object.keys(snap.lots).forEach(function (id) { if (!seen[id]) { meta.tomb[id] = now; changed = true; } });
    return changed;
  }
  function exportDoc(S, meta) {
    var keys = {};
    KEYS.forEach(function (k) { keys[k] = { t: (meta.k && meta.k[k]) || 0, v: clone(S[k]) }; });
    var lots = clone(S.lots || []).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    var tomb = {}; Object.keys(meta.tomb || {}).sort().forEach(function (id) { tomb[id] = meta.tomb[id]; });
    return { v: 1, keys: keys, lots: lots, tomb: tomb };
  }
  function merge(a, b) { // a = local, b = remote; ties go to the remote copy
    if (!b || !b.keys) return clone(a);
    var out = { v: 1, keys: {}, lots: [], tomb: {} };
    KEYS.forEach(function (k) {
      var x = a.keys[k] || { t: 0, v: undefined }, y = b.keys[k];
      out.keys[k] = clone(!y ? x : (x.t > y.t ? x : y));
    });
    var tomb = {};
    [a.tomb || {}, b.tomb || {}].forEach(function (t) { Object.keys(t).forEach(function (id) { tomb[id] = Math.max(tomb[id] || 0, t[id]); }); });
    var by = {};
    (b.lots || []).forEach(function (l) { by[l.id] = l; });
    (a.lots || []).forEach(function (l) { var r = by[l.id]; if (!r || (l.u || 0) > (r.u || 0)) by[l.id] = l; });
    Object.keys(by).sort().forEach(function (id) {
      var l = by[id];
      if (tomb[id] != null && tomb[id] >= (l.u || 0)) return; // deleted after its last edit
      if (tomb[id] != null) delete tomb[id]; // edited after a delete elsewhere: keep the lot
      out.lots.push(clone(l));
    });
    Object.keys(tomb).sort().forEach(function (id) { out.tomb[id] = tomb[id]; });
    // keep tombstones for 90 days
    var cut = Date.now() - 90 * 864e5; Object.keys(out.tomb).forEach(function (id) { if (out.tomb[id] < cut) delete out.tomb[id]; });
    if (out.keys.seenAlerts && Array.isArray(out.keys.seenAlerts.v)) out.keys.seenAlerts.v = out.keys.seenAlerts.v.slice(-500);
    return out;
  }
  function applyDoc(S, meta, doc) {
    meta.k = meta.k || {};
    KEYS.forEach(function (k) { var e = doc.keys[k]; if (!e || e.v === undefined) return; S[k] = clone(e.v); meta.k[k] = e.t; });
    S.lots = clone(doc.lots || []);
    meta.tomb = clone(doc.tomb || {});
  }
  function same(a, b) { return !!a && !!b && J({ k: a.keys, l: a.lots, t: a.tomb }) === J({ k: b.keys, l: b.lots, t: b.tomb }); }

  var API = { KEYS: KEYS, canon: canon, snapshot: snapshot, stamp: stamp, exportDoc: exportDoc, merge: merge, applyDoc: applyDoc, same: same };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ConvergeSync = API;
})(typeof window !== 'undefined' ? window : this);
