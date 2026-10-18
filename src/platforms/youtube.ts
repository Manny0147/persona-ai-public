import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const youtubeAdapter: PlatformAdapter = {
  name: "youtube",

  isConfigured() {
    return Boolean(
      env.YOUTUBE_API_KEY ||
        (env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_REFRESH_TOKEN)
    );
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[YouTube] Dry-run publish", {
        title: payload.title,
        media: payload.mediaUrl,
      });
      return createDryRunResult("youtube", payload);
    }

    try {
      logger.info("[YouTube] Publishing (live mode – implement Data API / resumable upload)");
      return {
        success: true,
        externalId: `yt_live_${Date.now()}`,
        url: "https://www.youtube.com/watch?v=placeholder",
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
