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

export async function createDraft(
  platform: PlatformName,
  payload: ContentPayload,
  rationale?: string,
  contentType = "post",
  opportunityId?: string
): Promise<Draft> {
  const id = uuid();
  const sql = await getDb();
  await sql`
    INSERT INTO drafts (id, platform, content_type, payload_json, rationale, opportunity_id, status)
    VALUES (${id}, ${platform}, ${contentType}, ${JSON.stringify(payload)}, ${rationale ?? null}, ${opportunityId ?? null}, 'pending')
  `;

  logger.info(`Draft created: ${id} for ${platform}`);
  return (await getDraft(id))!;
}

export async function getDraft(id: string): Promise<Draft | null> {
  const sql = await getDb();
  const rows = await sql`SELECT * FROM drafts WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function listPendingDrafts(): Promise<Draft[]> {
  const sql = await getDb();
  const rows = await sql`SELECT * FROM drafts WHERE status = 'pending' ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function listScheduledDrafts(): Promise<Draft[]> {
  const sql = await getDb();
  const rows = await sql`SELECT * FROM drafts WHERE status = 'scheduled' ORDER BY scheduled_for ASC`;
  return rows.map(mapRow);
}

export async function listDrafts(limit = 50): Promise<Draft[]> {
  const sql = await getDb();
  const rows = await sql`SELECT * FROM drafts ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(mapRow);
}

export async function approveDraft(id: string): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "scheduled") {
    throw new Error(`Cannot approve status: ${draft.status}`);
  }

  const sql = await getDb();
  await sql`UPDATE drafts SET status = 'approved', decided_at = now() WHERE id = ${id}`;

  await recordLearningEvent("approval", { platform: draft.platform }, id);
  logger.info(`Draft approved: ${id}`);
  return (await getDraft(id))!;
}

export async function rejectDraft(id: string, reason?: string): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "scheduled") {
    throw new Error(`Cannot reject status: ${draft.status}`);
  }

  const sql = await getDb();
  await sql`UPDATE drafts SET status = 'rejected', decided_at = now(), error_message = ${reason ?? null} WHERE id = ${id}`;

  await recordLearningEvent("rejection", { platform: draft.platform, reason }, id);
  logger.info(`Draft rejected: ${id}`);
  return (await getDraft(id))!;
}

export async function scheduleDraft(id: string, scheduledFor: string): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending" && draft.status !== "approved") {
    throw new Error(`Cannot schedule status: ${draft.status}`);
  }

  const sql = await getDb();
  await sql`UPDATE drafts SET status = 'scheduled', scheduled_for = ${scheduledFor}, decided_at = now() WHERE id = ${id}`;

  logger.info(`Draft scheduled: ${id} → ${scheduledFor}`);
  return (await getDraft(id))!;
}

export async function updateDraftPayload(id: string, payload: ContentPayload): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending") throw new Error("Can only edit pending drafts");

  const sql = await getDb();
  await sql`UPDATE drafts SET payload_json = ${JSON.stringify(payload)} WHERE id = ${id}`;
  return (await getDraft(id))!;
}

export async function publishApprovedDraft(id: string): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "approved" && draft.status !== "scheduled") {
    throw new Error(
      `Draft must be approved or scheduled before publish (current: ${draft.status})`
    );
  }

  const adapter = getAdapter(draft.platform);
  const result = await adapter.publish(draft.payload);

  const sql = await getDb();
  if (result.success) {
    await sql`UPDATE drafts SET status = 'published', published_at = now() WHERE id = ${id}`;

    await sql`
      INSERT INTO publications (id, draft_id, platform, external_id, payload_json)
      VALUES (${uuid()}, ${id}, ${draft.platform}, ${result.externalId ?? null}, ${JSON.stringify(draft.payload)})
    `;

    await recordLearningEvent(
      "publish_success",
      { platform: draft.platform, externalId: result.externalId },
      id
    );
    logger.info(`Published draft ${id} → ${result.externalId}`);
  } else {
    await sql`UPDATE drafts SET status = 'failed', error_message = ${result.error ?? "unknown error"} WHERE id = ${id}`;
    await recordLearningEvent(
      "publish_failure",
      { platform: draft.platform, error: result.error },
      id
    );
    logger.error(`Publish failed for ${id}: ${result.error}`);
  }

  return (await getDraft(id))!;
}

export async function expireOldDrafts() {
  const hours = env.APPROVAL_TIMEOUT_HOURS;
  const sql = await getDb();
  const result = await sql`
    UPDATE drafts SET status = 'expired'
    WHERE status = 'pending'
      AND created_at + (${hours} || ' hours')::interval < now()
  `;
  if (result.count > 0) {
    logger.info(`Expired ${result.count} old drafts`);
  }
}
