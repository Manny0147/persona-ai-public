import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import {
  loadPersonModel,
  describePersonModel,
  getProfileSummary,
} from "./person-model.js";
import { runLearningPass } from "./learning.js";
import { refreshTrends, getTrends } from "./trend-engine.js";
import {
  discoverOpportunities,
  generatePost,
  listOpportunities,
} from "./content-engine.js";
import {
  createDraft,
  expireOldDrafts,
  listPendingDrafts,
} from "../approval/gate.js";
import { PlatformName } from "../platforms/base.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export async function observe() {
  const sql = await getDb();
  const signals: Array<{ source: string; type: string; data: unknown }> = [
    {
      source: "system",
      type: "heartbeat",
      data: { at: new Date().toISOString() },
    },
  ];

  const trends = await refreshTrends();
  signals.push({
    source: "trend-engine",
    type: "trends_refreshed",
    data: { count: trends.length, top: trends.slice(0, 3).map((t) => t.topic) },
  });

  for (const s of signals) {
    await sql`
      INSERT INTO observations (id, source, signal_type, payload_json)
      VALUES (${uuid()}, ${s.source}, ${s.type}, ${JSON.stringify(s.data)})
    `;
  }

  return { signals, trends };
}

export async function think(observeResult: Awaited<ReturnType<typeof observe>>) {
  const model = await loadPersonModel();
  const opps = await discoverOpportunities(5);

  return {
    intent: "create_aligned_content",
    topTrends: observeResult.trends.slice(0, 5),
    opportunities: opps,
    personSummary: await getProfileSummary(),
    rationale: `Pattern model voice=${model.voice.tone}; ${opps.length} opportunities from trends.`,
  };
}

export async function draftFromOpportunity(
  opportunityId?: string,
  platform?: PlatformName
) {
  const generated = await generatePost({
    opportunityId,
    platform,
    variations: 2,
  });
  const created = await createDraft(
    generated.platform,
    generated.payload as any,
    generated.rationale,
    "post",
    generated.opportunityId
  );
  return { draft: created, generated };
}

export async function runCycle(platform?: PlatformName) {
  await expireOldDrafts();
  const obs = await observe();
  const thought = await think(obs);

  const bestOpp = thought.opportunities[0];
  const { draft, generated } = await draftFromOpportunity(bestOpp?.id, platform);

  logger.info(
    `Cycle complete → draft ${draft.id} (${draft.platform}) from opportunity ${bestOpp?.id ?? "none"}`
  );

  return {
    draftId: draft.id,
    platform: draft.platform,
    opportunityId: bestOpp?.id,
    rationale: generated.rationale,
    variations: generated.variations,
  };
}

export async function getSystemStatus() {
  const pending = await listPendingDrafts();
  const model = await describePersonModel();
  const trends = await getTrends(5);
  const opps = await listOpportunities("open");
  return {
    pendingApprovals: pending.length,
    openOpportunities: opps.length,
    topTrends: trends.map((t) => ({ topic: t.topic, score: t.score })),
    personModelSummary: model,
    dryRun: env.DRY_RUN,
    approvalRequired: env.APPROVAL_REQUIRED,
  };
}

export async function triggerLearning() {
  await runLearningPass();
}

export async function getRecentPosts(limit = 10) {
  const sql = await getDb();
  const rows = await sql`
    SELECT id, platform, external_id, payload_json, metrics_json, performance_tier, published_at
    FROM publications ORDER BY published_at DESC LIMIT ${limit}
  `;
  return rows.map((r: any) => ({
    id: r.id,
    platform: r.platform,
    externalId: r.external_id,
    payload: JSON.parse(r.payload_json || "{}"),
    metrics: JSON.parse(r.metrics_json || "{}"),
    performanceTier: r.performance_tier,
    publishedAt: r.published_at,
  }));
}

export async function getAnalyticsSummary() {
  const sql = await getDb();
  const byPlatform = await sql`
    SELECT platform, COUNT(*) as count,
           SUM(CASE WHEN performance_tier = 'high' THEN 1 ELSE 0 END) as high_count
    FROM publications GROUP BY platform
  `;
  const recent = await getRecentPosts(20);
  return {
    byPlatform,
    recentCount: recent.length,
    recent,
  };
}
