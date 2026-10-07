// Builds dist/converge.html: the whole web app in one file (fonts, CSS, JS and a data
// snapshot inlined) for hosts that cannot serve multiple files.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const www = path.join(root, 'www');
const read = (p) => fs.readFileSync(path.join(www, p), 'utf8');
const dataPath = process.argv[2] || path.join(www, 'data', 'market.json');

let fonts = read('fonts/fonts.css').replace(/url\('([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(www, 'fonts', f)).toString('base64')})`);
const css = read('styles.css');
const js = read('app.js');
const sigjs = read('signals.js');
const data = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, 'utf8') : 'null';
const scanPath = path.join(path.dirname(dataPath), 'scanner.json');
const scan = fs.existsSync(scanPath) ? fs.readFileSync(scanPath, 'utf8') : 'null';
const candPath = path.join(path.dirname(dataPath), 'candles.json');
const candles = fs.existsSync(candPath) ? fs.readFileSync(candPath, 'utf8') : 'null';
const pulsePath = process.env.PULSE_JSON || path.join(path.dirname(dataPath), 'pulse.json');
const pulse = fs.existsSync(pulsePath) ? fs.readFileSync(pulsePath, 'utf8') : 'null';
const profanity = fs.existsSync(path.join(www, 'profanity.js')) ? read('profanity.js') : '';
// briefing clips (pages can't fetch audio from other sites): embed the referenced ones, re-encoded small
const audioDir = path.join(path.dirname(dataPath), 'audio');
let audio = 'null';
if (fs.existsSync(audioDir) && data !== 'null') {
  const m = JSON.parse(data), names = new Set();
  (m.briefing || []).forEach((b) => b.audio && names.add(b.audio));
  if (m.briefingAudio) { names.add(m.briefingAudio.intro); names.add(m.briefingAudio.outro); }
  const map = {}; let bytes = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'));
  for (const n of names) {
    const src = path.join(audioDir, n); if (!n || !fs.existsSync(src)) continue;
    let buf = fs.readFileSync(src);
    try { const out = path.join(tmp, n); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '36k', out]); buf = fs.readFileSync(out); } catch (e) { /* keep original */ }
    map[n] = 'data:audio/mpeg;base64,' + buf.toString('base64'); bytes += buf.length;
  }
  audio = JSON.stringify(map);
  console.log('embedded', Object.keys(map).length, 'clips,', (bytes / 1048576).toFixed(1), 'MB');
}
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const html = `<title>Converge</title>
<meta name="description" content="Converge: portfolio, investment theses, sentiment and filings in one command center.">
<style>${fonts}</style>
<style>${css}</style>
<div id="app"><div class="app"><div class="loading">Loading market data…</div></div></div>
<script>window.__CONVERGE_ARTIFACT__=true;window.__CONVERGE_SNAPSHOT__=${safe(data)};window.__CONVERGE_SCANNER__=${safe(scan)};window.__CONVERGE_CANDLES__=${safe(candles)};window.__CONVERGE_AUDIO__=${safe(audio)};window.__CONVERGE_PULSE__=${safe(pulse)};</script>
<script>${safe(profanity)}</script>
<script>${safe(sigjs)}</script>
<script>${safe(js)}</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'converge.html'), html);
console.log('dist/converge.html', (html.length / 1024).toFixed(0) + ' KB');
