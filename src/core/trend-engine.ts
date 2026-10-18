import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { loadPersonModel } from "./person-model.js";
import { logger } from "../utils/logger.js";

export interface Trend {
  id: string;
  platform?: string;
  topic: string;
  score: number;
  source: string;
  payload: Record<string, unknown>;
  observedAt: string;
  expiresAt?: string;
}

export function refreshTrends(platform?: string): Trend[] {
  const model = loadPersonModel();
  const interestTopics = model.interests.map((i) => i.topic);
  const seedTopics = [
    ...interestTopics,
    "productivity systems",
    "AI agents",
    "creator economy",
    "personal branding",
    "open source",
    "future of work",
  ];

  const unique = [...new Set(seedTopics.map((t) => t.toLowerCase()))];

  const db = getDb();
  db.prepare(
    `UPDATE trends SET expires_at = datetime('now')
     WHERE expires_at IS NULL OR expires_at > datetime('now')`
  ).run();

  const created: Trend[] = [];

  for (const topic of unique.slice(0, 12)) {
    const interest = model.interests.find(
      (i) => i.topic.toLowerCase() === topic
    );
    const base = interest ? interest.weight : 0.35;
    const score = Number((base + Math.random() * 0.4).toFixed(3));

    const id = uuid();
    const payload = {
      synthetic: true,
      relatedInterests: interestTopics.filter((t) =>
        topic.includes(t.toLowerCase()) || t.toLowerCase().includes(topic)
      ),
    };

    db.prepare(
      `INSERT INTO trends (id, platform, topic, score, source, payload_json, expires_at)
       VALUES (?, ?, ?, ?, 'pattern-engine', ?, datetime('now', '+2 days'))`
    ).run(id, platform ?? null, topic, score, JSON.stringify(payload));

    created.push({
      id,
      platform,
      topic,
      score,
      source: "pattern-engine",
      payload,
      observedAt: new Date().toISOString(),
    });
  }

  logger.info(`Trend engine refreshed: ${created.length} topics`);
  return created.sort((a, b) => b.score - a.score);
}

export function getTrends(limit = 15, platform?: string): Trend[] {
  const db = getDb();
  let rows: any[];
  if (platform) {
    rows = db
      .prepare(
        `SELECT * FROM trends
         WHERE (platform = ? OR platform IS NULL)
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY score DESC LIMIT ?`
      )
      .all(platform, limit);
  } else {
    rows = db
      .prepare(
        `SELECT * FROM trends
         WHERE expires_at IS NULL OR expires_at > datetime('now')
         ORDER BY score DESC LIMIT ?`
      )
      .all(limit);
  }

  if (rows.length === 0) {
    return refreshTrends(platform);
  }

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform ?? undefined,
    topic: r.topic,
    score: r.score,
    source: r.source,
    payload: JSON.parse(r.payload_json || "{}"),
    observedAt: r.observed_at,
    expiresAt: r.expires_at ?? undefined,
  }));
}

export function getTopTrendTopics(n = 5): string[] {
  return getTrends(n).map((t) => t.topic);
}
