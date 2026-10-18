import { z } from "zod";
import {
  createDraft,
  listPendingDrafts,
  listScheduledDrafts,
  listDrafts,
  approveDraft,
  rejectDraft,
  publishApprovedDraft,
  getDraft,
  updateDraftPayload,
  scheduleDraft,
} from "../approval/gate.js";
import {
  runCycle,
  getSystemStatus,
  triggerLearning,
  getRecentPosts,
  getAnalyticsSummary,
} from "../core/loop.js";
import {
  loadPersonModel,
  updatePersonModel,
  getProfileSummary,
  upsertInterest,
} from "../core/person-model.js";
import { getTrends, refreshTrends } from "../core/trend-engine.js";
import {
  generatePost,
  discoverOpportunities,
  listOpportunities,
  createContentPlan,
  listContentPlans,
} from "../core/content-engine.js";
import { listPlatforms, PlatformName } from "../platforms/index.js";
import { logger } from "../utils/logger.js";

const platformEnum = z.enum([
  "x",
  "linkedin",
  "instagram",
  "tiktok",
  "reddit",
  "youtube",
]);

/**
 * Expanded MCP tool surface aligned with the original PERSONA-AI vision.
 * Any tool that can result in a public post is gated by the Approval system.
 */
export const tools = {
  // ── Profile / Pattern Engine ──────────────────────────
  get_profile: {
    description: "Get the full Person / Pattern profile summary",
    inputSchema: z.object({}),
    handler: async () => getProfileSummary(),
  },

  get_person_model: {
    description: "Load the complete Person Model (voice, interests, behavior, goals)",
    inputSchema: z.object({}),
    handler: async () => loadPersonModel(),
  },

  update_person_model: {
    description: "Update any part of the Person Model",
    inputSchema: z.object({
      traits: z.record(z.union([z.string(), z.number()])).optional(),
      preferences: z.record(z.unknown()).optional(),
      voiceStyle: z.string().optional(),
      voice: z
        .object({
          tone: z.string().optional(),
          formality: z.number().optional(),
          energy: z.number().optional(),
          emojiUsage: z.enum(["none", "light", "moderate", "heavy"]).optional(),
          lengthBias: z.enum(["short", "medium", "long"]).optional(),
          signaturePhrases: z.array(z.string()).optional(),
        })
        .optional(),
      interests: z
        .array(
          z.object({
            topic: z.string(),
            weight: z.number(),
            platforms: z.array(z.string()).optional(),
          })
        )
        .optional(),
      behavior: z
        .object({
          preferredPostHours: z.array(z.number()).optional(),
          avgPostsPerWeek: z.number().optional(),
          engagementStyle: z
            .enum(["reactive", "proactive", "balanced"])
            .optional(),
          topicCycleDays: z.number().optional(),
        })
        .optional(),
      audience: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
    }),
    handler: async (input: any) => updatePersonModel(input),
  },

  upsert_interest: {
    description: "Add or update a single interest weight in the Interest Map",
    inputSchema: z.object({
      topic: z.string(),
      weight: z.number().min(0).max(1),
      platforms: z.array(z.string()).optional(),
    }),
    handler: async (input: {
      topic: string;
      weight: number;
      platforms?: string[];
    }) => upsertInterest(input.topic, input.weight, input.platforms),
  },

  // ── Observe / Analytics ───────────────────────────────
  get_recent_posts: {
    description: "List recent published posts with metrics",
    inputSchema: z.object({ limit: z.number().optional() }),
    handler: async (input: { limit?: number }) =>
      getRecentPosts(input.limit ?? 10),
  },

  get_analytics: {
    description: "Aggregate analytics summary by platform + recent posts",
    inputSchema: z.object({}),
    handler: async () => getAnalyticsSummary(),
  },

  get_engagement: {
    description: "Alias for recent posts + basic engagement metrics",
    inputSchema: z.object({ limit: z.number().optional() }),
    handler: async (input: { limit?: number }) =>
      getRecentPosts(input.limit ?? 10),
  },

  // ── Trend Engine ──────────────────────────────────────
  get_trends: {
    description: "Get current ranked trends (optionally filtered by platform)",
    inputSchema: z.object({
      limit: z.number().optional(),
      platform: platformEnum.optional(),
    }),
    handler: async (input: { limit?: number; platform?: PlatformName }) =>
      getTrends(input.limit ?? 15, input.platform),
  },

  refresh_trends: {
    description: "Force a trend refresh from the Pattern Engine",
    inputSchema: z.object({ platform: platformEnum.optional() }),
    handler: async (input: { platform?: PlatformName }) =>
      refreshTrends(input.platform),
  },

  // ── Content Engine ────────────────────────────────────
  discover_opportunities: {
    description: "Surface new content opportunities from trends × interests",
    inputSchema: z.object({ limit: z.number().optional() }),
    handler: async (input: { limit?: number }) =>
      discoverOpportunities(input.limit ?? 8),
  },

  list_opportunities: {
    description: "List open (or all) content opportunities",
    inputSchema: z.object({
      status: z.enum(["open", "all"]).optional(),
    }),
    handler: async (input: { status?: "open" | "all" }) =>
      listOpportunities(input.status ?? "open"),
  },

  generate_post: {
    description:
      "Generate a post grounded in Person Model + optional topic/opportunity. Returns payload + rationale; does NOT publish.",
    inputSchema: z.object({
      platform: platformEnum.optional(),
      topic: z.string().optional(),
      opportunityId: z.string().optional(),
      variations: z.number().optional(),
    }),
    handler: async (input: {
      platform?: PlatformName;
      topic?: string;
      opportunityId?: string;
      variations?: number;
    }) => generatePost(input),
  },

  generate_variations: {
    description: "Generate multiple variations for a topic/platform",
    inputSchema: z.object({
      platform: platformEnum.optional(),
      topic: z.string(),
      count: z.number().optional(),
    }),
    handler: async (input: {
      platform?: PlatformName;
      topic: string;
      count?: number;
    }) =>
      generatePost({
        platform: input.platform,
        topic: input.topic,
        variations: input.count ?? 3,
      }),
  },

  create_content_plan: {
    description: "Create a multi-day content plan from trends + behavior model",
    inputSchema: z.object({
      name: z.string(),
      horizonDays: z.number().optional(),
      postsPerDay: z.number().optional(),
    }),
    handler: async (input: {
      name: string;
      horizonDays?: number;
      postsPerDay?: number;
    }) =>
      createContentPlan(
        input.name,
        input.horizonDays ?? 7,
        input.postsPerDay ?? 1
      ),
  },

  list_content_plans: {
    description: "List existing content plans",
    inputSchema: z.object({}),
    handler: async () => listContentPlans(),
  },

  // ── Cycle & Draft lifecycle ───────────────────────────
  run_cycle: {
    description:
      "Run full Observe → Think → Draft cycle. Creates a pending draft that requires approval.",
    inputSchema: z.object({ platform: platformEnum.optional() }),
    handler: async (input: { platform?: PlatformName }) =>
      runCycle(input.platform),
  },

  list_pending_drafts: {
    description: "List drafts waiting for human approval",
    inputSchema: z.object({}),
    handler: async () => listPendingDrafts(),
  },

  list_scheduled_posts: {
    description: "List drafts that are scheduled for future publish",
    inputSchema: z.object({}),
    handler: async () => listScheduledDrafts(),
  },

  get_draft: {
    description: "Get a single draft by ID",
    inputSchema: z.object({ id: z.string() }),
    handler: async (input: { id: string }) => getDraft(input.id),
  },

  list_drafts: {
    description: "List recent drafts (all statuses)",
    inputSchema: z.object({ limit: z.number().optional() }),
    handler: async (input: { limit?: number }) => listDrafts(input.limit ?? 50),
  },

  approve_draft: {
    description: "Approve a pending draft (does not publish yet)",
    inputSchema: z.object({ id: z.string() }),
    handler: async (input: { id: string }) => approveDraft(input.id),
  },

  reject_draft: {
    description: "Reject a pending draft with optional reason",
    inputSchema: z.object({
      id: z.string(),
      reason: z.string().optional(),
    }),
    handler: async (input: { id: string; reason?: string }) =>
      rejectDraft(input.id, input.reason),
  },

  edit_draft: {
    description: "Edit the payload of a pending draft",
    inputSchema: z.object({
      id: z.string(),
      payload: z.record(z.unknown()),
    }),
    handler: async (input: { id: string; payload: any }) =>
      updateDraftPayload(input.id, input.payload),
  },

  schedule_post: {
    description:
      "Schedule an approved or pending draft for a future time (ISO datetime). Still requires later publish.",
    inputSchema: z.object({
      id: z.string(),
      scheduledFor: z.string(),
    }),
    handler: async (input: { id: string; scheduledFor: string }) =>
      scheduleDraft(input.id, input.scheduledFor),
  },

  publish_post: {
    description:
      "Publish an already-approved (or due scheduled) draft. Strict gate: must be approved/scheduled first.",
    inputSchema: z.object({ id: z.string() }),
    handler: async (input: { id: string }) => publishApprovedDraft(input.id),
  },

  create_manual_draft: {
    description: "Manually create a draft (still requires approval before publish)",
    inputSchema: z.object({
      platform: platformEnum,
      payload: z.record(z.unknown()),
      rationale: z.string().optional(),
    }),
    handler: async (input: {
      platform: PlatformName;
      payload: any;
      rationale?: string;
    }) => createDraft(input.platform, input.payload, input.rationale),
  },

  // ── System ────────────────────────────────────────────
  list_platforms: {
    description: "List supported platforms and configuration status",
    inputSchema: z.object({}),
    handler: async () => listPlatforms(),
  },

  get_status: {
    description: "System status: pending, opportunities, trends, person summary",
    inputSchema: z.object({}),
    handler: async () => getSystemStatus(),
  },

  run_learning: {
    description: "Trigger a learning pass over recent approval/engagement events",
    inputSchema: z.object({}),
    handler: async () => {
      triggerLearning();
      return { ok: true };
    },
  },
} as const;

export type ToolName = keyof typeof tools;

export async function callTool(name: string, args: unknown = {}) {
  const tool = tools[name as ToolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid args for ${name}: ${parsed.error.message}`);
  }
  logger.debug(`MCP tool call: ${name}`, parsed.data);
  return tool.handler(parsed.data as any);
}

export function listToolDefinitions() {
  return Object.entries(tools).map(([name, t]) => ({
    name,
    description: t.description,
    // Expose a simple JSON-schema-ish view for clients
    inputSchema: t.inputSchema._def ?? t.inputSchema,
  }));
}
