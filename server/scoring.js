export const SCORING_WEIGHTS = {
  volatility: 0.25,
  momentum: 0.25,
  trend: 0.2,
  breadth: 0.2,
  macro: 0.1
};

export const DECISION_THRESHOLDS = {
  swing: { yes: 80, caution: 60 },
  day: { yes: 82, caution: 65 }
};

const SECTOR_NAMES = {
  XLK: "Technology",
  XLF: "Financials",
  XLE: "Energy",
  XLV: "Health Care",
  XLI: "Industrials",
  XLY: "Consumer Disc.",
  XLP: "Consumer Staples",
  XLU: "Utilities",
  XLB: "Materials",
  XLRE: "Real Estate",
  XLC: "Communication"
};

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function latest(chart) {
  return chart?.latest ?? chart?.rows?.at(-1)?.close ?? null;
}

function rows(chart) {
  return chart?.rows ?? [];
}

function closes(chart) {
  return rows(chart).map((row) => row.close).filter(Number.isFinite);
}

function highs(chart) {
  return rows(chart).map((row) => row.high ?? row.close).filter(Number.isFinite);
}

function lows(chart) {
  return rows(chart).map((row) => row.low ?? row.close).filter(Number.isFinite);
}

function volumes(chart) {
  return rows(chart).map((row) => row.volume).filter(Number.isFinite);
}

