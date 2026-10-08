# Converge

An investing command center that keeps your portfolio, your reasons for owning each stock, news sentiment and SEC filings in one place. One codebase runs as a web app, an Android app and an iOS app.

## What it does

| Area | What you get |
| --- | --- |
| **Market sentiment banner** | The first card when the app opens: today's market mood (Bullish / Neutral / Bearish, 0–100) built from 5-minute bars of SPY, QQQ, DIA, IWM, the VIX and the 11 sector ETFs, with a 5-minute SPY chart. Refreshes every 5 minutes. |
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

## Search: every US stock, ETF and index

The search box finds every common stock listed on Nasdaq, NYSE and NYSE American, every US-listed ETF (SPY, QQQ, VOO…), and the major indexes: SPX (S&P 500), NDX, DJI, IXIC (Nasdaq Composite), RUT and VIX. About 11,000 symbols; warrants, rights, units, notes, preferreds and OTC stocks are left out. Picking one outside the 24 tracked tickers opens a page with its candle chart, buy/sell signals and backtest.

`.github/workflows/history.yml` builds this from the S&P 500 list and Nasdaq's screener for the Nasdaq, NYSE and NYSE American exchanges, and keeps 2 years of daily bars per stock on the `history` branch (`symbols.json`, `h/<TICKER>.json`). It runs after each US close and every 2 hours. On the website these stocks get 1D, 2D and 1W candles; the Android and iOS apps load every interval live from Yahoo Finance. News, sentiment, quant grades and the discussion stay limited to the tracked tickers.

## Market sentiment (5-minute)

`.github/workflows/pulse.yml` runs every 5 minutes during US market hours and writes `pulse.json` to the `pulse` branch. The web app reads it from `https://raw.githubusercontent.com/ZStamov/converge/pulse/pulse.json`; the Android and iOS apps pull the 5-minute bars straight from Yahoo Finance. Every copy re-checks every 5 minutes while open.

Score (0–100): 30% S&P 500 change vs. yesterday's close, 20% price vs. VWAP (SPY and QQQ), 20% last-30-minute momentum, 20% breadth (how many of the 4 index ETFs and 11 sector ETFs are up), 10% VIX change (falling VIX is bullish). 60 or more is Bullish (green), 40 or less Bearish (orange), in between Neutral (yellow). GitHub's scheduler can run a few minutes late at busy times.

## Free and Premium plans

**Testing mode is on:** while the `PREMIUM_REQUIRED` variable isn't `true`, every user gets every Premium feature, and the database lets any signed-in member post (`public.converge_settings.premium_required = false`). To switch the paywall on: set the GitHub Variable `PREMIUM_REQUIRED` to `true`, re-run the app workflows, and run `update public.converge_settings set premium_required = true;` in Supabase.

| | Free | Premium |
| --- | --- | --- |
| Command Center, Signal Feed, Battleground, Vault, alerts, briefing, candles, market sentiment | ✓ | ✓ |
| Scanner filters, signals, views and saved screens | ✓ | ✓ |
| Read the stock discussions | ✓ | ✓ |
| 5 strategy scanner toggles | | ✓ |
| Post in the discussion under each stock | | ✓ |

Everyone who signs up starts on Free. Tapping a strategy toggle or trying to comment as a Free (or signed-out) user opens the *Converge Premium* screen. The rule is enforced on the server too: the database rejects posts from non-premium accounts.

**Upgrade or downgrade someone** (Supabase → SQL Editor):

```sql
update public.profiles set tier = 'premium', premium_until = null   -- or a date, e.g. now() + interval '1 month'
where id = (select id from auth.users where email = 'someone@example.com');
```

**Online checkout (optional):** create a payment link (for example a Stripe Payment Link), then add the repository Variables `PREMIUM_CHECKOUT_URL` and `PREMIUM_PRICE` (the label shown, e.g. `$9.99/month`) and re-run the app workflows. The app appends `client_reference_id=<user id>` and `prefilled_email=` to the link so a payment webhook can flip that user's `tier` to `premium`. Without a checkout URL the Premium screen says checkout isn't open yet.

**Test accounts:** `supabase/schema.sql` creates the tables; a separate, private `demo-users.sql` (not in this repository) creates one Free and one Premium login. Keep those passwords out of the repo.

Copies without an account system (the one-file page, or before Supabase is set up) have a labeled *Preview Premium* switch in Settings so you can see what each plan unlocks.

## Politicians, hedge funds and insiders (every stock)

Under each stock's discussion, a *Who owns it* row with three columns (politicians, hedge funds, insiders: tap one for its detail) (`.github/workflows/smart.yml`, every 4 hours, `smart` branch: `congress.json`, `s/<TICKER>.json`):

