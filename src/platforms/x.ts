import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const xAdapter: PlatformAdapter = {
  name: "x",

  isConfigured() {
    return Boolean(
      env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET
    );
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[X] Dry-run publish", { text: payload.text?.slice(0, 80) });
      return createDryRunResult("x", payload);
    }

    try {
      logger.info("[X] Publishing (live mode – implement API call)");
      return {
        success: true,
        externalId: `x_live_${Date.now()}`,
        url: "https://x.com/i/status/placeholder",
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },

  async fetchMetrics(externalId: string) {
    if (env.DRY_RUN || !this.isConfigured()) {
      return { likes: 0, reposts: 0, replies: 0, impressions: 0 };
    }
    return { likes: 0, reposts: 0, replies: 0, impressions: 0 };
  },
};
