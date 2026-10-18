import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { loadPersonModel, Interest } from "./person-model.js";
import { getTrends, Trend } from "./trend-engine.js";
import { PlatformName } from "../platforms/base.js";
import { logger } from "../utils/logger.js";

export interface ContentOpportunity {
  id: string;
  title: string;
  description?: string;
  platform?: PlatformName;
  trendId?: string;
  interestTags: string[];
  priority: number;
  status: "open" | "drafted" | "dismissed" | "expired";
  createdAt: string;
}

export interface GeneratedPost {
  platform: PlatformName;
  payload: Record<string, unknown>;
  rationale: string;
  opportunityId?: string;
  variations?: Array<Record<string, unknown>>;
}

const PLATFORMS: PlatformName[] = [
  "x",
  "linkedin",
  "instagram",
  "tiktok",
  "reddit",
  "youtube",
];

function pickPlatform(interests: Interest[], preferred?: PlatformName): PlatformName {
  if (preferred) return preferred;
  // Prefer platforms that appear on high-weight interests
  for (const i of interests) {
    if (i.platforms?.length) {
      const p = i.platforms[0] as PlatformName;
      if (PLATFORMS.includes(p)) return p;
    }
  }
  return PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
}

function craftText(
  topic: string,
  voice: ReturnType<typeof loadPersonModel>["voice"],
  voiceStyle: string
): string {
  const openers = {
    direct: `Here's the real take on ${topic}:`,
    humorous: `Nobody asked, but my hot take on ${topic} is:`,
    analytical: `Breaking down ${topic} quickly:`,
    conversational: `Been thinking about ${topic} lately…`,
  };
  const opener =
    openers[voice.tone as keyof typeof openers] || openers.conversational;

  const body =
    voice.lengthBias === "short"
      ? `${opener} Consistency beats intensity. Ship, measure, learn.`
      : voice.lengthBias === "long"
        ? `${opener}\n\nMost people over-index on tactics and under-index on systems. Build a loop you can run every week. Voice: ${voiceStyle}.`
        : `${opener} Focus on the loop, not the single post. Measure what compounds.`;

  if (voice.emojiUsage === "none") return body;
  if (voice.emojiUsage === "heavy") return body + " 🚀🔥💡";
  return body + (voice.emojiUsage === "moderate" ? " ✨" : "");
}

/**
 * Surface content opportunities from trends × interest map.
 */
