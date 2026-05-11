import { getFomcRisk } from "./fomcCalendar.js";
import { getCharts } from "./providers/yahoo.js";
import { buildDashboardModel } from "./scoring.js";

const CACHE_MS = 30_000;

export const SECTOR_SYMBOLS = [
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLI",
  "XLY",
  "XLP",
  "XLU",
  "XLB",
  "XLRE",
  "XLC"
];

export const BREADTH_UNIVERSE = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "GOOG",
  "META",
  "AVGO",
  "TSLA",
  "JPM",
  "LLY",
  "V",
  "UNH",
  "XOM",
  "MA",
  "COST",
  "HD",
  "PG",
  "JNJ",
  "NFLX",
  "ABBV",
  "BAC",
  "KO",
  "CRM",
  "WMT",
  "ORCL",
  "MRK",
  "CVX",
  "AMD",
  "PEP",
  "TMO",
  "LIN",
  "ADBE",
  "CSCO",
  "ACN",
  "MCD",
  "IBM",
  "GE",
  "QCOM",
  "WFC",
  "ABT",
  "TXN",
  "INTU",
  "CAT",
  "AMGN",
  "DIS",
  "NOW",
  "PM",
  "ISRG",
  "VZ",
  "MS",
  "GS",
  "RTX",
  "HON",
  "NEE",
  "SPGI",
  "BKNG",
  "LOW",
  "PFE",
  "DHR",
  "AMAT",
  "C",
  "T",
  "BLK",
  "UNP",
  "TJX",
  "CMCSA",
  "COP",
  "BA",
  "ETN",
  "LRCX",
  "SYK",
  "PANW",
  "DE",
  "ADP",
  "GILD"
];

const CORE_SYMBOLS = ["SPY", "QQQ", "^VIX", "^VVIX", "^TNX", "DX-Y.NYB"];
const ALL_SYMBOLS = [...new Set([...CORE_SYMBOLS, ...SECTOR_SYMBOLS, ...BREADTH_UNIVERSE])];
const cache = new Map();

function normalizeMode(mode) {
  return mode === "day" ? "day" : "swing";
}

export async function getMarketDashboard(modeInput = "swing") {
  const mode = normalizeMode(modeInput);
  const key = mode;
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.createdAt < CACHE_MS) {
    return {
      ...cached.payload,
      cache: {
        hit: true,
        ageSeconds: Math.round((now - cached.createdAt) / 1000),
        ttlSeconds: Math.round(CACHE_MS / 1000)
      }
    };
  }

  const [marketData, fomcRisk] = await Promise.all([
    getCharts(ALL_SYMBOLS, { range: "1y", interval: "1d", concurrency: 7 }),
    getFomcRisk(new Date())
  ]);

  const payload = buildDashboardModel({
    charts: marketData.results,
    errors: marketData.errors,
    universe: BREADTH_UNIVERSE,
    sectors: SECTOR_SYMBOLS,
    mode,
    fomcRisk,
    generatedAt: new Date().toISOString()
  });

  cache.set(key, { createdAt: now, payload });

  return {
    ...payload,
    cache: {
      hit: false,
      ageSeconds: 0,
      ttlSeconds: Math.round(CACHE_MS / 1000)
    }
  };
}
