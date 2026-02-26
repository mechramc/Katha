# CLAUDE.md — KATHA Project Configuration

> **This file is loaded into every Claude Code session. Keep it current.**
> Last updated: 2026-02-26

---

## Project Overview

**KATHA** is a multi-generational family wisdom transmission system for the Data Portability Hackathon 2026, Track 2 (AI Companions with Purpose).

**Core Mission:** Extract living wisdom from personal data, structure it into a Cultural Memory Passport (portable JSON-LD), and deliver ancestor memories to descendants at the right moment — grounded in what the ancestor actually wrote, not generative fiction.

**This is NOT a chatbot, RAG system, or journaling app.** It is indexing + consent + delivery infrastructure.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Vault | Node.js 18+ / Express / SQLite | Passport storage, RS256 JWT consent, audit log |
| Ingestion | Python 3.11+ / Pydantic / Anthropic SDK | JSONL → LMO extraction via Claude |
| Wisdom Engine | Python 3.11+ / FastAPI / Uvicorn | Trigger detection, 3-layer prompt assembly, wisdom delivery |
| Globe | React 18 / Three.js r128 | Living Memory Globe (3D visualization) |
| Dashboard | React 18 / Tailwind CSS | Parent consent UI, memory approval, audit viewer |
| Schema | JSON-LD (W3C) | Cultural Memory Passport standard |
| Auth | RS256 JWT / jose | Scoped consent tokens, JWKS, revocation |
| LLM | Claude API (claude-sonnet-4-6) | Wisdom extraction + story generation |

---

## Five Components (DO NOT blur boundaries)

1. **`ingest/`** — Python pipeline: JSONL → LMOs → Passport → Vault API
2. **`vault/`** — Node.js server: storage, auth, consent JWTs, audit log
3. **`globe/`** — React + Three.js: 3D memory visualization
4. **`dashboard/`** — React + Tailwind: parent consent & approval UI
5. **`engine/`** — FastAPI: situational triggers → wisdom delivery

---

## Commands

```bash
# Vault (Node.js)
cd vault && npm install
cd vault && npm start                    # http://localhost:3001

# Ingestion (Python)
pip install -r ingest/requirements.txt
cd ingest && python loader.py --persona ../data/persona_p04/

# Wisdom Engine (Python)
pip install -r engine/requirements.txt
cd engine && uvicorn wisdom_engine:app --port 3002

# Dashboard (React)
cd dashboard && npm install && npm start  # http://localhost:3000

# Full Demo
cd ingest && python demo_flow.py          # Target: < 90 seconds

# Testing Agents (run after each phase)
node tests/test_phase1_vault.js           # CP-1: Vault (13 assertions)
python tests/test_phase2_ingest.py        # CP-2: Ingest (10 assertions)
python tests/test_phase3_engine.py        # CP-3: Engine (14 assertions)
python tests/test_phase4_e2e.py           # CP-4: E2E (16 assertions)

# CI/CD Verification (run after every git push)
bash scripts/verify-push.sh               # Polls GH Actions, reports pass/fail
bash scripts/verify-push.sh main --fix    # Same + prints failed logs for fixing
gh run list --limit 5                      # Quick check recent runs
gh run view <run-id> --log-failed          # Pull failed job logs
```

---

## Code Conventions

### Python (ingest + engine)
- Type hints on every function signature
- Pydantic models for all data structures (no raw dicts crossing boundaries)
- `httpx` for async HTTP
- Docstrings only where logic is non-obvious
- No `print()` — use `logging` module

### JavaScript/Node (vault)
- Express with explicit route files
- `better-sqlite3` (synchronous, no ORM)
- `jose` for JWT (RS256 only, no HS256)
- No `eval()`, no `Function()`, no dynamic requires
- Strict mode everywhere

### React (globe + dashboard)
- React 18+ with functional components and hooks
- Tailwind CSS (no CSS modules, no styled-components)
- No `localStorage` for sensitive data
- Single `useVault()` hook for all vault API calls
- No inline styles except dynamic computed values

### General
- No `any` types — be explicit
- No dead code committed
- No `console.log` in production code
- Prefer small, focused files over large monoliths

