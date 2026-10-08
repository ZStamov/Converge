// Probe: Nasdaq insider-trades filter values for open-market buys.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const NH = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
for (const ty of ['ALL', 'BUYS', 'buys', 'Buys', 'buy', 'PURCHASES', 'Purchase']) {
  try {
    const j = await (await fetch(`https://api.nasdaq.com/api/company/NVDA/insider-trades?limit=10&type=${ty}&sortColumn=lastDate&sortOrder=DESC`, { headers: NH })).json();
    const rows = (j.data && j.data.transactionTable && j.data.transactionTable.table && j.data.transactionTable.table.rows) || [];
    console.log(ty.padEnd(10), 'total', j.data && j.data.transactionTable && j.data.transactionTable.totalRecords, '|', rows.slice(0, 4).map((r) => r.transactionType + ' ' + r.lastDate).join(' ; '));
  } catch (e) { console.log(ty, 'ERR', e.message); }
}
