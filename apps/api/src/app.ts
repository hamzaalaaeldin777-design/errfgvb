import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { ensureRuntime } from "./lib/runtime";
import { loadLiveSnapshotMeta } from "./lib/liveSnapshot";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { publicApiRouter } from "./routes/public";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    name: "SportStack API",
    version: "1.0.0",
    docs: "/api/leagues",
    health: "/health",
  });
});

app.get("/health", async (_req, res) => {
  const liveSnapshot = await loadLiveSnapshotMeta();

  try {
    await ensureRuntime();

    return res.json({
      status: "ok",
      service: "sportstack-api",
      timestamp: new Date().toISOString(),
      live_snapshot: liveSnapshot,
    });
  } catch (error) {
    console.error("Health check runtime failure", error);

    return res.status(503).json({
      status: "degraded",
      service: "sportstack-api",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Runtime initialization failed.",
      live_snapshot: liveSnapshot,
    });
  }
});

app.use(async (_req, _res, next) => {
  try {
    await ensureRuntime();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/admin", adminRouter);
app.use("/api", publicApiRouter);

app.use(
  (
    error: Error,
    _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
  ) => {
    console.error(error);
    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({ error: "Internal server error." });
  },
);
