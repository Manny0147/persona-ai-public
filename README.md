# Persona-AI (Public Edition) v1.1

**Clean, shareable, open-source personal social intelligence system.**

This is the **Public Edition**. Pattern Engine + Trend Engine + Content Engine + strict approval-gated publishing across six platforms. No private adapters, no personal branding, no advanced monetization systems.

---

## Architecture Overview

```
Observe → Pattern Engine → Trend Engine → Content Engine → Draft → Approve → Publish → Measure → Learn
```

### Core Loop
1. **Observe** – Signals + trend refresh
2. **Pattern Engine** – Voice Model · Interest Map · Behavior Model
3. **Trend Engine** – Ranked topics biased by interests
4. **Content Engine** – Opportunities, generate_post, variations, content plans
5. **Draft** – Candidates queued for human approval
6. **Approve / Schedule** – Human-in-the-loop gate (strict)
7. **Publish** – Platform adapters
8. **Measure & Learn** – Metrics → update Pattern Engine

### Components
- **Pattern Engine** – Structured voice, interests, behavior, audience, goals
- **Trend Engine** – Interest-biased trend ranking (no external keys required)
- **Content Engine** – Opportunities + generation + multi-day plans
- **MCP Server** – Expanded tool surface with mandatory approval gates
- **Approval Gate UI** – Mobile-friendly web interface
- **Scheduling** – Schedule approved drafts for later publish
- **SQLite** – Single-file database (Railway volume friendly)
- **Platform Adapters** – X, LinkedIn, Instagram, TikTok, Reddit, YouTube (basic)
- **Railway-ready** – One-click deploy configuration

---

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd persona-ai-public
npm install
```

### 2. Environment
```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Database
```bash
npm run db:init
```

### 4. Run Locally
```bash
npm run dev
```

- API + MCP: `http://localhost:3000`
- Approval Gate UI: `http://localhost:3000/approve`

### 5. Deploy to Railway
1. Connect the repo to Railway
2. Add a volume for `/data` (SQLite persistence)
3. Set environment variables from `.env.example`
4. Deploy

Railway will use the included `railway.toml` and `Procfile`.

---

## Project Structure

```
persona-ai-public/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── railway.toml
├── Procfile
├── public/                 # Approval Gate static UI
│   └── index.html
├── src/
│   ├── index.ts            # Entry point
│   ├── config/
│   │   └── env.ts
│   ├── core/
│   │   ├── loop.ts            # Orchestrator
│   │   ├── person-model.ts    # Pattern Engine
│   │   ├── trend-engine.ts    # Trend Engine
│   │   ├── content-engine.ts  # Content Engine
│   │   └── learning.ts
│   ├── mcp/
│   │   ├── server.ts       # MCP-style tool server
│   │   └── tools.ts
│   ├── platforms/
│   │   ├── base.ts
│   │   ├── x.ts
│   │   ├── linkedin.ts
│   │   ├── instagram.ts
│   │   ├── tiktok.ts
│   │   ├── reddit.ts
│   │   └── youtube.ts
│   ├── db/
│   │   ├── client.ts
│   │   └── schema.ts
│   ├── approval/
│   │   └── gate.ts
│   └── utils/
│       └── logger.ts
└── scripts/
    └── init-db.ts
```

---

## Approval Gate

Every publish action **must** pass through the Approval Gate.

- Drafts appear in the mobile-friendly UI
- You can Approve / Reject / Edit
- Only approved items are executed by platform adapters
- All decisions are logged for the Learning Loop

---

## Platform Support (Public Edition)

| Platform   | Status     | Notes                          |
|------------|------------|--------------------------------|
| X (Twitter)| Basic      | Post, reply, metrics           |
| LinkedIn   | Basic      | Text posts                     |
| Instagram  | Basic      | Caption + media URL            |
| TikTok     | Basic      | Caption + video URL            |
| Reddit     | Basic      | Subreddit posts                |
| YouTube    | Basic      | Title, description, video URL  |

No Facebook, no casino adapters, no streaming, no advanced YouTube OS.

---

## Environment Variables

See `.env.example` for the full list. Critical ones:

- `PORT`
- `DATABASE_PATH`
- `OPENAI_API_KEY` (or compatible)
- Platform API keys / tokens (optional for dry-run mode)

---

## License

MIT – free to use, modify, and share.

---

**This is the Public Edition.**  
For the full private system with additional adapters and features, use the separate private repository.