- **Politicians:** stock and option trades disclosed by members of Congress in the last 2 years, parsed from the official STOCK Act Periodic Transaction Reports: the House Clerk's PTR PDFs and the Senate's eFD reports, with party and state from the open `unitedstates/congress-legislators` dataset. Shows who, buy or sell, the reported amount range, whose account (self, spouse…), trade and filing dates, and a link to the filing. Scanned paper filings can't be read and are skipped.
- **Hedge funds & institutions:** 13F holdings via Nasdaq: institutional ownership, how many holders increased, decreased, opened or closed positions, well-known hedge funds among the 300 largest holders (matched by name), and the quarter's biggest buyers and sellers.
- **Insider buys:** Form 4 insider trades via Nasdaq: open-market buys and sells over 3 and 12 months, and the latest trades (buys only, or all trades).

The claude.ai page carries this data for the tracked tickers and the popular names it embeds.

## Discussion board (per stock)

Every stock page (tracked tickers, and any stock opened from search or the scanner) has a discussion. In the apps and on the website it runs on the Supabase backend below. In the claude.ai page it uses the page's own shared storage: posts are live for everyone viewing the page, show each poster's Claude name, and can be written by the owner and the people the owner invites (link viewers can read); the owner can remove any post.


Premium members can comment under each ticker. Posts with foul language are blocked twice: in the app, and on the server by a database trigger (it also catches leetspeak, spaced-out letters and stretched spellings, and limits posting to 5 per minute). Word list: [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC-BY-4.0).

One-time setup (free):
1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste the contents of `supabase/schema.sql` and press **Run**.
3. In **Authentication → URL Configuration**, set the Site URL to `https://zstamov.github.io/Converge/`. (Optional: turn off "Confirm email" under Authentication → Providers → Email for instant sign-up.)
4. In **Project Settings → API**, copy the Project URL and the `anon` public key.
5. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and optionally `PREMIUM_CHECKOUT_URL`, `PREMIUM_PRICE`), then re-run the Web app, Android app and iOS app workflows.

## Candlestick charts, signals and backtest

Each ticker page has candles at 1m, 2m, 5m, 1h, 2h, 4h, 5h, 1D, 2D and 1W. The Android and iOS apps load them live from Yahoo Finance; the web app uses the hourly snapshot (`candles.json` on the `data` branch).

- **Full screen:** tap *⤢ Full screen*; turn the phone sideways for a wide chart. Close with ✕ (or Back / Esc).
- **Zoom:** pinch with two fingers (trackpad pinch or the mouse wheel in full screen on a computer), or use − / +. Drag to scroll back in time; tap a candle for its prices and any signal on it.
- **Buy and sell signals** (`www/signals.js`, from the Master Trader Manual lessons 6–20) are written on every interval and follow the position: one green **BUY** label under the candle that opens a trade, then nothing until its orange **SELL** (a sell signal or the 3× ATR trailing stop from lesson 20), then nothing until the next BUY. The labels are exactly the backtest trades.
- **Time axis** along the bottom. Tap anywhere on the chart to mark that moment: the timestamp is highlighted on the time axis and the price under your finger on the right-hand scale (✕ clears it). Turn them off with *Signals on/off*.
- **Price scale** on the right side of every candle chart.
- **Backtest in view:** a summary sits right under the chart (tap *Results ↓* for the full card at the bottom of the page). In full screen the backtest results sit below the chart in portrait, and in a panel on the left with the price chart on the right in landscape.

| Lesson | Signal | Rule as coded |
| --- | --- | --- |
| 6 | Breakout | Close above the prior 20-bar high on volume > 1.5× the 20-bar average |
| 7 | MA pullback | Price and EMA20 above SMA50; the bar dips to EMA20 and closes green above it |
| 8 | VWAP hold | Intraday only: after 3 bars above session VWAP, price tags VWAP and closes green above it |
| 9 | RSI bullish divergence | Lower swing low with a higher RSI(14) low under 40 |
| 10 | Bull flag | Pole ≥ 3× ATR within 6 bars, 3–10 bar flag holding the top half, close above the flag |
| 11 | Golden cross | SMA50 crosses above SMA200 |
| 12 | POC reclaim | Close back above the prior 50 bars' volume-profile point of control on above-average volume |
| 13 | Opening-range breakout | 1–5 minute bars: first close above the first 30 minutes' high on above-average volume |
| 14 | Climax top | After RSI > 70 or 8% above SMA50: range > 2× ATR, volume > 2.5×, close in the lower half |
| 15 | Support breakdown | Close below the prior 20-bar low on volume > 1.5× average |
| 16 | RSI bearish divergence | Higher swing high with a lower RSI(14) high above 60 |
| 17 | Death cross | SMA50 crosses below SMA200 |
| 18 | Failed breakout | Within 3 bars of a 20-bar breakout, a close back below the old high |
| 19 | VWAP distribution | Intraday only: after 3 bars above VWAP, a red close below it on 1.2× volume |
| 20 | ATR trailing stop | Exit 3× ATR(14) below the highest close since entry |

