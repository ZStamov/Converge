# Converge

An investing command center that keeps your portfolio, your reasons for owning each stock, news sentiment and SEC filings in one place. One codebase runs as a web app, an Android app and an iOS app.

## What it does

| Area | What you get |
| --- | --- |
| **Command Center** | Portfolio value and chart, watchlist, a split card showing the position next to your thesis, divergence alerts, and a filtered stream of filings, quant changes and news for the selected stock. |
| **Signal Mode** | One switch at the top that hides news, opinion and commentary, leaving SEC filings and quant updates. |
| **Signal Feed** | De-duplicated stories (repeat wire copy is merged and counted), tone tags, a prediction-accuracy badge on every source, and a *Top performers only* filter. |
| **Battleground** | A bull vs. bear consensus bar on every ticker. Tap a side to see the strongest arguments for it. Also shows score drivers, five quant grades and price history. |
| **Vault** | Every lot with its thesis, pinned evidence, target exit, horizon and kill criteria. Before you sell, a reflection screen puts your original reasoning next to today's numbers and logs why you sold. A performance view tracks your decision record. |
| **Divergence alerts** | Flags stocks whose price moves against their fundamentals or news tone (for example, down 4% this week while the quant score is at a 6-month high). On phones these arrive as notifications. |
| **Executive Flash Briefing** | Swipe through the last 72 hours of items that affect only your holdings and watchlist, then listen in a human-sounding neural voice (Kokoro TTS clips rendered hourly in CI; set `briefingVoice` in `config/universe.json`, e.g. `af_heart` or `am_michael`; on-device best voice as fallback). |
| **Scanner** | Finviz-style screener over the S&P 500: Descriptive, Fundamental and Technical filters with Finviz's option lists, signals (Top Gainers, New High, Unusual Volume, Oversold, Golden cross…), five table views, sorting and saved screens. |
| **Source credibility** | Each news outlet earns a Prediction Accuracy Score: its positive and negative headlines are checked against the stock's return vs. the S&P 500 five trading days later. |

## Where the data comes from (all free, no API keys)

A GitHub Actions job (`.github/workflows/data.yml`) runs every hour. It writes `market.json` to the `data` branch, and every version of the app reads it from:

`https://raw.githubusercontent.com/ZStamov/converge/data/market.json`

| Source | Used for |
| --- | --- |
| Yahoo Finance chart API (Stooq as fallback) | Daily prices, 1 year of history |
| Reuters (via Google News), CNBC (RSS and via Google News), Google News, Yahoo Finance RSS | Headlines, tone, story clustering, source track records |
| Stocktwits public API | Retail crowd sentiment (bullish/bearish tags, post rate, watchers) |
| S&P 500 list, Yahoo Finance spark/chart, Nasdaq screener API, SEC XBRL frames | Scanner rows |
| Kokoro (open-source neural TTS, Apache-2.0) | Briefing audio |

Finviz, StockAnalysis and X are linked from every ticker but not pulled: StockAnalysis's terms forbid automated collection, Finviz restricts automated access, and X's API is paid.
| SEC EDGAR submissions | Recent 10-K, 10-Q, 8-K, Form 4 and other filings |
| SEC EDGAR XBRL company facts | Revenue, net income and EPS for the Value, Growth and Profit grades |

### How the scores are calculated

- **Quant grades (A–F):** Value = trailing P/E on the latest fiscal-year diluted EPS; Growth = fiscal-year revenue growth; Profit = net margin; Momentum = 6-month return; Trend = price vs. its 50- and 200-day averages. The score out of 100 averages the five grades.
- **Bull vs. bear:** 45% news tone (each headline weighted by its source's track record), 35% quant grades, 20% one-month price trend.
- **Headline tone:** a finance word list (for example, *beats*, *upgrade* and *record* are positive; *misses*, *downgrade* and *probe* are negative). Headlines are grouped into news vs. analysis/opinion by publisher and wording.
- **Prediction Accuracy Score:** a source needs 10 scored calls before it is rated. *Top performers* are rated sources in the top third.

These are transparent rules-based signals, not investment advice.

### Covered tickers

The 24 tickers in `config/universe.json`. Add or remove symbols there; the next data run picks them up.

## Getting the app

| Platform | How |
| --- | --- |
| **Web / iPhone browser** | Turn on GitHub Pages once (Settings → Pages → Source: **GitHub Actions**), then open `https://zstamov.github.io/converge/`. On iPhone, tap Share → **Add to Home Screen** to use it like an app. A one-file copy is attached to the `web-latest` release. |
| **Android** | Open the `android-latest` release on your phone and install `Converge-android.apk` (allow "Install unknown apps" when asked). |
| **iOS (native)** | Download `Converge-ios-xcode-project.zip` from the `ios-latest` release, open `ios/App/App.xcodeproj` in Xcode on a Mac, pick your iPhone, sign in with your Apple ID under Signing & Capabilities, and press Run. App Store or TestFlight distribution needs an Apple Developer account. |

Build results (with log tails) are written to the `ci-status` branch.

## Discussion board (per stock)

Signed-in users can comment under each ticker. Posts with foul language are blocked twice: in the app, and on the server by a database trigger (it also catches leetspeak, spaced-out letters and stretched spellings, and limits posting to 5 per minute). Word list: [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC-BY-4.0).

One-time setup (free):
1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste the contents of `supabase/schema.sql` and press **Run**.
3. In **Authentication → URL Configuration**, set the Site URL to `https://zstamov.github.io/Converge/`. (Optional: turn off "Confirm email" under Authentication → Providers → Email for instant sign-up.)
4. In **Project Settings → API**, copy the Project URL and the `anon` public key.
5. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then re-run the Web app, Android app and iOS app workflows.

## Candlestick charts

Each ticker page has candles at 1m, 2m, 5m, 1h, 2h, 4h, 5h, 1D, 2D and 1W. The Android and iOS apps load them live from Yahoo Finance; the web app uses the hourly snapshot (`candles.json` on the `data` branch).

## Strategy scanners

Five toggles in the Scanner (scalping, short-term swing, medium-term swing, position/trend, multi-year value) apply the criteria from the strategy playbook. Criteria that need data free sources don't provide (float, VWAP) are listed and skipped; fundamental criteria need the `SEC_USER_AGENT` secret.

## Your data

Lots, theses, watchlist and settings are stored only on your device (browser local storage or the app's WebView storage). Nothing is sent to a server.

## Development

```bash
npm install
npm run test:pipeline        # run the data pipeline against offline mock sources
node scripts/prepare-web.mjs # fonts, icons, bundled data copy
npm run serve                # http://localhost:8080
```

The app is plain JavaScript (`www/app.js`, `www/styles.css`) with no build step. Native shells are generated in CI with Capacitor 8 (`npx cap add android|ios`).
