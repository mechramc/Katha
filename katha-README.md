# KATHA — The Living Family Wisdom Tree

> *A multi-generational memory transmission system. Every generation deposits their wisdom. Every generation inherits it — at the exact moment they need it.*

**Data Portability Hackathon 2026** · Track 2: AI Companions with Purpose · Murai Labs

---

## What It Does

KATHA ingests personal data from the hackathon dataset personas (or your own exported data), extracts the living wisdom embedded in everyday moments using Claude AI, and structures it into a **Cultural Memory Passport** — a portable, consent-controlled JSON-LD document that a family owns forever.

When a descendant is struggling, grieving, facing a career decision, or questioning their worth — KATHA activates the right ancestor memory at the right moment and delivers it in the ancestor's voice.

**Demo persona: Sunita Rajan (p04)** — 58-year-old AP Chemistry teacher, Round Rock TX, 22 years teaching, supporting adult son through unemployment. Her lifelog entry `ll_0043`:

> *"My son Rohan called. He's been out of work three months now. He sounded okay but his voice does that thing when he's not okay. I sent money I didn't say was coming."*

KATHA extracts this as a Living Memory Object with situational tag `descendant-struggling-silently` and emotional weight 9/10. Years from now, when Rohan's own child is struggling and won't ask for help — KATHA delivers this memory, in Sunita's voice, at exactly that moment.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Anthropic API key
- OpenAI API key (Whisper transcription, optional for voice features)

### 1. Clone and install

```bash
git clone https://github.com/murailabs/katha
cd katha
npm install          # Vault server dependencies
pip install -r requirements.txt  # Ingestion pipeline + Wisdom Engine
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your keys (see Environment Variables below)
```

### 3. Generate vault keys

```bash
cd vault && node scripts/generate-keys.js
# Creates keys/private.pem and keys/public.pem (gitignored)
```

### 4. Start the Vault server

```bash
cd vault && npm start
# Vault running at http://localhost:3001
```

### 5. Ingest the demo persona (Sunita)

```bash
cd ingest
python loader.py --persona ../data/persona_p04/
# Loads lifelog.jsonl + conversations.jsonl + emails.jsonl + social_posts.jsonl
# Deduplicates → extracts LMOs via Claude → assembles passport
# Output: passport written to Vault, passportId printed
```

### 6. Start the Wisdom Engine

```bash
cd engine && uvicorn wisdom_engine:app --port 3002
```

### 7. Start the Dashboard + Globe

```bash
cd dashboard && npm start
# Opens http://localhost:3000
# Navigate to Dashboard → run demo flow
```

### 8. Run the full demo flow

```bash
# In a new terminal:
cd ingest && python demo_flow.py
# Runs: ingest → consent grant → trigger activation → before/after comparison
# Prints the full pipeline output to terminal
```

---

## Environment Variables

```bash
# .env.example

# Anthropic (required)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional — for Whisper voice transcription)
OPENAI_API_KEY=sk-...

# HeyGen (optional — for AI video generation in globe)
HEYGEN_API_KEY=...

# Vault config
VAULT_PORT=3001
VAULT_DB_PATH=./vault/db/katha.sqlite
VAULT_KEYS_DIR=./vault/keys

# Wisdom Engine
ENGINE_PORT=3002
VAULT_URL=http://localhost:3001

# Dashboard
REACT_APP_VAULT_URL=http://localhost:3001
REACT_APP_ENGINE_URL=http://localhost:3002
```

---

## Reproducing the Demo

The 8-minute demo follows this exact sequence:

### Step 1 — Ingest Sunita's data

```bash
python ingest/loader.py --persona data/persona_p04/
# Expected output:
# Loaded 150 lifelog entries → 20 unique after deduplication
# Loaded 7 conversations
# Extracted 12 Living Memory Objects (emotionalWeight >= 6)
# Passport assembled: passport_id = <uuid>
# Situational index built: 8 trigger types mapped
```

### Step 2 — View the Living Memory Globe

Open `http://localhost:3000/globe` — 12 dots in orbital rings, colored by emotional tag. Click the largest red dot (ll_0043, emotionalWeight 9) to see the memory card.

### Step 3 — Run the consent flow

```bash
python demo/consent_demo.py --passport-id <uuid>
# Shows: Agent requests scopes → parent approves → JWT issued
# Prints signed JWT to terminal
```

### Step 4 — Fire the situational trigger

```bash
python demo/trigger_demo.py --trigger descendant-struggling-silently --jwt <token>
# Shows: situationalIndex lookup → LMO retrieved → layered prompt assembled
# Prints: BEFORE (generic response) then AFTER (grounded in Sunita's memories)
```

### Step 5 — Show the audit log + revocation

```bash
curl http://localhost:3001/audit | python -m json.tool
# Shows: every access event with timestamp, agent, scopes

python demo/revoke_demo.py --jti <token-jti>
# Revokes token → fires trigger again → generic response (context gone)
# Re-grants → fires again → Sunita's voice returns
```

### Step 6 — Export the passport

