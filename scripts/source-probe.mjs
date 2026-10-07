// Diagnostic: which candidate data sources answer from a GitHub Actions runner?
// Prints status, size and a short sample per endpoint. Robots.txt is fetched for scraped sites.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const probes = [
  ['reuters-gnews', 'https://news.google.com/rss/search?q=Apple+site:reuters.com+when:7d&hl=en-US&gl=US&ceid=US:en'],
  ['cnbc-rss-markets', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'],
  ['cnbc-rss-top', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114'],
  ['cnbc-gnews', 'https://news.google.com/rss/search?q=Apple+site:cnbc.com+when:7d&hl=en-US&gl=US&ceid=US:en'],
  ['x-api', 'https://api.x.com/2/tweets/search/recent?query=AAPL'],
  ['yahoo-rss', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL&region=US&lang=en-US'],
  ['yahoo-spark', 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=AAPL,MSFT,NVDA&range=1d&interval=1d'],
  ['yahoo-chart', 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d'],
  ['stockanalysis-robots', 'https://stockanalysis.com/robots.txt'],
  ['stockanalysis-news', 'https://stockanalysis.com/stocks/aapl/'],
  ['finviz-robots', 'https://finviz.com/robots.txt'],
  ['finviz-rss', 'https://finviz.com/news_export.ashx?v=3'],
  ['stocktwits-api', 'https://api.stocktwits.com/api/2/streams/symbol/AAPL.json'],
  ['stocktwits-trending', 'https://api.stocktwits.com/api/2/trending/symbols.json'],
  ['nasdaq-screener', 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=5&offset=0'],
  ['sp500-datahub', 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'],
  ['piper-voice', 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json']
];
const extraHeaders = { 'nasdaq-screener': { Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' } };
for (const [name, url] of probes) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...(extraHeaders[name] || {}) }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    let sample = t.slice(0, 220).replace(/\s+/g, ' ');
    if (name.endsWith('robots')) sample = t.split('\n').filter((l) => /user-agent: \*|disallow|allow/i.test(l)).slice(0, 25).join(' | ');
    const items = (t.match(/<item[\s>]/g) || []).length;
    console.log(`probe ${name}: ${r.status} ${t.length}B items=${items} :: ${sample}`);
  } catch (e) { console.log(`probe ${name}: ERR ${e.message}`); }
}
