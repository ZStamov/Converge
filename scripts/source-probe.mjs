// Probe: official congressional periodic transaction reports (House Clerk PDFs, Senate eFD).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
fs.mkdirSync('probe-tmp', { recursive: true });
// ---- House
const z = Buffer.from(await (await fetch('https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.zip', { headers: { 'User-Agent': UA } })).arrayBuffer());
fs.writeFileSync('probe-tmp/fd.zip', z); execFileSync('unzip', ['-o', '-q', 'probe-tmp/fd.zip', '-d', 'probe-tmp']);
console.log('zip files:', fs.readdirSync('probe-tmp').join(', '));
const txt = fs.readFileSync('probe-tmp/2026FD.txt', 'utf8').split(/\r?\n/);
console.log('header:', txt[0]); console.log(txt.slice(1, 4).join('\n'));
const ptr = txt.filter((l) => l.split('\t')[4] === 'P');
console.log('PTR rows:', ptr.length); console.log(ptr.slice(-3).join('\n'));
for (const row of ptr.slice(-60).reverse().slice(0, 4)) {
  const c = row.split('\t'), id = c[8], yr = c[6];
  const url = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${yr}/${id}.pdf`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } }); const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync('probe-tmp/p.pdf', b);
  let t = ''; try { t = execFileSync('pdftotext', ['-layout', 'probe-tmp/p.pdf', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { t = 'pdftotext failed ' + e.message; }
  console.log(`\n==== ${url} HTTP ${r.status} ${b.length} bytes, ${c[1]} ${c[2]} ${c[6]}\n` + t.slice(0, 2600));
}