**Backtest** (bottom of each ticker page, for the interval selected on the chart): long only; buy at the next candle's open after any buy signal, sell at the next open after any sell signal or when the trailing stop is hit; 0.05% per side for costs. It reports strategy vs. buy-and-hold return, trades, win rate, average trade, profit factor, max drawdown, average hold, an equity curve, the open trade, the last 5 trades, and for each signal how often price moved its way 10 candles later. Samples are small (the snapshot holds about 1 day of 1-minute bars, 5 days of 5-minute bars, 3 months of hourly bars, 2 years of daily bars and 5 years of weekly bars), so treat results as a sanity check, not proof.

## Strategy scanners (Premium)

Five toggles in the Scanner, one active at a time (scalping, short-term swing, medium-term swing, position/trend, multi-year value) apply the criteria from the strategy playbook. Criteria that need data free sources don't provide (float, VWAP) are listed and skipped; fundamental criteria need the `SEC_USER_AGENT` secret.

## Your data and syncing across devices

Signed out, lots, theses, the watchlist and settings stay on the device. Signed in, they sync through your account, so the iPhone app, the Android app and the website show the same thing with the same login:

- Synced: lots (with theses, pinned evidence, targets, closed trades and sell reasons), watchlist and watchlist theses, scanner screens and strategy toggles, muted sources, Signal Mode, Top performers, portfolio chart range, default candle interval, chart signals on/off, feed filter, briefing picks. Notification permission stays per device.
- When: right after a change (about 1 second), when you sign in, when the app opens or comes back to the front, and every 30 seconds while it's open.
- Conflicts: each setting keeps its latest change; lots merge one by one (newest edit wins, deletions carry over), so edits made on two devices at once don't overwrite each other. Data already on a device when you first sign in is merged into the account, not thrown away.
- Storage: one private row per member in `public.user_state` (row-level security: only you can read or write yours). Run the updated `supabase/schema.sql` once more to add it.

### Syncing in the one-file Converge page (claude.ai)

The page published on claude.ai syncs through the viewer's Claude login instead of a Converge account: it keeps one private record per person (the `db` + `user` page capabilities, path `data/users/<id>/state`) that only that person can read. Opening the page on any device signed in to the same Claude account shows the same lots, theses, watchlist and settings; holdings entered before sync existed are uploaded the first time the page is opened on that device. The page also includes daily charts for the indexes, popular ETFs and the 100 largest stocks (`data-out/hist/` at build time).

### Copy my data / Import data

Works in every version, with or without accounts: *Copy my data* gives a block of text; *Import data* on another device merges it in (lots keep their newest edit, nothing is deleted). Handy for moving holdings into the apps before Supabase is set up.

### Account & settings (gear icon)

Profile (display name, email, password), sign out, sign out and clear this device, sync status and *Sync now*, plan and subscription (upgrade, manage or cancel via `PREMIUM_PORTAL_URL`, refresh plan), all preferences, muted sources, export your data as JSON, erase everywhere, and delete account (removes your account, synced data, plan and posts). The sign-in sheet has *Forgot password?*; the reset link signs you in and opens this screen to set a new password. In Supabase, add your site to Authentication → URL Configuration → Redirect URLs.

### Parity tests

`scripts/test/parity.mjs` signs one account in on five simulated devices (iPhone SE and iPhone Pro Max running the iOS app code path, Pixel 7 running the Android app code path, iPad and desktop as the website), checks that lots, theses, watchlist, settings and portfolio value match, that changes and deletions flow between them, that another account sees none of it, and that every tab fits each screen without sideways scrolling. `scripts/test/sync-unit.cjs` covers the merge rules.

## Development

```bash
npm install
npm run test:pipeline        # run the data pipeline against offline mock sources
node scripts/prepare-web.mjs # fonts, icons, bundled data copy
npm run serve                # http://localhost:8080
```

The app is plain JavaScript (`www/app.js`, `www/styles.css`) with no build step. Native shells are generated in CI with Capacitor 8 (`npx cap add android|ios`).
