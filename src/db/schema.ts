export const SCHEMA_SQL = `
-- ----------------------------------------------
-- PATTERN ENGINE (Person Model)
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS person_model (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  traits_json TEXT NOT NULL DEFAULT '{}',
  preferences_json TEXT NOT NULL DEFAULT '{}',
  voice_style TEXT NOT NULL DEFAULT 'clear, professional, human',
  voice_json TEXT NOT NULL DEFAULT '{}',
  interests_json TEXT NOT NULL DEFAULT '[]',
  behavior_json TEXT NOT NULL DEFAULT '{}',
  audience_json TEXT NOT NULL DEFAULT '[]',
  goals_json TEXT NOT NULL DEFAULT '[]',
  performance_tiers_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'post',
  payload_json TEXT NOT NULL,
  rationale TEXT,
  opportunity_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'published', 'failed', 'expired')),
  scheduled_for TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  published_at TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  external_id TEXT,
  payload_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  performance_tier TEXT DEFAULT 'unknown',
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_measured_at TEXT,
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE TABLE IF NOT EXISTS trends (
  id TEXT PRIMARY KEY,
  platform TEXT,
  topic TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'internal',
  payload_json TEXT NOT NULL DEFAULT '{}',
  observed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS content_opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT,
  trend_id TEXT,
  interest_tags_json TEXT NOT NULL DEFAULT '[]',
  priority REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'drafted', 'dismissed', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trend_id) REFERENCES trends(id)
);

CREATE TABLE IF NOT EXISTS content_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  horizon_days INTEGER NOT NULL DEFAULT 7,
  items_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  draft_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON drafts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_publications_platform ON publications(platform);
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trends_topic ON trends(topic);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON content_opportunities(status);
`;
