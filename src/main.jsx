import React from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, RefreshCw, RadioTower, Zap } from "lucide-react";
import "./styles.css";

const REFRESH_MS = 45_000;

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return `${formatNumber(value, digits)}%`;
}

function timeAgo(timestamp) {
  if (!timestamp) return "pending";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function useMarketData(mode) {
  const [state, setState] = React.useState({
    data: null,
    error: null,
    loading: true,
    updating: false
  });

  const fetchData = React.useCallback(
    async (manual = false) => {
      setState((current) => ({
        ...current,
        loading: !current.data,
        updating: Boolean(current.data) || manual,
        error: null
      }));

      try {
        const response = await fetch(`/api/market?mode=${mode}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? payload.error ?? "Unable to load market data.");
        }
        setState({ data: payload, error: null, loading: false, updating: false });
      } catch (error) {
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
          loading: false,
          updating: false
        }));
      }
    },
    [mode]
  );

  React.useEffect(() => {
    fetchData();
    const id = window.setInterval(() => fetchData(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchData]);

  return { ...state, refresh: () => fetchData(true) };
}

function Skeleton() {
  return (
    <div className="terminal-shell skeleton-shell">
      <div className="skeleton-line wide" />
      <div className="skeleton-hero" />
      <div className="panel-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="panel skeleton-panel" key={index}>
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
            <div className="skeleton-line tiny" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerTape({ items = [] }) {
  const tape = [...items, ...items];
  return (
    <div className="ticker-frame" aria-label="Market ticker tape">
      <div className="ticker-track">
        {tape.map((item, index) => (
          <span className="ticker-item" key={`${item.symbol}-${index}`}>
            <strong>{item.label}</strong>
            <span>{formatNumber(item.price, item.label === "10Y" ? 2 : 2)}</span>
            <span
              className={classNames(
                "ticker-change",
                item.changePercent >= 0 ? "positive" : "negative"
              )}
            >
              {item.changePercent >= 0 ? "+" : ""}
              {formatPercent(item.changePercent, 2)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TopBar({ data, updating, onRefresh, mode, setMode }) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <div className="brand-kicker">
          <RadioTower size={14} />
          <span>{updating ? "UPDATING" : "LIVE"}</span>
        </div>
        <h1>Should I Be Trading?</h1>
      </div>
      <TickerTape items={data?.tickerTape ?? []} />
      <div className="top-actions">
        <div className="mode-toggle" role="group" aria-label="Trading mode">
          <button
            className={mode === "swing" ? "active" : ""}
            type="button"
            onClick={() => setMode("swing")}
          >
            SWING
          </button>
          <button
            className={mode === "day" ? "active" : ""}
            type="button"
            onClick={() => setMode("day")}
          >
            DAY
          </button>
        </div>
        <div className="updated-at">updated {timeAgo(data?.generatedAt)}</div>
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          aria-label="Refresh market data"
          title="Refresh market data"
        >
          <RefreshCw size={17} className={updating ? "spin" : ""} />
        </button>
      </div>
    </header>
  );
}

function CircularScore({ score, label }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="score-ring-wrap">
      <svg className="score-ring" viewBox="0 0 132 132" role="img" aria-label={`${label} ${score}%`}>
        <circle className="score-ring-bg" cx="66" cy="66" r={radius} />
        <circle
          className="score-ring-value"
          cx="66"
          cy="66"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-text">
        <strong>{score}</strong>
        <span>%</span>
      </div>
    </div>
  );
}

function HeroPanel({ data }) {
  return (
    <section className={classNames("hero-panel", `decision-${data.decision.toLowerCase()}`)}>
      <div className="decision-block">
        <span className="terminal-label">SHOULD I TRADE?</span>
        <div className="decision-badge">{data.decision}</div>
        <p>{data.summary}</p>
      </div>
      <CircularScore score={data.marketQualityScore} label="Market Quality Score" />
      <div className="execution-card">
        <span className="terminal-label">EXECUTION WINDOW</span>
        <div className="execution-score">{data.executionWindowScore}%</div>
        <p>{data.execution.interpretation.toUpperCase()}</p>
        <div className="mini-bars">
          <MetricBar
            label="Breakouts"
            value={data.execution.metrics.breakoutsHoldingPct}
            suffix="%"
          />
          <MetricBar label="Pullbacks" value={data.execution.metrics.pullbacksBoughtPct} suffix="%" />
          <MetricBar label="Follow Thru" value={data.execution.metrics.followThroughScore} suffix="%" />
        </div>
      </div>
    </section>
  );
}

function MetricBar({ label, value, suffix = "" }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return (
    <div className="metric-bar">
      <div className="metric-bar-head">
        <span>{label}</span>
        <strong>
          {formatNumber(value, 1)}
          {suffix}
        </strong>
      </div>
      <div className="metric-track">
        <span style={{ width: `${Math.max(2, Math.min(100, safeValue))}%` }} />
      </div>
    </div>
  );
}

function AlertBanner({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className={classNames("alert-banner", alerts[0].level)}>
      <AlertTriangle size={18} />
      <strong>{alerts[0].title}</strong>
      <span>{alerts[0].message}</span>
    </div>
  );
}

function Panel({ panel }) {
  const metricEntries = Object.entries(panel.metrics ?? {})
    .filter(([, value]) => typeof value !== "object" || value === null)
    .slice(0, 5);

  return (
    <article className="panel">
      <div className="panel-head">
        <span>{panel.title}</span>
        <strong className={`quality-${panel.interpretation.replace(/\s+/g, "-")}`}>
          {panel.interpretation}
        </strong>
      </div>
      <div className="panel-main">
        <div>
          <div className="panel-value">
            {formatNumber(panel.currentValue, 1)}
            <small>{panel.valueLabel}</small>
          </div>
          <div className="panel-direction">{panel.direction}</div>
        </div>
        <CircularScore score={panel.score} label={`${panel.title} score`} />
      </div>
      <dl className="metric-list">
        {metricEntries.map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, " $1").toUpperCase()}</dt>
            <dd>{typeof value === "number" ? formatNumber(value, 2) : String(value ?? "N/A")}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function SectorHeatmap({ sectors }) {
  const maxMagnitude = Math.max(4, ...sectors.map((sector) => Math.abs(sector.return21d ?? 0)));

  return (
    <section className="section-panel sector-panel">
      <div className="section-head">
        <h2>Sector Heatmap</h2>
        <span>21D relative leadership</span>
      </div>
      <div className="sector-list">
        {sectors.map((sector, index) => {
          const width = Math.max(4, (Math.abs(sector.return21d) / maxMagnitude) * 100);
          return (
            <div className="sector-row" key={sector.symbol}>
              <div className="sector-rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="sector-symbol">{sector.symbol}</div>
              <div className="sector-name">{sector.name}</div>
              <div className="sector-bar-track">
                <span
                  className={sector.return21d >= 0 ? "positive-bg" : "negative-bg"}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className={classNames("sector-return", sector.return21d >= 0 ? "positive" : "negative")}>
                {sector.return21d >= 0 ? "+" : ""}
                {formatPercent(sector.return21d, 2)}
              </div>
              <div className={classNames("sector-chip", index < 3 ? "leader" : index > sectors.length - 4 ? "laggard" : "")}>
                {index < 3 ? "LEAD" : index > sectors.length - 4 ? "LAG" : "MID"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreBreakdown({ scores }) {
  return (
    <section className="section-panel">
      <div className="section-head">
        <h2>Scoring Breakdown</h2>
        <span>weighted contribution</span>
      </div>
      <div className="score-table">
        {scores.map((item) => (
          <div className="score-row" key={item.key}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.weight}% weight</span>
            </div>
            <MetricBar label={`${item.score}/100`} value={item.score} />
            <div className="score-contribution">{formatNumber(item.contribution, 1)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TerminalAnalysis({ data }) {
  return (
    <section className="section-panel terminal-analysis">
      <div className="section-head">
        <h2>Terminal Analysis</h2>
        <span>{data.dataQuality.provider}</span>
      </div>
      <p>{data.summary}</p>
      <div className="analysis-grid">
        <div>
          <span>REGIME</span>
          <strong>{data.details.trend.regime.toUpperCase()}</strong>
        </div>
        <div>
          <span>FED STANCE</span>
          <strong>{data.details.macro.fedStance.toUpperCase()}</strong>
        </div>
        <div>
          <span>BREADTH</span>
          <strong>{data.details.breadth.universeCoverage}</strong>
        </div>
        <div>
          <span>CACHE</span>
          <strong>{data.cache.hit ? `${data.cache.ageSeconds}s` : "FRESH"}</strong>
        </div>
      </div>
      {data.dataQuality.missingSymbols.length > 0 && (
        <div className="data-warning">
          Missing: {data.dataQuality.missingSymbols.slice(0, 8).join(", ")}
          {data.dataQuality.missingSymbols.length > 8 ? "..." : ""}
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const [mode, setMode] = React.useState("swing");
  const { data, error, loading, updating, refresh } = useMarketData(mode);
  const [, forceClock] = React.useReducer((value) => value + 1, 0);

  React.useEffect(() => {
    const id = window.setInterval(forceClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (loading && !data) return <Skeleton />;

  return (
    <div className="terminal-shell">
      <TopBar data={data} updating={updating} onRefresh={refresh} mode={mode} setMode={setMode} />
      {error && (
        <div className="alert-banner danger">
          <AlertTriangle size={18} />
          <strong>DATA FEED ERROR</strong>
          <span>{error}</span>
        </div>
      )}
      {data && (
        <>
          <AlertBanner alerts={data.alerts} />
          <HeroPanel data={data} />
          <section className="panel-grid">
            {data.panels.map((panel) => (
              <Panel panel={panel} key={panel.key} />
            ))}
          </section>
          <main className="lower-grid">
            <SectorHeatmap sectors={data.sectors} />
            <div className="right-stack">
              <ScoreBreakdown scores={data.scoreBreakdown} />
              <TerminalAnalysis data={data} />
            </div>
          </main>
        </>
      )}
      <footer className="terminal-footer">
        <span>
          <Activity size={13} /> AUTO-REFRESH 45S
        </span>
        <span>
          <Zap size={13} /> SERVER CACHE 30S
        </span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Dashboard />);
