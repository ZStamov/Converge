// Probe: free sources for politicians' trades, fund (13F) holders and insider trades.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const NH = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
async function show(label, url, headers = { 'User-Agent': UA }, max = 900) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(40000) }); const b = Buffer.from(await r.arrayBuffer());
    console.log(`== ${label} HTTP ${r.status} ${r.headers.get('content-type')} ${b.length} bytes`);
    const t = b.toString('utf8', 0, Math.min(b.length, 400000));
    try { const j = JSON.parse(b.toString('utf8')); console.log(JSON.stringify(j, (k, v) => Array.isArray(v) && v.length > 2 ? [...v.slice(0, 2), `…(${v.length})`] : v).slice(0, max)); } catch { console.log(t.slice(0, max).replace(/\s+/g, ' ')); }
  } catch (e) { console.log(`== ${label} ERROR ${e.message}`); }
}
await show('nasdaq insider', 'https://api.nasdaq.com/api/company/NVDA/insider-trades?limit=5&type=ALL&sortColumn=lastDate&sortOrder=DESC', NH, 1800);
await show('nasdaq institutional', 'https://api.nasdaq.com/api/company/NVDA/institutional-holdings?limit=5&type=TOTAL&sortColumn=marketValue&sortOrder=DESC', NH, 1800);
await show('house stock watcher', 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
await show('senate stock watcher', 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json');
await show('capitol trades bff', 'https://bff.capitoltrades.com/trades?page=1&pageSize=3');
await show('house clerk index 2026', 'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.zip');
await show('house clerk search page', 'https://disclosures-clerk.house.gov/FinancialDisclosure');
await show('senate efd', 'https://efdsearch.senate.gov/search/');
await show('sec form4 (no UA email)', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=5&output=atom');
await show('openinsider', 'http://openinsider.com/screener?s=NVDA&cnt=5');