---

## 7 Hard Rules (NON-NEGOTIABLE)

1. **Never invent content** — Wisdom extracted from data only, never generated
2. **Never modify audit log** — Append-only, immutable forever
3. **Never skip parent approval** — Every LMO requires human review before entering passport
4. **Never confuse memory types** — Reconstructed vs Recorded must be labeled always
5. **Never over-grant scopes** — Scope intersection mandatory on every request
6. **Never cache revocation** — Check revocation registry on every authenticated call
7. **Never send raw personal data to external APIs** — Only extracted text snippets to Claude

---

## Data Model Quick Reference

### Living Memory Object (LMO)
```json
{
  "memoryId": "uuid",
  "sourceRef": "original JSONL reference",
  "contributor": "person name",
  "emotionalWeight": 8,        // 1-10, only >= 6 enters passport
  "lifeTheme": "sacrifice",
  "situationalTags": ["descendant-struggling-silently"],
  "memory_type": "recorded",   // "recorded" | "reconstructed"
  "text": "extracted wisdom text"
}
```

### Situational Triggers (12 predefined)
`descendant-struggling-silently`, `descendant-considering-quitting`, `descendant-first-failure`, `descendant-leaving-home`, `descendant-becoming-parent`, `descendant-losing-someone`, `descendant-facing-injustice`, `descendant-celebrating-milestone`, `descendant-feeling-alone`, `descendant-questioning-identity`, `descendant-making-sacrifice`, `descendant-seeking-purpose`

### Cultural Memory Passport
Top-level JSON-LD document with: `@context`, `@type`, `heritage`, `values`, `memories[]`, `situationalIndex`

---

## Consent Architecture

- Parent approves LMOs before entering passport (hard gate)
- RS256 JWT with scoped access (no HS256)
- Scope intersection enforced on every request
- Revocation checked on every authenticated call (no caching)
- Every access logged to immutable audit trail
- COPPA compliant, zero retention, no training data

---

## Environment Variables

```
ANTHROPIC_API_KEY=        # Required — Claude API
OPENAI_API_KEY=           # Optional — Whisper transcription
HEYGEN_API_KEY=           # Optional — Video generation (roadmap)
VAULT_PORT=3001
VAULT_DB_PATH=./data/katha.db
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
DASHBOARD_PORT=3000
ENGINE_PORT=3002
```

---

## Success Criteria (Demo)

1. Ingest completes in < 90 seconds for primary persona
2. Globe renders 12 memory dots with orbital animation
3. Revoking consent returns generic response (no leaked data)
4. Re-granting consent returns grounded wisdom
5. Exported passport is valid JSON-LD
6. Full audit trail captured for all operations

---

## Do's and Don'ts

### DO:
- Read AGENTS.md before implementing any component
- Use Pydantic models for all Python data boundaries
- Log every vault access to audit trail
- Distinguish recorded vs reconstructed memories visually
- Test consent flows (grant → access → revoke → verify blocked → re-grant)
- Keep LMO extraction faithful to source data

### DON'T:
- Invent wisdom content not present in source data
- Use raw dicts crossing component boundaries
- Store sensitive data in localStorage
- Skip parent approval flow for any LMO
- Cache JWT revocation status
- Send full JSONL records to Claude API
- Add dependencies without asking first
- Over-engineer — minimal viable for hackathon demo

---

## Lessons Learned (from Blueflame, Agni, and prior projects)

### Wiring Audit (Agni Post-Mortem)
- **Tests passing ≠ feature working.** Always verify components are mounted, wired end-to-end, and reachable by a user.
- After completing a batch of features, audit: Is every component imported and rendered? Is every API handler registered? Do types match across boundaries?

### Scope Creep Prevention
- Minimal changes only — smallest viable change set
- No new tooling without proving necessity
- Present invasive vs non-invasive options before making structural changes

### IPC/API Wiring Checklist
For any new endpoint: route defined → handler implemented → auth middleware applied → registered in server entry point → client SDK updated → UI component calls SDK → audit logging added

