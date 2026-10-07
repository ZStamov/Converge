// Diagnostic: which request styles does SEC EDGAR accept from this runner?
const tries = [
  ['node, app UA', 'Converge app 79805660+ZStamov@users.noreply.github.com', {}],
  ['node, plain UA', 'Converge Research admin@converge-app.dev', {}],
  ['node, UA + host + accept', 'Converge Research admin@converge-app.dev', { Accept: 'application/json', Host: 'data.sec.gov' }]
];
for (const [label, ua, extra] of tries) {
  for (const url of ['https://data.sec.gov/submissions/CIK0000320193.json', 'https://www.sec.gov/files/company_tickers.json']) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': ua, ...extra } });
      const body = r.ok ? '' : (await r.text()).slice(0, 160).replace(/\s+/g, ' ');
      console.log(`sec-probe ${label} ${url} -> ${r.status} ${body}`);
    } catch (e) { console.log(`sec-probe ${label} ${url} -> ERR ${e.message}`); }
  }
}
