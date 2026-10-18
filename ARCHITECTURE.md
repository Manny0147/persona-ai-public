# Persona-AI Public Edition v1.1 – Architecture

**Clean, shareable edition.** No private adapters. No personal branding.

---

## Core Loop (expanded)

```
SOCIAL SIGNALS / SYSTEM
        │
        ▼
   ┌─────────┐
   │ Observe │  ← trend refresh, heartbeats, future platform pulls
   └────┬────┘
        ▼
   ┌──────────────────┐
   │ Pattern Engine   │  Voice Model · Interest Map · Behavior Model
   │ (Person Model)   │
   └────┬─────────────┘
        ▼
   ┌─────────────┐
   │ Trend Engine│  ranked topics biased by Interest Map
   └────┬────────┘
        ▼
   ┌─────────────────┐
   │ Content Engine  │  Opportunities → generate_post / variations / plans
   └────┬────────────┘
        ▼
   ┌─────────┐     ┌──────────────────┐
   │  Draft  │ ──► │  Approval Gate   │  (human required)
   └─────────┘     └────────┬─────────┘
                            ▼
                    Approve / Schedule / Reject
                            ▼
                     ┌──────────┐
                     │ Publish  │  platform adapters
                     └────┬─────┘
                          ▼
                     ┌──────────┐
                     │ Measure  │  publications + metrics
                     └────┬─────┘
                          ▼
                     ┌──────────┐
                     │  Learn   │  → updates Pattern Engine
                     └──────────┘
```

---

## Pattern Engine (Person Model)

| Dimension        | Storage              | Purpose                                      |
|------------------|----------------------|----------------------------------------------|
| Voice Model      | `voice_json`         | tone, formality, energy, emoji, length bias  |
| Interest Map     | `interests_json`     | weighted topics + optional platform hints    |
| Behavior Model   | `behavior_json`      | preferred hours, cadence, engagement style   |
| Audience         | `audience_json`      | target segments                              |
| Goals            | `goals_json`         | high-level objectives                        |
| Performance tiers| `performance_tiers_json` | topic/platform → high/average/poor        |

---

## Trend Engine

- `refresh_trends()` seeds / ranks topics from Interest Map + general seeds
- Fully runnable without external API keys (synthetic but interest-biased)
- Ready to swap in real platform trend APIs or external MCP services later

## Content Engine

- **Opportunities** – trend × interest intersections with priority scores
- **generate_post / generate_variations** – grounded in Voice + topic
- **Content plans** – multi-day slots using Behavior Model preferred hours

---

## MCP Tools (Public surface)

### Profile / Pattern
- `get_profile`, `get_person_model`, `update_person_model`, `upsert_interest`

### Observe / Analytics
- `get_recent_posts`, `get_analytics`, `get_engagement`

### Trends
- `get_trends`, `refresh_trends`

### Content
- `discover_opportunities`, `list_opportunities`
- `generate_post`, `generate_variations`
- `create_content_plan`, `list_content_plans`

### Draft lifecycle (gated)
- `run_cycle`, `list_pending_drafts`, `list_scheduled_posts`, `get_draft`, `list_drafts`
- `approve_draft`, `reject_draft`, `edit_draft`
- `schedule_post`, `publish_post`, `create_manual_draft`

### System
- `list_platforms`, `get_status`, `run_learning`

**Rule:** anything that can result in a public post must pass through `approve` (and optionally `schedule`) before `publish_post`.

---

## Database (SQLite)

- `person_model` – single-row Pattern Engine
- `drafts` – full lifecycle including `scheduled`
- `publications` – published items + metrics + performance tier
- `trends` – ranked topics
- `content_opportunities` – open/drafted ideas
- `content_plans` – multi-day plans
- `learning_events`, `observations`, `system_state`

---

## Platforms (Public Edition)

X · LinkedIn · Instagram · TikTok · Reddit · YouTube (basic)  
Dry-run by default. Real keys via env.

---

## Explicitly excluded (private edition only)

Facebook · Stake casino · Kick · Full YouTube Monetization OS · Project RALLY · Project Sovereign · personal branding

---

## Version

**1.1.0** – Pattern + Trend + Content engines, scheduling, expanded MCP tool surface.