### Build Before Polish
- Get the demo flow working end-to-end first
- Polish UI/UX only after core pipeline works
- Don't optimize prematurely — 90-second ingest target is the only perf gate

---

## Boris Cherny Best Practices (Applied)

### 1. Git Worktrees — Parallel Claude Sessions
```bash
# Phase 1: work on main (vault is the foundation)
# Phase 2+3: parallel worktrees
git worktree add "../Katha-ingest" -b feature/ingest-pipeline
git worktree add "../Katha-engine" -b feature/wisdom-engine
# Phase 4: parallel worktrees
git worktree add "../Katha-dashboard" -b feature/dashboard-ui
git worktree add "../Katha-globe" -b feature/globe-viz
```
See `docs/plans/worktree-strategy.md` for full layout + merge order.

### 6. Pre-PR Review Protocol
Before merging any phase, run this prompt in a separate Claude session:
> "Review all changes on this branch critically. Check for: bugs, edge cases, security issues (especially JWT handling, scope intersection, data leaks), AGENTS.md compliance, and the 7 hard rules. Rate confidence 1-10."

### 8. Subagent Strategy for KATHA
- **Phase 1:** Single session (vault is sequential)
- **Phase 2+3:** Two parallel subagents — one for ingest, one for engine
- **Phase 4:** Two parallel subagents — one for dashboard, one for globe
- **Testing:** Dedicated testing agent per phase (runs checkpoint scripts)
- Main agent coordinates, subagents do implementation, return summaries

### Testing Agents (MANDATORY GATES)
Every phase ends with an automated testing agent. **No merge without green.**
```bash
# Phase 1 gate:
node tests/test_phase1_vault.js        # 13 assertions

# Phase 2 gate:
python tests/test_phase2_ingest.py     # 10 assertions

# Phase 3 gate:
python tests/test_phase3_engine.py     # 14 assertions

# Phase 4 gate:
python tests/test_phase4_e2e.py        # 16 assertions + manual browser check
```

### 9. SQLite Direct Query (Debugging)
```bash
# Inspect vault database directly
sqlite3 vault/data/katha.db "SELECT * FROM audit_log ORDER BY id DESC LIMIT 10;"
sqlite3 vault/data/katha.db "SELECT memory_id, emotional_weight, memory_type FROM memories;"
sqlite3 vault/data/katha.db "SELECT jti, revoked FROM consent_tokens;"
```

---

## CI/CD Protocol (MANDATORY)

### GitHub Actions Pipeline
Two workflows in `.github/workflows/`:
- **`ci.yml`** — Runs on every push and PR to `main` or `feature/**`
- **`deploy.yml`** — Runs on push to `main` only (after CI passes)

### CI Jobs (in dependency order)
```
vault-lint → vault-test (CP-1)
                ↓
ingest-lint → ingest-test (CP-2)
                ↓
engine-lint → engine-test (CP-3)
                ↓
           e2e-test (CP-4)

security (runs in parallel — checks for secrets, HS256, raw data leaks)
```

### Deploy Jobs (after CI green)
```
verify-ci → deploy-vault → ┐
          → deploy-engine → ├→ post-deploy-verify (smoke test)
          → deploy-dashboard → ┘
```

### Push Verification Protocol
**After EVERY `git push`, run this:**
```bash
bash scripts/verify-push.sh
```
This script:
1. Finds the CI run for your branch
2. Polls until complete (up to 5 min)
3. Reports pass/fail per job
4. On failure: prints the failed job logs

**If CI fails, fix before doing anything else:**
```bash
# See what failed
bash scripts/verify-push.sh $(git branch --show-current) --fix
# Or manually:
gh run view <run-id> --log-failed
# Fix the issue, commit, push, verify again
```

### Required GitHub Secrets
Set these in repo Settings → Secrets → Actions:
- `ANTHROPIC_API_KEY` — Claude API key (needed for ingest + engine tests)
- `AZURE_CREDENTIALS` — Azure service principal JSON (for deploy)
- `AZURE_STATIC_WEB_APPS_TOKEN` — For dashboard deploy

### Branch Protection Rules (Recommended)
Set on `main` branch:
- Require status checks to pass: `vault-test`, `e2e-test`, `security`
- Require PR reviews before merging
- No force pushes