```bash
curl -X POST http://localhost:3001/passport/export > sunita_passport.json
# 4.7KB JSON-LD bundle — self-contained, importable on any KATHA-compatible tool
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Vault | Node.js + Express + SQLite | Passport storage, JWT consent, audit log, 21-endpoint REST API |
| Ingestion | Python 3.11 | JSONL loading, deduplication, LMO extraction, passport assembly |
| LLM | Claude API (`claude-sonnet-4-6`) | Wisdom extraction, LMO classification, story generation |
| 3D Globe | Three.js r128 + React | Living Memory Globe visualization |
| Dashboard | React + Tailwind CSS | Parent consent UI, memory approval, audit log viewer |
| Wisdom Engine | Python FastAPI + Claude API | Situational trigger detection, three-layer prompt assembly |
| Transcription | OpenAI Whisper API | Elder voice recording → text (optional) |
| Video | HeyGen API | Speaking-head video from photo + voice (roadmap feature) |
| Schema | JSON-LD (W3C) | Portable Cultural Memory Passport standard |
| Auth | RS256 JWT | Scoped consent tokens, JWKS endpoint, revocation registry |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                             │
│  lifelog.jsonl  conversations.jsonl  emails.jsonl  social.jsonl │
│  [Own data: Google Takeout, ChatGPT export, Claude export]      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE (Python)                  │
│  loader.py → extractor.py (Claude API) → classifier.py         │
│  → assembler.py → situational_index.py                         │
│                                                                 │
│  Output: Cultural Memory Passport (JSON-LD)                     │
│  - heritage module      - values module                         │
│  - memories[] (LMOs)    - situationalIndex{}                    │
│  - contentBounds        - language module                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PASSPORT VAULT (Node.js)                     │
│  SQLite storage · RS256 JWT consent · Audit log · Revocation   │
│  21 REST endpoints · Local-first (user owns data)              │
└──────┬──────────────────────────────────┬───────────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────┐            ┌─────────────────────────────────┐
│  WISDOM ENGINE   │            │       PARENT DASHBOARD          │
│  (FastAPI)       │            │       (React + Tailwind)        │
│                  │            │                                 │
│  Trigger detect  │            │  Memory review & approval       │
│  Index lookup    │            │  Consent grant/revoke UI        │
│  Prompt builder  │            │  Plain-language scope labels    │
│  Claude story    │            │  Audit log viewer               │
│  Delivery log    │            │  Passport export/import         │
└──────────────────┘            └─────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               LIVING MEMORY GLOBE (Three.js)                    │
│  3D orbital visualization · Dots sized by emotionalWeight       │
│  Colored by emotional tag · Click → memory card hover          │
│  AI video player (HeyGen) · Generation ring orbits             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Datasets Used

| Dataset | Source | How Used |
|---------|--------|---------|
| Persona p04 — Sunita Rajan (PRIMARY) | Data Portability Hackathon 2026 — synthetic | Full ingestion pipeline demo. All 7 files ingested: lifelog, conversations, emails, calendar, social_posts, transactions, files_index. |
| Persona p03 — Darius Webb | Data Portability Hackathon 2026 — synthetic | Departed elder reconstruction demo. Shows KATHA working when the elder is not available to record directly. |
| Persona p01 — Jordan Lee | Data Portability Hackathon 2026 — synthetic | Parent generation consent flow validation. Privacy-medium profile tests dashboard UX. |
| Google Takeout (own data) | Personal export via takeout.google.com | Own-data path demo. Normalizes Gmail + Calendar to JSONL schema matching persona format. Same pipeline, real data. |
| ChatGPT export (own data) | Personal export via chat.openai.com settings | Ingestion adapter demo. Conversation history normalized and extracted via same Claude extraction prompt. |

All synthetic persona data is used under the hackathon's `allowed_uses: ["hackathon_demo", "local_analysis"]` terms. All own-data processed locally. No raw personal data transmitted to external APIs — only extracted text snippets sent to Claude.

---

## Known Limitations & Next Steps

### Current Limitations

- **Video generation is a roadmap feature** — The globe displays static memory cards. HeyGen integration is scaffolded but not live in the demo. Pre-generated videos available as demo assets.
- **Elder voice recording** — Whisper transcription is integrated but the elder mobile app (iOS) is not built for this sprint. Voice upload via dashboard only.
- **Single family** — The current vault stores one passport. Multi-family support (family tree joining, sibling branches) is designed but not implemented.
- **Departed elder reconstruction** — The questionnaire flow is designed (see `engine/reconstruction_wizard.py`) but the full conversational interface is not built. Produces a draft proxy passport from structured input.
- **Bilingual output** — Tamil + English code-switching in wisdom delivery is designed and tested in prompts but not exposed in the dashboard UI yet.

### Immediate Next Steps (post-hackathon)

1. Elder iOS app — one-button record, voice → LMO pipeline, family notification
2. Multi-family vault — family tree nodes, generational branching, sibling access patterns
3. Full bilingual delivery — Tamil output for Tamil-speaking descendants
4. HeyGen video integration — speaking-head video for each high-weight LMO
5. Submit Cultural Memory Passport schema to DTI as a proposed DTP data type

### Company Roadmap

- **H1 (0–6 months)**: Open-source schema. Tamil beta. 1,000 families.
- **H2 (6–18 months)**: KATHA Pro hosted. Elder app. $8/family/month.
- **H3 (18–36 months)**: Second culture (Korean diaspora). Apple Vision Pro spatial video.
- **H4 (36–60 months)**: W3C/DTI standard submission. 10+ diaspora communities.

---

## Team

| Name | Role | Contact |
|------|------|---------|
| Ramchand | Founder, Architecture, AI Engineering | @murailabs |

---

## License

- Application code: MIT
- Cultural Memory Passport schema (`/schema/`): Apache-2.0
- Hackathon dataset personas: Used under hackathon terms only, not included in repo

---

## The Core Insight

Most tools use personal data to optimize the person who generated it. KATHA is the first system that uses personal data to serve the *next* generation.

Sunita's lifelog is not a productivity dataset. It is a wisdom archive. She just needed someone to ask the right question.

> *"The compound interest of human wisdom, growing indefinitely, never lost again."*