function sma(values, period) {
  if (!values || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function percentChange(values, lookback) {
  if (!values || values.length <= lookback) return null;
  const current = values.at(-1);
  const previous = values.at(-1 - lookback);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function distancePct(value, basis) {
  if (!Number.isFinite(value) || !Number.isFinite(basis) || basis === 0) return null;
  return ((value - basis) / basis) * 100;
}

function percentileRank(value, values) {
  const clean = values.filter(Number.isFinite);
  if (!Number.isFinite(value) || clean.length === 0) return null;
  const below = clean.filter((item) => item <= value).length;
  return (below / clean.length) * 100;
}

function rsi(values, period = 14) {
  if (!values || values.length <= period) return null;
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < slice.length; index += 1) {
    const change = slice[index] - slice[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;
  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function ema(values, period) {
  if (!values || values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push((values[index] - result[index - 1]) * multiplier + result[index - 1]);
  }
  return result;
}

function linearScore(value, low, high) {
  if (!Number.isFinite(value)) return 50;
  return clamp(((value - low) / (high - low)) * 100);
}

function scoreVixLevel(vix) {
  if (!Number.isFinite(vix)) return 50;
  if (vix <= 14) return 95;
  if (vix <= 17) return 85;
  if (vix <= 20) return 70;
  if (vix <= 24) return 55;
  if (vix <= 30) return 35;
  return 18;
}

function scoreRsi(value) {
  if (!Number.isFinite(value)) return 50;
  if (value >= 45 && value <= 65) return 95;
  if (value > 65 && value <= 72) return 78;
  if (value >= 38 && value < 45) return 65;
  if (value > 72) return 55;
  return 35;
}

function directionFrom(value, positiveIsGood = true, deadband = 0.05) {
  if (!Number.isFinite(value) || Math.abs(value) <= deadband) return "→";
  const up = value > 0;
  if (positiveIsGood) return up ? "↑" : "↓";
  return up ? "↓" : "↑";
}

function qualityLabel(score) {
  if (score >= 75) return "healthy";
  if (score >= 55) return "mixed";
  return "risk-off";
}

function decisionFor(score, mode) {
  const thresholds = DECISION_THRESHOLDS[mode] ?? DECISION_THRESHOLDS.swing;
  if (score >= thresholds.yes) return "YES";
  if (score >= thresholds.caution) return "CAUTION";
  return "NO";
}

function changeFromChart(chart) {
  const value = latest(chart);
  const previous = rows(chart).at(-2)?.close ?? null;
  if (!Number.isFinite(value) || !Number.isFinite(previous) || previous === 0) return null;
  return ((value - previous) / previous) * 100;
}

function maStats(chart) {
  const values = closes(chart);
  const price = latest(chart);
  const ma20 = sma(values, 20);
  const ma50 = sma(values, 50);
  const ma200 = sma(values, 200);

  return {
    price,
    ma20,
    ma50,
    ma200,
    above20: Number.isFinite(price) && Number.isFinite(ma20) ? price > ma20 : null,
    above50: Number.isFinite(price) && Number.isFinite(ma50) ? price > ma50 : null,
    above200: Number.isFinite(price) && Number.isFinite(ma200) ? price > ma200 : null,
    dist20: distancePct(price, ma20),
    dist50: distancePct(price, ma50),
    dist200: distancePct(price, ma200)
  };
}

function buildTicker(symbol, chart, label = symbol) {
  const change = changeFromChart(chart);
  return {
    symbol,
    label,
    price: round(latest(chart), symbol === "^TNX" ? 2 : 2),
    changePercent: round(change, 2),
    direction: directionFrom(change, true, 0.02)
  };
}

function computeVolatility(charts, mode) {
  const vixValues = closes(charts["^VIX"]);
  const vvixValues = closes(charts["^VVIX"]);
  const vix = latest(charts["^VIX"]);
  const vvix = latest(charts["^VVIX"]);
  const vixSlope5d = percentChange(vixValues, 5);
  const vixPercentile = percentileRank(vix, vixValues.slice(-252));
  const vvixSlope5d = percentChange(vvixValues, 5);
  const modePenalty = mode === "day" ? 1.18 : 1;

  let score = scoreVixLevel(vix);
  if (Number.isFinite(vixSlope5d)) {
    if (vixSlope5d > 15) score -= 20 * modePenalty;
    else if (vixSlope5d > 5) score -= 9 * modePenalty;
    else if (vixSlope5d < -6) score += 7;
  }

  if (Number.isFinite(vixPercentile)) {
    if (vixPercentile > 90) score -= 24 * modePenalty;
    else if (vixPercentile > 75) score -= 14 * modePenalty;
    else if (vixPercentile < 35) score += 8;
  }

  if (Number.isFinite(vvix)) {
    if (vvix > 120) score -= 12 * modePenalty;
    else if (vvix > 105) score -= 7 * modePenalty;
    else if (vvix < 85) score += 5;
  }

  const putCallEstimate = Number.isFinite(vix)
    ? clamp(0.72 + vix / 80 + Math.max(0, vixSlope5d ?? 0) / 180, 0.7, 1.35)
    : null;

  return {
    score: round(clamp(score)),
    currentValue: Number.isFinite(vix) ? round(vix, 2) : null,
    direction: directionFrom(vixSlope5d, false, 1),
    interpretation: qualityLabel(score),
    metrics: {
      vix: round(vix, 2),
      vixSlope5d: round(vixSlope5d, 2),
      vixPercentile1y: round(vixPercentile, 1),
      vvix: round(vvix, 2),
      vvixSlope5d: round(vvixSlope5d, 2),
      putCallEstimate: round(putCallEstimate, 2)
    }
  };
}

function computeTrend(charts, mode) {
  const spyStats = maStats(charts.SPY);
  const qqqStats = maStats(charts.QQQ);
  const spyCloses = closes(charts.SPY);
  const spyRsi = rsi(spyCloses, 14);
  const spy5d = percentChange(spyCloses, 5);
  const spy20d = percentChange(spyCloses, 20);
  const dayMode = mode === "day";

  let score = 0;
  score += spyStats.above20 ? 18 : 0;
  score += spyStats.above50 ? 24 : 0;
  score += spyStats.above200 ? 22 : 0;
  score += qqqStats.above50 ? 16 : 0;
  score += scoreRsi(spyRsi) * 0.12;
  score += linearScore(spy20d, -6, 6) * 0.08;

  if (dayMode && Number.isFinite(spy5d)) {
    score += spy5d > 0 ? 4 : -6;
  }

  const aligned =
    spyStats.price > spyStats.ma20 &&
    spyStats.ma20 > spyStats.ma50 &&
    spyStats.ma50 > spyStats.ma200;
  const downtrend =
    spyStats.price < spyStats.ma50 &&
    (spyStats.price < spyStats.ma200 || spyStats.ma50 < spyStats.ma200) &&
    qqqStats.price < qqqStats.ma50;
  const regime = aligned && qqqStats.above50 ? "uptrend" : downtrend ? "downtrend" : "chop";

  return {
    score: round(clamp(score)),
    currentValue: round(spyStats.price, 2),
    direction: directionFrom(spy5d, true, 0.1),
    interpretation: regime,
    metrics: {
      spy: {
        price: round(spyStats.price, 2),
        ma20: round(spyStats.ma20, 2),
        ma50: round(spyStats.ma50, 2),
        ma200: round(spyStats.ma200, 2),
        dist20: round(spyStats.dist20, 2),
        dist50: round(spyStats.dist50, 2),
        dist200: round(spyStats.dist200, 2)
      },
      qqq: {
        price: round(qqqStats.price, 2),
        ma50: round(qqqStats.ma50, 2),
        dist50: round(qqqStats.dist50, 2)
      },
      spyRsi14: round(spyRsi, 1),
      spy5d: round(spy5d, 2),
      spy20d: round(spy20d, 2),
      regime
    }
  };
}

function computeBreadth(charts, universe) {
  const valid = universe
    .map((symbol) => ({ symbol, chart: charts[symbol] }))
    .filter((item) => rows(item.chart).length >= 200);

  const stockStats = valid.map((item) => ({
    symbol: item.symbol,
    stats: maStats(item.chart),
    values: closes(item.chart),
    highValues: highs(item.chart)
  }));

  const count = stockStats.length || 1;
  const pctAbove20 =
    (stockStats.filter((item) => item.stats.above20).length / count) * 100;
  const pctAbove50 =
    (stockStats.filter((item) => item.stats.above50).length / count) * 100;
  const pctAbove200 =
    (stockStats.filter((item) => item.stats.above200).length / count) * 100;

  const advancers = stockStats.filter((item) => percentChange(item.values, 1) > 0).length;
  const decliners = stockStats.filter((item) => percentChange(item.values, 1) < 0).length;
  const advDeclRatio = decliners === 0 ? advancers : advancers / decliners;

  const netAdvances = [];
  for (let offset = 39; offset >= 0; offset -= 1) {
    let net = 0;
    for (const item of stockStats) {
      const values = item.values;
      const index = values.length - 1 - offset;
      if (index <= 0) continue;
      const change = values[index] - values[index - 1];
      if (change > 0) net += 1;
      if (change < 0) net -= 1;
    }
    netAdvances.push(net);
  }

  const adLine21d = netAdvances.slice(-21).reduce((sum, value) => sum + value, 0);
  const oscillatorSeries = ema(netAdvances, 19).map((value, index) => {
    const slow = ema(netAdvances, 39)[index];
    return Number.isFinite(slow) ? value - slow : 0;
  });
  const mcclellanProxy = oscillatorSeries.at(-1) ?? 0;

  const nasdaqProxy = stockStats.filter((item) =>
    ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "AVGO", "AMD", "NFLX", "ADBE", "QCOM", "INTU", "CSCO", "AMAT", "LRCX", "PANW"].includes(
      item.symbol
    )
  );
  const highLowBase = nasdaqProxy.length || 1;
  const newHighs = nasdaqProxy.filter((item) => {
    const value = item.values.at(-1);
    const priorHigh = Math.max(...item.highValues.slice(-253, -1));
    return Number.isFinite(value) && Number.isFinite(priorHigh) && value >= priorHigh;
  }).length;
  const newLows = nasdaqProxy.filter((item) => {
    const value = item.values.at(-1);
    const priorLow = Math.min(...item.values.slice(-253, -1));
    return Number.isFinite(value) && Number.isFinite(priorLow) && value <= priorLow;
  }).length;

  const breadthScore =
    pctAbove20 * 0.25 +
    pctAbove50 * 0.35 +
    pctAbove200 * 0.25 +
    linearScore(advDeclRatio, 0.5, 2.2) * 0.1 +
    linearScore(newHighs - newLows, -highLowBase * 0.2, highLowBase * 0.25) * 0.05;

  return {
    score: round(clamp(breadthScore)),
    currentValue: round(pctAbove50, 1),
    direction: directionFrom(adLine21d, true, 2),
    interpretation: qualityLabel(breadthScore),
    metrics: {
      pctAbove20: round(pctAbove20, 1),
      pctAbove50: round(pctAbove50, 1),
      pctAbove200: round(pctAbove200, 1),
      advancers,
      decliners,
      advDeclRatio: round(advDeclRatio, 2),
      adLine21d,
      nasdaqNewHighs: newHighs,
      nasdaqNewLows: newLows,
      mcclellanProxy: round(mcclellanProxy, 2),
      universeCoverage: `${valid.length}/${universe.length}`,
      sourceNote: "Computed from a liquid S&P/Nasdaq proxy universe when exchange breadth feeds are unavailable."
    }
  };
}

function computeMomentum(charts, universe, sectors) {
  const spyValues = closes(charts.SPY);
  const spy21d = percentChange(spyValues, 21) ?? 0;

  const sectorRows = sectors
    .map((symbol) => {
      const values = closes(charts[symbol]);
      const return5d = percentChange(values, 5);
      const return21d = percentChange(values, 21);
      return {
        symbol,
        name: SECTOR_NAMES[symbol] ?? symbol,
        price: round(latest(charts[symbol]), 2),
        return5d: round(return5d, 2),
        return21d: round(return21d, 2),
        relativeToSpy: round((return21d ?? 0) - spy21d, 2)
      };
    })
    .filter((sector) => Number.isFinite(sector.return21d));

  const sorted = [...sectorRows].sort((a, b) => b.return21d - a.return21d);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();
  const topAvg = top3.reduce((sum, item) => sum + item.return21d, 0) / (top3.length || 1);
  const bottomAvg = bottom3.reduce((sum, item) => sum + item.return21d, 0) / (bottom3.length || 1);
  const spread = topAvg - bottomAvg;
  const positiveSectors = sectorRows.filter((sector) => sector.return21d > 0).length;

  const stockStats = universe
    .map((symbol) => ({ symbol, values: closes(charts[symbol]), highValues: highs(charts[symbol]) }))
    .filter((item) => item.values.length >= 60);
  const higherHighCount = stockStats.filter((item) => {
    const latestHigh = item.highValues.at(-1);
    const priorHigh = Math.max(...item.highValues.slice(-21, -1));
    return Number.isFinite(latestHigh) && Number.isFinite(priorHigh) && latestHigh > priorHigh;
  }).length;
  const higherHighPct = (higherHighCount / (stockStats.length || 1)) * 100;

  const score =
    (positiveSectors / (sectorRows.length || 1)) * 100 * 0.3 +
    linearScore(spy21d, -4, 6) * 0.2 +
    linearScore(topAvg, -2, 8) * 0.18 +
    linearScore(higherHighPct, 5, 28) * 0.22 +
    clamp(100 - Math.abs(spread - 8) * 3, 40, 100) * 0.1;

  return {
    score: round(clamp(score)),
    currentValue: round(spread, 2),
    direction: directionFrom(spy21d, true, 0.2),
    interpretation: qualityLabel(score),
    metrics: {
      spy21d: round(spy21d, 2),
      positiveSectors,
      relativeStrengthSpread: round(spread, 2),
      higherHighPct: round(higherHighPct, 1),
      top3,
      bottom3
    },
    sectors: sectorRows
  };
}

function computeMacro(charts, fomcRisk, mode) {
  const rawTnxValues = closes(charts["^TNX"]);
  const tnxValues = rawTnxValues.map((value) => (value > 15 ? value / 10 : value));
  const dxyValues = closes(charts["DX-Y.NYB"] ?? charts["^DXY"]);
  const tnx = tnxValues.at(-1);
  const tnx5d = percentChange(tnxValues, 5);
  const tnxChangePoints = Number.isFinite(tnx5d) && Number.isFinite(tnx) ? (tnx * tnx5d) / 100 : null;
  const dxy = dxyValues.at(-1);
  const dxy5d = percentChange(dxyValues, 5);
  const modePenalty = mode === "day" ? 1.15 : 1;

  let score = 72;
  if (Number.isFinite(tnxChangePoints)) {
    if (tnxChangePoints > 0.18) score -= 16 * modePenalty;
    else if (tnxChangePoints > 0.08) score -= 8 * modePenalty;
    else if (tnxChangePoints < -0.1) score += 6;
  }

  if (Number.isFinite(dxy5d)) {
    if (dxy5d > 1.2) score -= 12 * modePenalty;
    else if (dxy5d > 0.5) score -= 6 * modePenalty;
    else if (dxy5d < -0.7) score += 5;
  }

  if (fomcRisk?.sameDay) score -= 20;
  else if (fomcRisk?.within72Hours) score -= 10;

  const fedStance =
    (tnxChangePoints ?? 0) > 0.1 && (dxy5d ?? 0) > 0.5
      ? "hawkish"
      : (tnxChangePoints ?? 0) < -0.08 && (dxy5d ?? 0) < -0.4
        ? "dovish"
        : "neutral";
  if (fedStance === "hawkish") score -= 7;
  if (fedStance === "dovish") score += 4;

  return {
    score: round(clamp(score)),
    currentValue: round(tnx, 2),
    direction: directionFrom((tnxChangePoints ?? 0) + (dxy5d ?? 0) / 8, false, 0.02),
    interpretation:
      fomcRisk?.sameDay || fomcRisk?.within72Hours
        ? "event risk"
        : fedStance === "hawkish"
          ? "tightening"
          : fedStance === "dovish"
            ? "supportive"
            : "neutral",
    metrics: {
      tenYearYield: round(tnx, 2),
      tenYear5dChangePoints: round(tnxChangePoints, 2),
      dxy: round(dxy, 2),
      dxy5d: round(dxy5d, 2),
      fedStance,
      fomc: fomcRisk
    }
  };
}

function computeExecutionWindow(charts, universe) {
  const stockStats = universe
    .map((symbol) => ({
      symbol,
      values: closes(charts[symbol]),
      highValues: highs(charts[symbol]),
      lowValues: lows(charts[symbol]),
      volumeValues: volumes(charts[symbol])
    }))
    .filter((item) => item.values.length >= 60);

  let breakoutCandidates = 0;
  let breakoutsHolding = 0;
  let breakoutGain = 0;
  let pullbackCandidates = 0;
  let pullbacksBought = 0;

  for (const item of stockStats) {
    const value = item.values.at(-1);
    const recent = item.values.slice(-6);
    const priorPivot = Math.max(...item.highValues.slice(-31, -6));
    const brokeOut = recent.some((close) => Number.isFinite(close) && close > priorPivot);
    if (brokeOut && Number.isFinite(priorPivot)) {
      breakoutCandidates += 1;
      if (value >= priorPivot * 0.99) {
        breakoutsHolding += 1;
        breakoutGain += ((value - priorPivot) / priorPivot) * 100;
      }
    }

    const ma20 = sma(item.values, 20);
    const recentLow = Math.min(...item.lowValues.slice(-5));
    if (Number.isFinite(ma20) && recentLow <= ma20 * 1.01) {
      pullbackCandidates += 1;
      if (value > ma20 && percentChange(item.values, 2) > 0) {
        pullbacksBought += 1;
      }
    }
  }

  const holdingPct = (breakoutsHolding / (breakoutCandidates || 1)) * 100;
  const averageBreakoutGain = breakoutGain / (breakoutsHolding || 1);
  const pullbackBidPct = (pullbacksBought / (pullbackCandidates || 1)) * 100;

  const spyValues = closes(charts.SPY);
  const qqqValues = closes(charts.QQQ);
  const followThroughInputs = [spyValues, qqqValues].map((values) => {
    const threeDay = percentChange(values, 3);
    const fiveDay = percentChange(values, 5);
    const positiveDays = values
      .slice(-5)
      .map((value, index, slice) => (index === 0 ? 0 : value - slice[index - 1]))
      .filter((change) => change > 0).length;
    return linearScore((threeDay ?? 0) + (fiveDay ?? 0), -2, 4) * 0.6 + (positiveDays / 4) * 100 * 0.4;
  });
  const followThroughScore =
    followThroughInputs.reduce((sum, value) => sum + value, 0) / (followThroughInputs.length || 1);

  const score =
    linearScore(holdingPct, 35, 85) * 0.3 +
    linearScore(averageBreakoutGain, -1, 5) * 0.25 +
    linearScore(pullbackBidPct, 30, 80) * 0.2 +
    followThroughScore * 0.25;

  return {
    score: round(clamp(score)),
    interpretation: qualityLabel(score),
    metrics: {
      breakoutsHoldingPct: round(holdingPct, 1),
      breakoutCandidates,
      breakoutsHolding,
      leadingBreakoutGain: round(averageBreakoutGain, 2),
      pullbacksBoughtPct: round(pullbackBidPct, 1),
      pullbackCandidates,
      followThroughScore: round(followThroughScore, 1),
      sourceNote: "Proxy model using liquid leaders: breakout pivots, post-breakout hold, pullback response, and SPY/QQQ follow-through."
    }
  };
}

function buildSummary({ decision, marketQualityScore, execution, trend, breadth, momentum, volatility, macro }) {
  const regime = trend.metrics.regime;
  const breadthWord =
    breadth.score >= 70 ? "expanding breadth" : breadth.score >= 55 ? "mixed breadth" : "weak breadth";
  const volWord =
    volatility.score >= 75 ? "controlled volatility" : volatility.score >= 55 ? "elevated volatility" : "risk-off volatility";
  const leadership =
    momentum.metrics.top3
      ?.map((sector) => sector.name.toLowerCase())
      .slice(0, 2)
      .join(" and ") || "leadership";
  const executionPhrase =
    execution.score >= 70
      ? "Setups are holding well enough to press quality trades."
      : execution.score >= 50
        ? "Execution is uneven, so size down and demand cleaner pivots."
        : "Breakouts are not proving durable, so protect capital even if the tape looks tempting.";
  const macroPhrase =
    macro.interpretation === "event risk"
      ? "Major macro event risk is close."
      : macro.interpretation === "tightening"
        ? "Rates and dollar pressure are a headwind."
        : "Macro pressure is not the dominant problem.";

  if (decision === "YES") {
    return `Strong ${regime} with ${breadthWord}, ${volWord}, and leadership in ${leadership}. ${executionPhrase} ${macroPhrase}`;
  }

  if (decision === "CAUTION") {
    return `Tradable but selective tape: ${regime}, ${breadthWord}, and ${volWord}. Favor A+ swing setups, reduce size, and keep stops tight. ${executionPhrase}`;
  }

  return `Low-quality trading environment: ${regime}, ${breadthWord}, and ${volWord}. Preserve capital until market quality improves. ${executionPhrase}`;
}

export function buildDashboardModel({ charts, errors, universe, sectors, mode, fomcRisk, generatedAt }) {
  const required = ["SPY", "QQQ", "^VIX"];
  const missingRequired = required.filter((symbol) => !charts[symbol]);
  if (missingRequired.length > 0) {
    throw new Error(`Missing required market data: ${missingRequired.join(", ")}`);
  }

  const volatility = computeVolatility(charts, mode);
  const trend = computeTrend(charts, mode);
  const breadth = computeBreadth(charts, universe);
  const momentum = computeMomentum(charts, universe, sectors);
  const macro = computeMacro(charts, fomcRisk, mode);
  const execution = computeExecutionWindow(charts, universe);

  const categories = {
    volatility,
    momentum,
    trend,
    breadth,
    macro
  };

  const scoreBreakdown = Object.entries(SCORING_WEIGHTS).map(([key, weight]) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    weight: round(weight * 100),
    score: categories[key].score,
    contribution: round(categories[key].score * weight, 1)
  }));

  const marketQualityScore = round(
    scoreBreakdown.reduce((sum, item) => sum + item.contribution, 0)
  );
  const decision = decisionFor(marketQualityScore, mode);
  const alerts = [];

  if (fomcRisk?.sameDay) {
    alerts.push({
      level: "danger",
      title: "FOMC today",
      message: "Policy decision risk is live. Avoid forcing swing entries into the announcement window."
    });
  } else if (fomcRisk?.within72Hours) {
    alerts.push({
      level: "warning",
      title: "FOMC within 72 hours",
      message: "Macro headline risk is elevated. Consider smaller size and faster de-risking."
    });
  }

  const tickerSymbols = [
    ["SPY", "SPY"],
    ["QQQ", "QQQ"],
    ["^VIX", "VIX"],
    ["^VVIX", "VVIX"],
    ["DX-Y.NYB", "DXY"],
    ["^TNX", "10Y"],
    ...sectors.map((symbol) => [symbol, symbol])
  ];

  return {
    appName: "Should I Be Trading?",
    mode,
    generatedAt,
    refreshSeconds: 45,
    cacheTtlSeconds: 30,
    decision,
    marketQualityScore,
    executionWindowScore: execution.score,
    summary: buildSummary({
      decision,
      marketQualityScore,
      execution,
      trend,
      breadth,
      momentum,
      volatility,
      macro
    }),
    alerts,
    tickerTape: tickerSymbols
      .map(([symbol, label]) => (charts[symbol] ? buildTicker(symbol, charts[symbol], label) : null))
      .filter(Boolean),
    panels: [
      {
        key: "volatility",
        title: "Volatility",
        score: volatility.score,
        currentValue: volatility.currentValue,
        valueLabel: "VIX",
        direction: volatility.direction,
        interpretation: volatility.interpretation,
        metrics: volatility.metrics
      },
      {
        key: "trend",
        title: "Trend",
        score: trend.score,
        currentValue: trend.currentValue,
        valueLabel: "SPY",
        direction: trend.direction,
        interpretation: trend.interpretation,
        metrics: trend.metrics
      },
      {
        key: "breadth",
        title: "Breadth",
        score: breadth.score,
        currentValue: breadth.currentValue,
        valueLabel: "% > 50D",
        direction: breadth.direction,
        interpretation: breadth.interpretation,
        metrics: breadth.metrics
      },
      {
        key: "momentum",
        title: "Momentum",
        score: momentum.score,
        currentValue: momentum.currentValue,
        valueLabel: "RS Spread",
        direction: momentum.direction,
        interpretation: momentum.interpretation,
        metrics: momentum.metrics
      },
      {
        key: "macro",
        title: "Macro",
        score: macro.score,
        currentValue: macro.currentValue,
        valueLabel: "10Y",
        direction: macro.direction,
        interpretation: macro.interpretation,
        metrics: macro.metrics
      }
    ],
    scoreBreakdown,
    execution,
    sectors: momentum.sectors.sort((a, b) => b.return21d - a.return21d),
    details: {
      volatility: volatility.metrics,
      trend: trend.metrics,
      breadth: breadth.metrics,
      momentum: momentum.metrics,
      macro: macro.metrics
    },
    formulas: {
      weights: SCORING_WEIGHTS,
      thresholds: DECISION_THRESHOLDS[mode] ?? DECISION_THRESHOLDS.swing,
      decisionLogic: "YES >= threshold.yes; CAUTION >= threshold.caution; otherwise NO.",
      executionWindow:
        "Separate 0-100 score from breakout hold rate, leader gains, pullback bid response, and multi-day SPY/QQQ follow-through."
    },
    dataQuality: {
      provider: "Yahoo Finance chart endpoint via server-side cache",
      missingSymbols: Object.keys(errors),
      errors,
      breadthUniverse: universe.length,
      coverage: breadth.metrics.universeCoverage
    }
  };
}
