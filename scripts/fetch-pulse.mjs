// Market pulse as a one-off: writes pulse.json (the live-quotes job also refreshes it every 5 minutes).
import fs from 'node:fs';
import path from 'node:path';
import { fetchPulse } from './lib/pulse.mjs';
const OUT = path.resolve(process.argv[2] || 'pulse-out');
fs.mkdirSync(OUT, { recursive: true });
const out = await fetchPulse();
fs.writeFileSync(path.join(OUT, 'pulse.json'), JSON.stringify(out));
console.log(`pulse: ${Object.keys(out.index).length} index, ${Object.keys(out.sectors).length} sectors, ${out.errors.length} errors`);
if (!out.index.SPY) process.exit(1);
