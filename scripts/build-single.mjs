// Builds dist/converge.html: the whole web app in one file (fonts, CSS, JS and a data
// snapshot inlined) for hosts that cannot serve multiple files.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const www = path.join(root, 'www');
const read = (p) => fs.readFileSync(path.join(www, p), 'utf8');
const dataPath = process.argv[2] || path.join(www, 'data', 'market.json');

let fonts = read('fonts/fonts.css').replace(/url\('([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(www, 'fonts', f)).toString('base64')})`);
const css = read('styles.css');
const js = read('app.js');
const data = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, 'utf8') : 'null';
const scanPath = path.join(path.dirname(dataPath), 'scanner.json');
const scan = fs.existsSync(scanPath) ? fs.readFileSync(scanPath, 'utf8') : 'null';
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const html = `<title>Converge</title>
<meta name="description" content="Converge: portfolio, investment theses, sentiment and filings in one command center.">
<style>${fonts}</style>
<style>${css}</style>
<div id="app"><div class="app"><div class="loading">Loading market data…</div></div></div>
<script>window.__CONVERGE_ARTIFACT__=true;window.__CONVERGE_SNAPSHOT__=${safe(data)};window.__CONVERGE_SCANNER__=${safe(scan)};</script>
<script>${safe(js)}</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'converge.html'), html);
console.log('dist/converge.html', (html.length / 1024).toFixed(0) + ' KB');
