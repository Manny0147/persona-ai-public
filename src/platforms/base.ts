export type PlatformName =
  | "x"
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "reddit"
  | "youtube";

export interface ContentPayload {
  text?: string;
  title?: string;
  description?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  subreddit?: string;
  replyToId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  url?: string;
  error?: string;
  raw?: unknown;
}

export interface PlatformAdapter {
  name: PlatformName;
  isConfigured(): boolean;
  publish(payload: ContentPayload): Promise<PublishResult>;
  fetchMetrics?(externalId: string): Promise<Record<string, number>>;
}

export function createDryRunResult(platform: PlatformName, payload: ContentPayload): PublishResult {
  return {
    success: true,
    externalId: `dryrun_${platform}_${Date.now()}`,
    url: `https://example.com/dry-run/${platform}`,
    raw: { dryRun: true, payload },
  };
}
