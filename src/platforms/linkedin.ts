import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  PlatformAdapter,
  ContentPayload,
  PublishResult,
  createDryRunResult,
} from "./base.js";

export const linkedinAdapter: PlatformAdapter = {
  name: "linkedin",

  isConfigured() {
    return Boolean(env.LINKEDIN_ACCESS_TOKEN);
  },

  async publish(payload: ContentPayload): Promise<PublishResult> {
    if (!this.isConfigured() || env.DRY_RUN) {
      logger.info("[LinkedIn] Dry-run publish", { text: payload.text?.slice(0, 80) });
      return createDryRunResult("linkedin", payload);
    }

    try {
      logger.info("[LinkedIn] Publishing (live mode – implement API call)");
      return {
        success: true,
        externalId: `li_live_${Date.now()}`,
        url: "https://www.linkedin.com/feed/update/placeholder",
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
