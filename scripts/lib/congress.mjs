// Parsers for official congressional Periodic Transaction Reports (STOCK Act).
// House: text of the Clerk's PTR PDFs (pdftotext -layout). Senate: eFD HTML report pages.
const DATE = /(\d{2}\/\d{2}\/\d{4})/;
const ROW = /^(.*?)\s(P|S \(partial\)|S|E)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;
const iso = (d) => { const [m, dd, y] = d.split('/'); return `${y}-${m}-${dd}`; };
const kind = (k) => /^P/.test(k) ? 'buy' : /^S/.test(k) ? (/partial/i.test(k) ? 'sell (partial)' : 'sell') : 'exchange';
const OWN = { SP: 'Spouse', JT: 'Joint', DC: 'Child' };

export function parseHousePtr(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ROW); if (!m) continue;
    let pre = m[1].trim(), owner = 'Self';
    const om = pre.match(/^(SP|JT|DC)\s{2,}(.*)$/); if (om) { owner = OWN[om[1]]; pre = om[2]; }
    // asset name continues on the next lines until the [XX] asset-type code
    let asset = pre, amt = m[5].trim(), j = i + 1;
    while (j < lines.length && j <= i + 3) {
      const l = lines[j]; if (/^\s*F\s+S\s+:/.test(l) || ROW.test(l)) break;
      const parts = l.trim().split(/\s{3,}/);
      if (parts[0]) asset += ' ' + parts[0];
      if (parts.length > 1 && /^\$/.test(parts[parts.length - 1]) && /-\s*$/.test(amt)) amt += ' ' + parts[parts.length - 1];
      if (/\[[A-Z]{2}\]/.test(asset)) { j++; if (/-\s*$/.test(amt) && j < lines.length) { const p2 = lines[j].trim().split(/\s{3,}/); const last = p2[p2.length - 1]; if (/^\$/.test(last)) amt += ' ' + last; } break; }
      j++;
    }
    const tm = asset.match(/\(([A-Z][A-Z.]{0,6})\)\s*\[([A-Z]{2})\]/);
    const type = (asset.match(/\[([A-Z]{2})\]/) || [])[1] || '';
    if (!tm || !/^(ST|OP)$/.test(type)) continue; // stocks and stock options only
    out.push({ t: tm[1], asset: asset.replace(/\s*\([A-Z.]+\)\s*\[[A-Z]{2}\].*$/, '').replace(/\s+/g, ' ').trim(), type: kind(m[2]), option: type === 'OP', date: iso(m[3]), notified: iso(m[4]), amount: amt.replace(/\s+/g, ' ').trim(), owner });
  }
  return out;
}

export function parseSenatePtr(html) {
  const tb = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
  const rows = tb.split(/<tr[^>]*>/).slice(1);
  const strip = (s) => s.replace(/<div[\s\S]*?<\/div>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const out = [];
  for (const r of rows) {
    const c = r.split(/<td[^>]*>/).slice(1).map((x) => x.split('</td>')[0]);
    if (c.length < 8) continue;
    const date = strip(c[1]), owner = strip(c[2]), tick = strip(c[3]).replace(/^\$/, ''), asset = strip(c[4]), atype = strip(c[5]), typ = strip(c[6]), amt = strip(c[7]);
    if (!/^[A-Z][A-Z.]{0,6}$/.test(tick) || !DATE.test(date)) continue;
    if (!/stock|option/i.test(atype)) continue;
    out.push({ t: tick, asset, type: /purchase/i.test(typ) ? 'buy' : /sale/i.test(typ) ? (/partial/i.test(typ) ? 'sell (partial)' : 'sell') : 'exchange', option: /option/i.test(atype), date: iso(date), amount: amt, owner: owner === 'Self' ? 'Self' : owner });
  }
  return out;
}
