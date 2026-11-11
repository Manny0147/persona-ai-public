import express from "express";
import cors from "cors";
import path from "path";
import { getDb } from "../src/db/client.js";
import { createMcpRouter } from "../src/mcp/server.js";
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
} from "../src/approval/gate.js";
import {
  runCycle,
  getSystemStatus,
  triggerLearning,
  getRecentPosts,
  getAnalyticsSummary,
} from "../src/core/loop.js";
import { getTrends } from "../src/core/trend-engine.js";
import { listOpportunities, listContentPlans } from "../src/core/content-engine.js";
import { getProfileSummary } from "../src/core/person-model.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const publicDir = path.join(process.cwd(), "public");
app.use("/approve", express.static(publicDir));
app.get("/approve", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use("/mcp", createMcpRouter());

app.get("/health", async (_req, res) => {
  try {
    const sql = await getDb();
    await sql`SELECT 1`;
    res.json({ status: "ok", service: "persona-ai-public", version: "1.1.0", db: "neon" });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/api/status", async (_req, res) => {
  res.json(await getSystemStatus());
});

app.get("/api/drafts/pending", async (_req, res) => {
  res.json(await listPendingDrafts());
});

app.get("/api/drafts/scheduled", async (_req, res) => {
  res.json(await listScheduledDrafts());
});

app.get("/api/drafts", async (_req, res) => {
  res.json(await listDrafts());
});

app.get("/api/drafts/:id", async (req, res) => {
  const d = await getDraft(req.params.id);
  if (!d) return res.status(404).json({ error: "Not found" });
  res.json(d);
});

app.post("/api/drafts/:id/approve", async (req, res) => {
  try {
    const d = await approveDraft(req.params.id);
    res.json(d);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/drafts/:id/reject", async (req, res) => {
  try {
    const d = await rejectDraft(req.params.id, req.body?.reason);
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

app.patch("/api/drafts/:id", async (req, res) => {
  try {
    const d = await updateDraftPayload(req.params.id, req.body?.payload ?? req.body);
    res.json(d);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/cycle", async (_req, res) => {
  try {
    const result = await runCycle();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/learning", async (_req, res) => {
  await triggerLearning();
  res.json({ ok: true });
});

app.post("/api/drafts/:id/schedule", async (req, res) => {
  try {
    const d = await scheduleDraft(req.params.id, req.body?.scheduledFor);
    res.json(d);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/profile", async (_req, res) => {
  res.json(await getProfileSummary());
});

app.get("/api/trends", async (req, res) => {
  const limit = Number(req.query.limit) || 15;
  res.json(await getTrends(limit));
});

app.get("/api/opportunities", async (_req, res) => {
  res.json(await listOpportunities("open"));
});

app.get("/api/plans", async (_req, res) => {
  res.json(await listContentPlans());
});

app.get("/api/analytics", async (_req, res) => {
  res.json(await getAnalyticsSummary());
});

app.get("/api/posts/recent", async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  res.json(await getRecentPosts(limit));
});

export default app;
