import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const instagramAdapter: PlatformAdapter = {
  name: "instagram",

  isConfigured() {
    return Boolean(env.INSTAGRAM_ACCESS_TOKEN);
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[Instagram] Dry-run publish", {
        text: payload.text?.slice(0, 80),
        media: payload.mediaUrl,
      });
      return createDryRunResult("instagram", payload);
    }

    try {
      logger.info("[Instagram] Publishing (live mode – implement Graph API)");
      return {
        success: true,
        externalId: `ig_live_${Date.now()}`,
        url: "https://www.instagram.com/p/placeholder",
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
