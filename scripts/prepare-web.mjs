// Generates binary/web assets that are not stored in git:
//   www/fonts/*  (from @fontsource), www/icons/* and assets/*.png (from assets/icon.svg),
//   www/data/market.json (bundled fallback copy, if data-out/market.json exists).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const www = path.join(root, 'www');
const mk = (p) => fs.mkdirSync(p, { recursive: true });

// fonts
const FONTS = [['Space Grotesk', 'space-grotesk', [500, 700]], ['IBM Plex Sans', 'ibm-plex-sans', [400, 500, 600, 700]], ['IBM Plex Mono', 'ibm-plex-mono', [400, 500]]];
mk(path.join(www, 'fonts'));
let css = '';
for (const [fam, dir, weights] of FONTS) for (const w of weights) {
  const f = `${dir}-latin-${w}-normal.woff2`;
  fs.copyFileSync(path.join(root, 'node_modules/@fontsource', dir, 'files', f), path.join(www, 'fonts', f));
  css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url('${f}') format('woff2')}\n`;
}
fs.writeFileSync(path.join(www, 'fonts', 'fonts.css'), css);

// icons
const svg = fs.readFileSync(path.join(root, 'assets', 'icon.svg'));
mk(path.join(www, 'icons'));
fs.copyFileSync(path.join(root, 'assets', 'icon.svg'), path.join(www, 'icons', 'icon.svg'));
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) await sharp(svg).resize(size, size).png().toFile(path.join(www, 'icons', name));
// maskable: logo smaller inside safe zone
const mask = Buffer.from(svg.toString().replace('translate(152 152) scale(25.7)', 'translate(256 256) scale(18.3)'));
await sharp(mask).resize(512, 512).png().toFile(path.join(www, 'icons', 'icon-maskable-512.png'));
// Capacitor asset sources (used by `npx capacitor-assets generate`)
await sharp(svg).resize(1024, 1024).png().toFile(path.join(root, 'assets', 'icon-only.png'));
const fg = Buffer.from(svg.toString().replace(/<rect[^>]*\/>/, '').replace('translate(152 152) scale(25.7)', 'translate(300 300) scale(15.1)'));
await sharp(fg).resize(1024, 1024).png().toFile(path.join(root, 'assets', 'icon-foreground.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0B0E13' } }).png().toFile(path.join(root, 'assets', 'icon-background.png'));
const splash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="#0B0E13"/><g transform="translate(1116 1116) scale(17.8)" fill="none" stroke="#FFC24B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l11 8M3 22l11-8M14 14h9"/><circle cx="24.5" cy="14" r="1.8" fill="#FFC24B"/></g></svg>`);
await sharp(splash).png().toFile(path.join(root, 'assets', 'splash.png'));
await sharp(splash).png().toFile(path.join(root, 'assets', 'splash-dark.png'));

// bundled data copy
const src = path.join(root, 'data-out', 'market.json');
mk(path.join(www, 'data'));
if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, 'data', 'market.json'));
const scan = path.join(root, 'data-out', 'scanner.json');
if (fs.existsSync(scan)) fs.copyFileSync(scan, path.join(www, 'data', 'scanner.json'));
// runtime config (forum backend) and the profanity list for the client-side filter
fs.writeFileSync(path.join(www, 'config.js'), 'window.CONVERGE_CONFIG = ' + JSON.stringify({ supabaseUrl: process.env.SUPABASE_URL || '', supabaseKey: process.env.SUPABASE_ANON_KEY || '', premiumUrl: process.env.PREMIUM_CHECKOUT_URL || '', premiumPrice: process.env.PREMIUM_PRICE || '', premiumRequired: process.env.PREMIUM_REQUIRED === 'true' }) + ';\n');
const { createRequire } = await import('node:module');
const words = createRequire(import.meta.url)('naughty-words').en;
fs.writeFileSync(path.join(www, 'profanity.js'), '/* LDNOOBW word list (CC-BY-4.0) */ window.CONVERGE_BADWORDS = ' + JSON.stringify(words) + ';\n');
const cand = path.join(root, 'data-out', 'candles.json');
if (fs.existsSync(cand)) fs.copyFileSync(cand, path.join(www, 'data', 'candles.json'));
console.log('web assets ready');
