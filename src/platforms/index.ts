import { PlatformAdapter, PlatformName } from "./base.js";
import { xAdapter } from "./x.js";
import { linkedinAdapter } from "./linkedin.js";
import { instagramAdapter } from "./instagram.js";
import { tiktokAdapter } from "./tiktok.js";
import { redditAdapter } from "./reddit.js";
import { youtubeAdapter } from "./youtube.js";

export const adapters: Record<PlatformName, PlatformAdapter> = {
  x: xAdapter,
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  reddit: redditAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(name: PlatformName): PlatformAdapter {
  const adapter = adapters[name];
  if (!adapter) throw new Error(`Unknown platform: ${name}`);
  return adapter;
}

export function listPlatforms() {
  return Object.values(adapters).map((a) => ({
    name: a.name,
    configured: a.isConfigured(),
  }));
}

export * from "./base.js";