export function discoverOpportunities(limit = 8): ContentOpportunity[] {
  const model = loadPersonModel();
  const trends = getTrends(12);
  const db = getDb();
  const results: ContentOpportunity[] = [];

  for (const trend of trends.slice(0, limit)) {
    const matchingInterests = model.interests.filter(
      (i) =>
        trend.topic.toLowerCase().includes(i.topic.toLowerCase()) ||
        i.topic.toLowerCase().includes(trend.topic.toLowerCase())
    );
    const priority = Number(
      (
        trend.score * 0.6 +
        (matchingInterests[0]?.weight ?? 0.2) * 0.4
      ).toFixed(3)
    );

    const id = uuid();
    const title = `Post about “${trend.topic}”`;
    const description = matchingInterests.length
      ? `Aligns with your interest in ${matchingInterests.map((i) => i.topic).join(", ")}`
      : `Emerging topic (score ${trend.score})`;

    const interestTags = matchingInterests.map((i) => i.topic);

    db.prepare(
      `INSERT INTO content_opportunities
         (id, title, description, platform, trend_id, interest_tags_json, priority, status)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'open')`
    ).run(
      id,
      title,
      description,
      trend.id,
      JSON.stringify(interestTags),
      priority
    );

    results.push({
      id,
      title,
      description,
      trendId: trend.id,
      interestTags,
      priority,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }

  logger.info(`Discovered ${results.length} content opportunities`);
  return results.sort((a, b) => b.priority - a.priority);
}

export function listOpportunities(status: "open" | "all" = "open"): ContentOpportunity[] {
  const db = getDb();
  const rows =
    status === "open"
      ? (db
          .prepare(
            `SELECT * FROM content_opportunities WHERE status = 'open'
             ORDER BY priority DESC LIMIT 20`
          )
          .all() as any[])
      : (db
          .prepare(
            `SELECT * FROM content_opportunities ORDER BY created_at DESC LIMIT 30`
          )
          .all() as any[]);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    platform: r.platform ?? undefined,
    trendId: r.trend_id ?? undefined,
    interestTags: JSON.parse(r.interest_tags_json || "[]"),
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * Generate a post (and optional variations) grounded in Person Model + optional opportunity.
 */
export function generatePost(opts: {
  platform?: PlatformName;
  topic?: string;
  opportunityId?: string;
  variations?: number;
}): GeneratedPost {
  const model = loadPersonModel();
  let topic = opts.topic;
  let opportunityId = opts.opportunityId;

  if (opportunityId) {
    const db = getDb();
    const opp = db
      .prepare(`SELECT * FROM content_opportunities WHERE id = ?`)
      .get(opportunityId) as any;
    if (opp) {
      topic = topic || opp.title.replace(/^Post about “|”$/g, "");
      db.prepare(
        `UPDATE content_opportunities SET status = 'drafted' WHERE id = ?`
      ).run(opportunityId);
    }
  }

  if (!topic) {
    const trends = getTrends(5);
    topic = trends[0]?.topic || model.interests[0]?.topic || "building in public";
  }

  const platform = pickPlatform(model.interests, opts.platform);
  const text = craftText(topic, model.voice, model.voiceStyle);

  const payload: Record<string, unknown> = { text };

  if (platform === "reddit") {
    payload.title = `Thoughts on ${topic}`;
    payload.subreddit = "productivity";
    payload.text = text;
  } else if (platform === "youtube") {
    payload.title = `${topic} — quick take`;
    payload.description = text;
  } else if (platform === "instagram" || platform === "tiktok") {
    payload.mediaUrl = "https://example.com/placeholder-media.jpg";
  } else if (platform === "linkedin") {
    payload.text = text;
  }

  const variations: Array<Record<string, unknown>> = [];
  const n = opts.variations ?? 0;
  for (let i = 0; i < n; i++) {
    variations.push({
      text: craftText(topic + ` (angle ${i + 1})`, model.voice, model.voiceStyle),
    });
  }

  const rationale = [
    `Topic: ${topic}`,
    `Voice: ${model.voice.tone} / ${model.voiceStyle}`,
    `Platform: ${platform}`,
    opportunityId ? `From opportunity ${opportunityId}` : "Ad-hoc generation",
  ].join(" · ");

  return {
    platform,
    payload,
    rationale,
    opportunityId,
    variations: variations.length ? variations : undefined,
  };
}

/**
 * Create a simple multi-day content plan.
 */
export function createContentPlan(name: string, horizonDays = 7, postsPerDay = 1) {
  const model = loadPersonModel();
  const trends = getTrends(horizonDays * postsPerDay + 3);
  const items: Array<{
    day: number;
    platform: PlatformName;
    topic: string;
    suggestedTimeHour: number;
  }> = [];

  let tIdx = 0;
  for (let d = 0; d < horizonDays; d++) {
    for (let p = 0; p < postsPerDay; p++) {
      const topic = trends[tIdx % trends.length]?.topic || "building in public";
      tIdx++;
      const platform = pickPlatform(model.interests);
      const hour =
        model.behavior.preferredPostHours[
          (d + p) % model.behavior.preferredPostHours.length
        ] ?? 12;
      items.push({ day: d + 1, platform, topic, suggestedTimeHour: hour });
    }
  }

  const id = uuid();
  const db = getDb();
  db.prepare(
    `INSERT INTO content_plans (id, name, horizon_days, items_json, status)
     VALUES (?, ?, ?, ?, 'draft')`
  ).run(id, name, horizonDays, JSON.stringify(items));

  logger.info(`Content plan created: ${id} (${items.length} slots)`);
  return { id, name, horizonDays, items, status: "draft" as const };
}

export function listContentPlans() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM content_plans ORDER BY created_at DESC LIMIT 20`)
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    horizonDays: r.horizon_days,
    items: JSON.parse(r.items_json || "[]"),
    status: r.status,
    createdAt: r.created_at,
  }));
}
