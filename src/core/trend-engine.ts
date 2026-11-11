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

export async function refreshTrends(platform?: string): Promise<Trend[]> {
  const model = await loadPersonModel();
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

  const sql = await getDb();
  await sql`
    UPDATE trends SET expires_at = now()
    WHERE expires_at IS NULL OR expires_at > now()
  `;

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

    await sql`
      INSERT INTO trends (id, platform, topic, score, source, payload_json, expires_at)
      VALUES (${id}, ${platform ?? null}, ${topic}, ${score}, 'pattern-engine', ${JSON.stringify(payload)}, now() + interval '2 days')
    `;

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

export async function getTrends(limit = 15, platform?: string): Promise<Trend[]> {
  const sql = await getDb();
  let rows;
  if (platform) {
    rows = await sql`
      SELECT * FROM trends
      WHERE (platform = ${platform} OR platform IS NULL)
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY score DESC LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT * FROM trends
      WHERE expires_at IS NULL OR expires_at > now()
      ORDER BY score DESC LIMIT ${limit}
    `;
  }

  if (rows.length === 0) {
    return refreshTrends(platform);
  }

  return rows.map((r: any) => ({
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

export async function getTopTrendTopics(n = 5): Promise<string[]> {
  return (await getTrends(n)).map((t) => t.topic);
}
