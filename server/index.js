import express from "express";
import { createServer as createViteServer } from "vite";
import { getMarketDashboard } from "./marketService.js";

const app = express();
const port = Number(process.env.PORT ?? 5173);
const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/market", async (request, response) => {
  try {
    const dashboard = await getMarketDashboard(String(request.query.mode ?? "swing"));
    response.setHeader("Cache-Control", "private, max-age=15");
    response.json(dashboard);
  } catch (error) {
    response.status(502).json({
      error: "Market data unavailable",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

if (isProduction) {
  app.use(express.static("dist"));
  app.get("*", (_request, response) => {
    response.sendFile("index.html", { root: "dist" });
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`Should I Be Trading? running at http://localhost:${port}`);
});
