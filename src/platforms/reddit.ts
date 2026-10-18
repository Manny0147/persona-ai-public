import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const redditAdapter: PlatformAdapter = {
  name: "reddit",

  isConfigured() {
    return Boolean(
      env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_REFRESH_TOKEN
    );
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[Reddit] Dry-run publish", {
        subreddit: payload.subreddit,
        title: payload.title,
      });
      return createDryRunResult("reddit", payload);
    }

    try {
      logger.info("[Reddit] Publishing (live mode – implement Reddit API)");
      return {
        success: true,
        externalId: `rd_live_${Date.now()}`,
        url: `https://reddit.com/r/${payload.subreddit || "test"}/comments/placeholder`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
