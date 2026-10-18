import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { recordLearningEvent } from "../core/learning.js";
import { getAdapter, PlatformName, ContentPayload } from "../platforms/index.js";
import { env } from "../config/env.js";

export type DraftStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "failed"
  | "expired";

export interface Draft {
  id: string;
  platform: PlatformName;
  contentType: string;
  payload: ContentPayload;
  rationale?: string;
  opportunityId?: string;
  status: DraftStatus;
  scheduledFor?: string;
  createdAt: string;
  decidedAt?: string;
  publishedAt?: string;
  errorMessage?: string;
}

export function createDraft(
  platform: PlatformName,
  payload: ContentPayload,
  rationale?: string,
  contentType = "post",
  opportunityId?: string
): Draft {
  const id = uuid();
  const db = getDb();
  db.prepare(
    `INSERT INTO drafts (id, platform, content_type, payload_json, rationale, opportunity_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    platform,
    contentType,
    JSON.stringify(payload),
    rationale ?? null,
    opportunityId ?? null
  );

  logger.info(`Draft created: ${id} for ${platform}`);
  return getDraft(id)!;
}

export function getDraft(id: string): Draft | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return mapRow(row);
}

export function listPendingDrafts(): Draft[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM drafts WHERE status = 'pending' ORDER BY created_at DESC`
    )
    .all() as any[];
  return rows.map(mapRow);
}

export function listScheduledDrafts(): Draft[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM drafts WHERE status = 'scheduled' ORDER BY scheduled_for ASC`
    )
    .all() as any[];
  return rows.map(mapRow);
}

export function listDrafts(limit = 50): Draft[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM drafts ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as any[];
  return rows.map(mapRow);
}

function mapRow(row: any): Draft {
  return {
    id: row.id,
    platform: row.platform,
    contentType: row.content_type,
    payload: JSON.parse(row.payload_json),
    rationale: row.rationale ?? undefined,
    opportunityId: row.opportunity_id ?? undefined,
    status: row.status,
    scheduledFor: row.scheduled_for ?? undefined,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

export function approveDraft(id: string): Draft {
  const draft = getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "scheduled") {
    throw new Error(`Cannot approve status: ${draft.status}`);
  }

  const db = getDb();
  db.prepare(
    `UPDATE drafts SET status = 'approved', decided_at = datetime('now') WHERE id = ?`
  ).run(id);

  recordLearningEvent("approval", { platform: draft.platform }, id);
  logger.info(`Draft approved: ${id}`);
  return getDraft(id)!;
}

export function rejectDraft(id: string, reason?: string): Draft {
  const draft = getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "scheduled") {
    throw new Error(`Cannot reject status: ${draft.status}`);
  }

  const db = getDb();
  db.prepare(
    `UPDATE drafts SET status = 'rejected', decided_at = datetime('now'), error_message = ? WHERE id = ?`
  ).run(reason ?? null, id);

  recordLearningEvent("rejection", { platform: draft.platform, reason }, id);
  logger.info(`Draft rejected: ${id}`);
  return getDraft(id)!;
}

export function scheduleDraft(id: string, scheduledFor: string): Draft {
  const draft = getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "approved") {
    throw new Error(`Cannot schedule status: ${draft.status}`);
  }

  const db = getDb();
  db.prepare(
    `UPDATE drafts SET status = 'scheduled', scheduled_for = ?, decided_at = datetime('now') WHERE id = ?`
  ).run(scheduledFor, id);

  logger.info(`Draft scheduled: ${id} → ${scheduledFor}`);
  return getDraft(id)!;
}

export function updateDraftPayload(id: string, payload: ContentPayload): Draft {
  const draft = getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending") throw new Error("Can only edit pending drafts");

  const db = getDb();
  db.prepare(`UPDATE drafts SET payload_json = ? WHERE id = ?`).run(
    JSON.stringify(payload),
    id
  );
  return getDraft(id)!;
}

export async function publishApprovedDraft(id: string): Promise<Draft> {
  const draft = getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "approved" && draft.status !== "scheduled") {
    throw new Error(
      `Draft must be approved or scheduled before publish (current: ${draft.status})`
    );
  }

  const adapter = getAdapter(draft.platform);
  const result = await adapter.publish(draft.payload);

  const db = getDb();
  if (result.success) {
    db.prepare(
      `UPDATE drafts SET status = 'published', published_at = datetime('now') WHERE id = ?`
    ).run(id);

    db.prepare(
      `INSERT INTO publications (id, draft_id, platform, external_id, payload_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      id,
      draft.platform,
      result.externalId ?? null,
      JSON.stringify(draft.payload)
    );

    recordLearningEvent(
      "publish_success",
      { platform: draft.platform, externalId: result.externalId },
      id
    );
    logger.info(`Published draft ${id} → ${result.externalId}`);
  } else {
    db.prepare(
      `UPDATE drafts SET status = 'failed', error_message = ? WHERE id = ?`
    ).run(result.error ?? "unknown error", id);
    recordLearningEvent(
      "publish_failure",
      { platform: draft.platform, error: result.error },
      id
    );
    logger.error(`Publish failed for ${id}: ${result.error}`);
  }

  return getDraft(id)!;
}

export function expireOldDrafts() {
  const hours = env.APPROVAL_TIMEOUT_HOURS;
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE drafts SET status = 'expired'
       WHERE status = 'pending'
         AND datetime(created_at, '+' || ? || ' hours') < datetime('now')`
    )
    .run(hours);
  if (result.changes > 0) {
    logger.info(`Expired ${result.changes} old drafts`);
  }
}
