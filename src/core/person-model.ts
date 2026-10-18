import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";

export interface VoiceModel {
  tone: string;
  formality: number;
  energy: number;
  emojiUsage: "none" | "light" | "moderate" | "heavy";
  lengthBias: "short" | "medium" | "long";
  signaturePhrases: string[];
}

export interface Interest {
  topic: string;
  weight: number;
  lastSeen?: string;
  platforms?: string[];
}

export interface BehaviorModel {
  preferredPostHours: number[];
  avgPostsPerWeek: number;
  engagementStyle: "reactive" | "proactive" | "balanced";
  topicCycleDays: number;
  lastPostAt?: string;
}

export interface PersonModel {
  traits: Record<string, number | string>;
  preferences: Record<string, unknown>;
  voiceStyle: string;
  voice: VoiceModel;
  interests: Interest[];
  behavior: BehaviorModel;
  audience: string[];
  goals: string[];
  performanceTiers: Record<string, "high" | "average" | "poor">;
  updatedAt: string;
}

const DEFAULT_VOICE: VoiceModel = {
  tone: "conversational",
  formality: 0.4,
  energy: 0.6,
  emojiUsage: "light",
  lengthBias: "medium",
  signaturePhrases: [],
};

const DEFAULT_BEHAVIOR: BehaviorModel = {
  preferredPostHours: [9, 12, 18],
  avgPostsPerWeek: 5,
  engagementStyle: "balanced",
  topicCycleDays: 7,
};

export function loadPersonModel(): PersonModel {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT traits_json, preferences_json, voice_style, voice_json,
              interests_json, behavior_json, audience_json, goals_json,
              performance_tiers_json, updated_at
       FROM person_model WHERE id = 1`
    )
    .get() as any;

  return {
    traits: JSON.parse(row.traits_json || "{}"),
    preferences: JSON.parse(row.preferences_json || "{}"),
    voiceStyle: row.voice_style || "clear, professional, human",
    voice: { ...DEFAULT_VOICE, ...JSON.parse(row.voice_json || "{}") },
    interests: JSON.parse(row.interests_json || "[]"),
    behavior: { ...DEFAULT_BEHAVIOR, ...JSON.parse(row.behavior_json || "{}") },
    audience: JSON.parse(row.audience_json || "[]"),
    goals: JSON.parse(row.goals_json || "[]"),
    performanceTiers: JSON.parse(row.performance_tiers_json || "{}"),
    updatedAt: row.updated_at,
  };
}

export function updatePersonModel(partial: Partial<PersonModel>): PersonModel {
  const current = loadPersonModel();
  const next: PersonModel = {
    traits: { ...current.traits, ...(partial.traits || {}) },
    preferences: { ...current.preferences, ...(partial.preferences || {}) },
    voiceStyle: partial.voiceStyle ?? current.voiceStyle,
    voice: { ...current.voice, ...(partial.voice || {}) },
    interests: partial.interests ?? current.interests,
    behavior: { ...current.behavior, ...(partial.behavior || {}) },
    audience: partial.audience ?? current.audience,
    goals: partial.goals ?? current.goals,
    performanceTiers: {
      ...current.performanceTiers,
      ...(partial.performanceTiers || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  const db = getDb();
  db.prepare(
    `UPDATE person_model SET
      traits_json = ?,
      preferences_json = ?,
      voice_style = ?,
      voice_json = ?,
      interests_json = ?,
      behavior_json = ?,
      audience_json = ?,
      goals_json = ?,
      performance_tiers_json = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    JSON.stringify(next.traits),
    JSON.stringify(next.preferences),
    next.voiceStyle,
    JSON.stringify(next.voice),
    JSON.stringify(next.interests),
    JSON.stringify(next.behavior),
    JSON.stringify(next.audience),
    JSON.stringify(next.goals),
    JSON.stringify(next.performanceTiers)
  );

  logger.info("Person / Pattern model updated");
  return next;
}

export function upsertInterest(topic: string, weight: number, platforms?: string[]) {
  const model = loadPersonModel();
  const existing = model.interests.find(
    (i) => i.topic.toLowerCase() === topic.toLowerCase()
  );
  if (existing) {
    existing.weight = Math.max(0, Math.min(1, weight));
    existing.lastSeen = new Date().toISOString();
    if (platforms) existing.platforms = platforms;
  } else {
    model.interests.push({
      topic,
      weight: Math.max(0, Math.min(1, weight)),
      lastSeen: new Date().toISOString(),
      platforms,
    });
  }
  model.interests.sort((a, b) => b.weight - a.weight);
  return updatePersonModel({ interests: model.interests });
}

export function describePersonModel(): string {
  const m = loadPersonModel();
  const topInterests = m.interests
    .slice(0, 5)
    .map((i) => `${i.topic}(${i.weight.toFixed(2)})`)
    .join(", ");
  return [
    `Voice: ${m.voiceStyle} | tone=${m.voice.tone} energy=${m.voice.energy}`,
    `Interests: ${topInterests || "none"}`,
    `Behavior: ~${m.behavior.avgPostsPerWeek}/wk, hours=${m.behavior.preferredPostHours.join(",")}`,
    `Audience: ${m.audience.join(", ") || "general"}`,
    `Goals: ${m.goals.join("; ") || "none set"}`,
  ].join("\n");
}

export function getProfileSummary() {
  const m = loadPersonModel();
  return {
    voice: m.voice,
    voiceStyle: m.voiceStyle,
    topInterests: m.interests.slice(0, 8),
    behavior: m.behavior,
    audience: m.audience,
    goals: m.goals,
    performanceTiers: m.performanceTiers,
  };
}