### Security Scan (Every Push)
CI automatically checks:
- No `.env`, `.pem`, or `.key` files tracked in git
- No HS256 usage (RS256 only per AGENTS.md)
- No raw data leak patterns in ingest/engine code
- `npm audit` on vault dependencies

---

## File Structure

```
katha/
├── CLAUDE.md                          ← This file
├── AGENTS.md                          ← AI agent alignment (READ FIRST)
├── README.md                          ← User-facing docs
├── .env.example                       ← Environment template
├── .gitignore
├── schema/                            ← JSON-LD definitions
│   ├── cultural-memory-passport-v1.json
│   ├── living-memory-object-v1.json
│   └── situational-trigger-taxonomy.json
├── ingest/                            ← Python ingestion pipeline
│   ├── loader.py                      ← JSONL loading + dedup
│   ├── extractor.py                   ← Claude API extraction (DO NOT MODIFY PROMPT)
│   ├── classifier.py                  ← LMO classification + weight gate
│   ├── assembler.py                   ← Passport assembly + situational index
│   ├── demo_flow.py                   ← Full demo pipeline (< 90s target)
│   ├── requirements.txt
│   └── adapters/                      ← Data source adapters
│       ├── persona_jsonl.py           ← Hackathon format
│       ├── google_takeout.py          ← Gmail + Calendar (stub)
│       ├── chatgpt_export.py          ← ChatGPT (stub)
│       └── claude_export.py           ← Claude (stub)
├── vault/                             ← Node.js passport server
│   ├── package.json
│   ├── scripts/generate-keys.js       ← RS256 keypair generation
│   └── src/
│       ├── server.js                  ← Express entry point
│       ├── routes/                    ← passports, memories, consent, audit
│       ├── consent/                   ← issue, validate, revoke
│       ├── audit/writer.js            ← Append-only audit log
│       └── db/schema.sql              ← SQLite schema
├── engine/                            ← Python wisdom engine
│   ├── wisdom_engine.py               ← FastAPI app
│   ├── prompt_builder.py              ← Three-layer prompt assembly
│   ├── situational_index.py           ← Trigger taxonomy + matching
│   └── requirements.txt
├── globe/                             ← React + Three.js visualization
│   ├── Globe.jsx                      ← 3D memory globe
│   ├── MemoryCard.jsx                 ← Hover card for memory dots
│   └── useGlobeData.js                ← Vault API feed hook
├── dashboard/                         ← React consent UI
│   ├── IngestTrigger.jsx
│   ├── MemoryApproval.jsx
│   ├── ConsentGrant.jsx
│   ├── AuditLog.jsx
│   └── PassportExport.jsx
├── tests/                             ← Automated testing agents (per phase)
│   ├── test_phase1_vault.js           ← CP-1: 13 assertions
│   ├── test_phase2_ingest.py          ← CP-2: 10 assertions
│   ├── test_phase3_engine.py          ← CP-3: 14 assertions
│   └── test_phase4_e2e.py             ← CP-4: 16 assertions
├── data/                              ← Demo persona datasets
│   ├── persona_p04/                   ← Sunita Rajan (primary demo)
│   └── synthetic_tamil_family/        ← Backup demo passport
└── docs/                              ← All documentation
    ├── plans/
    │   ├── 2026-02-26-build-order-design.md
    │   ├── tasks.md                   ← 95 atomic tasks
    │   ├── checkpoints.md             ← 5 verification gates
    │   ├── status.md                  ← Live progress tracker
    │   └── worktree-strategy.md       ← Git worktree layout
    ├── katha-spec-v3.docx
    ├── katha-guardrails.docx
    ├── katha-submission.docx
    ├── katha-architecture.svg
    ├── threat-model.md
    ├── dti-portability-alignment.md
    └── coppa-compliance.md
```

---

## Mandatory Reading Order

1. **AGENTS.md** — Full alignment document (read before any implementation)
2. **CLAUDE.md** — This file (project config, conventions, commands)
3. **README.md** — User-facing docs, demo flow, architecture
