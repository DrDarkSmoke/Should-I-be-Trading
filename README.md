# Should I Be Trading?

Bloomberg Terminal-style market dashboard for swing traders. It serves a React UI and a Node data API from one dev server.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`.

## Scoring Formulas

Market Quality Score is the weighted average of five editable categories in [server/scoring.js](server/scoring.js):

| Category | Weight | Inputs |
| --- | ---: | --- |
| Volatility | 25% | VIX level, 5-day VIX slope, 1-year VIX percentile, VVIX, estimated put/call |
| Momentum | 25% | 21-day SPY return, sector participation, top/bottom sector spread, higher-high participation |
| Trend | 20% | SPY vs 20/50/200-day MAs, QQQ vs 50-day MA, SPY RSI, regime |
| Breadth | 20% | % proxy universe above 20/50/200-day MAs, advance/decline proxy, Nasdaq high/low proxy, McClellan proxy |
| Macro/Liquidity | 10% | 10-year yield level/trend, DXY trend, derived Fed stance, FOMC risk |

Decision thresholds:

| Mode | YES | CAUTION | NO |
| --- | ---: | ---: | ---: |
| Swing | 80-100 | 60-79 | <60 |
| Day | 82-100 | 65-81 | <65 |

Execution Window Score is separate from Market Quality. It scores breakout hold rate, post-breakout leader gains, pullbacks being bought, and multi-day SPY/QQQ follow-through.

## Data Notes

The default no-key provider uses Yahoo Finance chart endpoints behind a 30-second server-side cache. Exchange breadth feeds are not consistently free, so breadth and execution are computed from a liquid S&P/Nasdaq proxy universe and labeled as such in the API response.

## API Recommendations

Free or low-cost starting points:

- [Alpha Vantage](https://www.alphavantage.co/documentation/): equities, FX, technical indicators, limited free tier.
- [Finnhub](https://finnhubio.github.io/): quotes, fundamentals, economic calendar, limited free tier.
- [FRED](https://fred.stlouisfed.org/docs/api/fred/overview.html): rates and macro series from the Federal Reserve Bank of St. Louis.
- [Federal Reserve FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm): official event timing.

Paid upgrade paths:

- [Polygon.io](https://polygon.io/docs/rest/stocks/overview/) or Tiingo/IEX Cloud for reliable intraday equities and broad symbol coverage.
- Nasdaq Data Link for curated macro and alternative datasets.
- Cboe DataShop, ORATS, or OptionMetrics for options breadth, VVIX, and put/call accuracy.
- Bloomberg, FactSet, or Refinitiv for institutional-grade breadth, sectors, and macro calendars.

## API

```http
GET /api/market?mode=swing
GET /api/market?mode=day
```

The response includes decision, market score, execution score, panels, sector heatmap data, alerts, formulas, and data-quality metadata.
