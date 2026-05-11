const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const DEFAULT_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 160)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeChart(symbol, result) {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose ?? [];

  const rows = timestamps
    .map((timestamp, index) => {
      const close = toNumber(quote.close?.[index] ?? adjClose[index]);
      const open = toNumber(quote.open?.[index]);
      const high = toNumber(quote.high?.[index]);
      const low = toNumber(quote.low?.[index]);
      const volume = toNumber(quote.volume?.[index]);

      if (!Number.isFinite(close) || close <= 0) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume
      };
    })
    .filter(Boolean);

  const meta = result.meta ?? {};
  const latest = toNumber(meta.regularMarketPrice) ?? rows.at(-1)?.close ?? null;
  const previousClose = toNumber(meta.chartPreviousClose) ?? rows.at(-2)?.close ?? null;

  return {
    symbol,
    latest,
    previousClose,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    marketTime: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null,
    rows
  };
}

export async function getChart(symbol, options = {}) {
  const params = new URLSearchParams({
    range: options.range ?? "1y",
    interval: options.interval ?? "1d",
    events: "history",
    includePrePost: "false",
    includeAdjustedClose: "true"
  });

  const url = `${BASE_URL}/${encodeURIComponent(symbol)}?${params.toString()}`;
  const json = await fetchJson(url, options.timeoutMs);
  const result = json.chart?.result?.[0];
  const error = json.chart?.error;

  if (!result || error) {
    throw new Error(error?.description ?? `No chart data for ${symbol}`);
  }

  const chart = normalizeChart(symbol, result);

  if (chart.rows.length < 20) {
    throw new Error(`Insufficient history for ${symbol}`);
  }

  return chart;
}

export async function getCharts(symbols, options = {}) {
  const concurrency = options.concurrency ?? 6;
  const results = {};
  const errors = {};
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor];
      cursor += 1;

      try {
        results[symbol] = await getChart(symbol, options);
      } catch (error) {
        errors[symbol] = error instanceof Error ? error.message : String(error);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return { results, errors };
}
