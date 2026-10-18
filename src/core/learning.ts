import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { updatePersonModel, loadPersonModel } from "./person-model.js";
import { logger } from "../utils/logger.js";

export type LearningEventType =
  | "approval"
  | "rejection"
  | "engagement"
  | "publish_success"
  | "publish_failure";

export function recordLearningEvent(
  eventType: LearningEventType,
  payload: Record<string, unknown> = {},
  draftId?: string
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO learning_events (id, draft_id, event_type, payload_json)
     VALUES (?, ?, ?, ?)`
  ).run(uuid(), draftId ?? null, eventType, JSON.stringify(payload));
}

export function runLearningPass() {
  const db = getDb();
  const recent = db
    .prepare(
      `SELECT event_type, payload_json, draft_id
       FROM learning_events
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all() as Array<{ event_type: string; payload_json: string; draft_id: string | null }>;

  if (recent.length === 0) {
    logger.debug("No learning events yet");
    return;
  }

  const model = loadPersonModel();
  const prefs = { ...(model.preferences as Record<string, any>) };
  const traits = { ...model.traits };

  let approvals = 0;
  let rejections = 0;

  for (const ev of recent) {
    const payload = JSON.parse(ev.payload_json || "{}");
    if (ev.event_type === "approval") {
      approvals++;
      const platform = payload.platform as string | undefined;
      if (platform) {
        prefs[`platform_weight_${platform}`] =
          (prefs[`platform_weight_${platform}`] || 1) + 0.05;
      }
    } else if (ev.event_type === "rejection") {
      rejections++;
      const platform = payload.platform as string | undefined;
      if (platform) {
        prefs[`platform_weight_${platform}`] = Math.max(
          0.1,
          (prefs[`platform_weight_${platform}`] || 1) - 0.08
        );
      }
      if (payload.reason) {
        traits.last_rejection_note = String(payload.reason).slice(0, 200);
      }
    } else if (ev.event_type === "engagement") {
      const score = Number(payload.score || 0);
      const platform = payload.platform as string | undefined;
      if (platform && score > 0) {
        prefs[`platform_weight_${platform}`] =
          (prefs[`platform_weight_${platform}`] || 1) + Math.min(0.15, score / 100);
      }
    }
  }

  const total = approvals + rejections;
  if (total > 5) {
    const rate = approvals / total;
    traits.approval_rate = Number(rate.toFixed(2));
  }

  updatePersonModel({ preferences: prefs, traits });
  logger.info("Learning pass completed", { approvals, rejections });
}
