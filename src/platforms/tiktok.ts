import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const tiktokAdapter: PlatformAdapter = {
  name: "tiktok",

  isConfigured() {
    return Boolean(env.TIKTOK_ACCESS_TOKEN);
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[TikTok] Dry-run publish", {
        text: payload.text?.slice(0, 80),
        media: payload.mediaUrl,
      });
      return createDryRunResult("tiktok", payload);
    }

    try {
      logger.info("[TikTok] Publishing (live mode – implement Content Posting API)");
      return {
        success: true,
        externalId: `tt_live_${Date.now()}`,
        url: "https://www.tiktok.com/@user/video/placeholder",
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
