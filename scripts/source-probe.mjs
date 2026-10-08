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
for (const row of ptr.slice(-40).reverse().slice(0, 3)) {
  const c = row.split('\t'), id = c[8], yr = c[7];
  const url = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${yr}/${id}.pdf`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } }); const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync('probe-tmp/p.pdf', b);
  let t = ''; try { t = execFileSync('pdftotext', ['-layout', 'probe-tmp/p.pdf', '-'], { encoding: 'utf8' }); } catch (e) { t = 'pdftotext failed ' + e.message; }
  console.log(`\n==== ${url} HTTP ${r.status} ${b.length} bytes, ${c[1]} ${c[2]} ${c[6]}\n` + t.slice(0, 2600));
}
// ---- Senate eFD
try {
  let jar = {};
  const setC = (r) => { for (const sc of r.headers.getSetCookie ? r.headers.getSetCookie() : []) { const [kv] = sc.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
  const ck = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
  let r = await fetch('https://efdsearch.senate.gov/search/home/', { headers: { 'User-Agent': UA } }); setC(r); const h = await r.text();
  const tok = (h.match(/name="csrfmiddlewaretoken" value="([^"]+)"/) || [])[1];
  console.log('\nsenate token', !!tok, Object.keys(jar));
  r = await fetch('https://efdsearch.senate.gov/search/home/', { method: 'POST', redirect: 'manual', headers: { 'User-Agent': UA, Cookie: ck(), Referer: 'https://efdsearch.senate.gov/search/home/', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ prohibition_agreement: '1', csrfmiddlewaretoken: tok }) });
  setC(r); console.log('agree', r.status, r.headers.get('location'), Object.keys(jar));
  const body = new URLSearchParams({ start: '0', length: '5', report_types: '[11]', filer_types: '[]', submitted_start_date: '09/01/2026 00:00:00', submitted_end_date: '', candidate_state: '', senator_state: '', office_id: '', first_name: '', last_name: '', csrfmiddlewaretoken: jar.csrftoken });
  r = await fetch('https://efdsearch.senate.gov/search/report/data/', { method: 'POST', headers: { 'User-Agent': UA, Cookie: ck(), Referer: 'https://efdsearch.senate.gov/search/', 'X-CSRFToken': jar.csrftoken, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.text(); console.log('search', r.status, j.slice(0, 1500));
  const link = (j.match(/\/search\/view\/ptr\/[0-9a-f-]+\//) || [])[0];
  if (link) { r = await fetch('https://efdsearch.senate.gov' + link, { headers: { 'User-Agent': UA, Cookie: ck() } }); const p = await r.text(); const tb = p.slice(p.indexOf('<table'), p.indexOf('</table>') + 8); console.log('\nptr page', r.status, tb.replace(/\s+/g, ' ').slice(0, 3000)); }
} catch (e) { console.log('senate error', e.message); }
