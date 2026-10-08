// Unit tests for www/sync.js merge rules.
const Y = require('../../www/sync.js');
const T0 = Date.now();
let fails = 0; const ok = (label, c) => { console.log((c ? 'PASS ' : 'FAIL ') + label); if (!c) fails++; };
function device(init) { const S = JSON.parse(JSON.stringify(init)), meta = { k: {}, tomb: {} }; let snap = Y.snapshot(S); return { S, meta, edit(fn, now) { fn(S); Y.stamp(S, meta, snap, now); snap = Y.snapshot(S); }, doc() { return Y.exportDoc(S, meta); }, apply(d) { Y.applyDoc(S, meta, d); snap = Y.snapshot(S); } }; }
const base = { watchlist: ['AAPL'], lots: [], watchTheses: {}, signal: false, topOnly: false, range: '1M', brief: {}, seenAlerts: [], muted: [], feedFilter: 'mine', scan: null, prefs: {}, onboarded: false };
let cloud = null;
const sync = (d) => { const m = Y.merge(d.doc(), cloud); d.apply(m); cloud = JSON.parse(JSON.stringify(m)); };
const A = device(base), B = device(base);
A.edit((S) => S.lots.push({ id: 'l1', t: 'AAPL', shares: 10, price: 200, status: 'open' }), T0 + 1000);
sync(A); sync(B);
ok('lot added on A appears on B', B.S.lots.length === 1 && B.S.lots[0].id === 'l1');
B.edit((S) => S.lots.push({ id: 'l2', t: 'NVDA', shares: 5, price: 100, status: 'open' }), T0 + 2000);
A.edit((S) => { S.lots[0].shares = 12; }, T0 + 2100); // concurrent edits on different lots
sync(B); sync(A); sync(B);
ok('concurrent edits on different lots both survive', A.S.lots.length === 2 && B.S.lots.find((l) => l.id === 'l1').shares === 12 && A.S.lots.find((l) => l.id === 'l2'));
A.edit((S) => { S.lots = S.lots.filter((l) => l.id !== 'l2'); }, T0 + 3000);
sync(A); sync(B);
ok('delete on A removes the lot on B', B.S.lots.length === 1 && !B.S.lots.find((l) => l.id === 'l2'));
B.edit((S) => { S.signal = true; S.watchlist.push('MSFT'); }, T0 + 4000);
A.edit((S) => { S.range = '1Y'; }, T0 + 4100);
sync(B); sync(A); sync(B);
ok('settings from both devices merge by key', A.S.signal === true && A.S.watchlist.includes('MSFT') && B.S.range === '1Y');
A.edit((S) => { S.watchlist = ['TSLA']; }, T0 + 5000); B.edit((S) => { S.watchlist = ['META']; }, T0 + 5100);
sync(A); sync(B); sync(A);
ok('same setting changed on two devices: the later change wins', A.S.watchlist[0] === 'META' && B.S.watchlist[0] === 'META');
// a lot edited after being deleted elsewhere is kept
A.edit((S) => { S.lots = []; }, T0 + 6000); B.edit((S) => { S.lots[0].thesis = { title: 'Edited later' }; }, T0 + 6100);
sync(A); sync(B); sync(A);
ok('edit after delete keeps the lot', A.S.lots.length === 1 && A.S.lots[0].thesis.title === 'Edited later');
// database round trip reorders object keys — must still compare equal
const reorder = (x) => Array.isArray(x) ? x.map(reorder) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).reverse().map((k) => [k, reorder(x[k])])) : x;
ok('documents compare equal after key reordering', Y.same(cloud, reorder(cloud)));
// fresh device with untouched defaults takes the account copy
const C = device(base); sync(C);
ok('new device gets the account data', C.S.lots.length === 1 && C.S.watchlist[0] === 'META' && C.S.range === '1Y');
console.log(fails ? fails + ' failed' : 'all sync tests passed'); process.exit(fails ? 1 : 0);
