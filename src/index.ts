import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { getDb, closeDb } from "./db/client.js";
import { createMcpRouter } from "./mcp/server.js";
import {
  listPendingDrafts,
  listScheduledDrafts,
  listDrafts,
  approveDraft,
  rejectDraft,
  publishApprovedDraft,
  getDraft,
  updateDraftPayload,
  scheduleDraft,
} from "./approval/gate.js";
import {
  runCycle,
  getSystemStatus,
  triggerLearning,
  getRecentPosts,
  getAnalyticsSummary,
} from "./core/loop.js";
import { getTrends } from "./core/trend-engine.js";
import { listOpportunities, listContentPlans } from "./core/content-engine.js";
import { getProfileSummary } from "./core/person-model.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Ensure DB is ready
  getDb();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // Static Approval Gate UI (works from both src/ via tsx and dist/)
  const publicDir = path.join(process.cwd(), "public");
  app.use("/approve", express.static(publicDir));
  app.get("/approve", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // Health
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "persona-ai-public", version: "1.1.0" });
  });

  // MCP-style tools
  app.use("/mcp", createMcpRouter());

  // Convenience REST for Approval Gate UI
  app.get("/api/status", (_req, res) => {
    res.json(getSystemStatus());
  });

  app.get("/api/drafts/pending", (_req, res) => {
    res.json(listPendingDrafts());
  });

  app.get("/api/drafts", (_req, res) => {
    res.json(listDrafts());
  });

  app.get("/api/drafts/:id", (req, res) => {
    const d = getDraft(req.params.id);
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });

  app.post("/api/drafts/:id/approve", (req, res) => {
    try {
      const d = approveDraft(req.params.id);
      res.json(d);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/drafts/:id/reject", (req, res) => {
    try {
      const d = rejectDraft(req.params.id, req.body?.reason);
      res.json(d);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/drafts/:id/publish", async (req, res) => {
    try {
      const d = await publishApprovedDraft(req.params.id);
      res.json(d);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/drafts/:id", (req, res) => {
    try {
      const d = updateDraftPayload(req.params.id, req.body?.payload ?? req.body);
      res.json(d);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/cycle", (_req, res) => {
    try {
      const result = runCycle();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/learning", (_req, res) => {
    triggerLearning();
    res.json({ ok: true });
  });

  app.post("/api/drafts/:id/schedule", (req, res) => {
    try {
      const d = scheduleDraft(req.params.id, req.body?.scheduledFor);
      res.json(d);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/drafts/scheduled", (_req, res) => {
    res.json(listScheduledDrafts());
  });

  app.get("/api/profile", (_req, res) => {
    res.json(getProfileSummary());
  });

  app.get("/api/trends", (req, res) => {
    const limit = Number(req.query.limit) || 15;
    res.json(getTrends(limit));
  });

  app.get("/api/opportunities", (_req, res) => {
    res.json(listOpportunities("open"));
  });

  app.get("/api/plans", (_req, res) => {
    res.json(listContentPlans());
  });

  app.get("/api/analytics", (_req, res) => {
    res.json(getAnalyticsSummary());
  });

  app.get("/api/posts/recent", (req, res) => {
    const limit = Number(req.query.limit) || 10;
    res.json(getRecentPosts(limit));
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`Persona-AI Public Edition listening on :${env.PORT}`);
    logger.info(`Approval Gate UI → http://localhost:${env.PORT}/approve`);
    logger.info(`MCP tools        → http://localhost:${env.PORT}/mcp/tools`);
    logger.info(`Dry-run mode     → ${env.DRY_RUN}`);
  });

  const shutdown = () => {
    logger.info("Shutting down…");
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
