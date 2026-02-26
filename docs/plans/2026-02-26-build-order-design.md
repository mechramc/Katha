# KATHA Build Order — Full System Implementation Plan

**Approach:** Bottom-Up (foundation first, UI last)
**Timeline:** Flexible / no rush — build each layer properly
**Deployment target:** murailabs.com/katha (Cloudflare → Azure)
**Test data:** Real hackathon JSONL files available (Sunita Rajan p04)

---

## Phase 1: Schema & Vault (Foundation)

### Step 1 — Schema validation utility
- Validate passport documents against `schema/cultural-memory-passport-v1.json`
- This becomes the acceptance test for every downstream component

### Step 2 — Vault server core
- Express server with SQLite initialized from `vault/src/db/schema.sql`
- Four route groups: passports, memories, consent, audit
- Audit writer as middleware — every mutation logged automatically

### Step 3 — Key generation + auth
- `generate-keys.js` creates RS256 keypair
- Consent module: issue (RS256 JWT), validate (signature + revocation + scope intersection), revoke
- Most security-critical code in the project

**Checkpoint:** curl all Vault endpoints, create passport, approve memories, issue/revoke tokens, read audit trail.

---

## Phase 2: Ingestion Pipeline

### Step 4 — Loader + persona adapter
- `loader.py` reads JSONL from `data/persona_p04/`, deduplicates by content hash
- `persona_jsonl.py` adapter for hackathon format
- Other adapters stay as stubs

### Step 5 — Extractor
- `extractor.py` with canonical extraction prompt from AGENTS.md (DO NOT MODIFY)
- Only extracted text snippets sent to Claude (never raw JSONL)
- Timeout + exponential backoff retry

### Step 6 — Classifier + assembler
- `classifier.py`: emotionalWeight, lifeTheme, situationalTags, gate at weight >= 6
- `assembler.py`: build situational index, wrap as JSON-LD, POST to Vault

### Step 7 — Demo flow script
- `demo_flow.py` chains steps 4-6
- Target: < 90 seconds for Sunita's dataset

**Checkpoint:** Run `python ingest/demo_flow.py`, then curl the Vault and see a complete passport with 12+ LMOs.

---

## Phase 3: Wisdom Engine

### Step 8 — FastAPI app + trigger matching
- `wisdom_engine.py` on port 3002
- `situational_index.py` matches triggers against passport's situational index

### Step 9 — Three-layer prompt builder
- Layer 1 (Identity): "You are Sunita Rajan..."
- Layer 2 (LMOs): Matching memories' text, grounded in source
- Layer 3 (Instruction): "Deliver as Sunita would speak..."
- Validates JWT with Vault before calling Claude
- Revoked/invalid token → generic response (never leaks memories)

### Step 10 — Delivery endpoint
- `POST /trigger` — validate → match → build prompt → call Claude → return → audit log

**Checkpoint:** Fire trigger with valid JWT → grounded wisdom. Revoke → generic response. Re-grant → grounded again.

---

## Phase 4: UI (Globe + Dashboard)

### Step 11 — Dashboard scaffolding
- React 18 + Tailwind in `dashboard/`
- Shared `useVault()` hook (single API gateway)
- Five screens:
  - **IngestTrigger** — kick off ingestion, show progress
  - **MemoryApproval** — approve/reject LMOs (recorded vs reconstructed visually distinct)
  - **ConsentGrant** — plain-language scope toggles → JWT scopes
  - **AuditLog** — read-only chronological feed
  - **PassportExport** — one-click JSON-LD download with schema validation

### Step 12 — Globe visualization
- Three.js sphere with orbital memory dots
- Sized by emotionalWeight, colored by lifeTheme
- Hover → MemoryCard with wisdom text, contributor, memory type
- Target: 12 dots for Sunita's passport

### Step 13 — Wiring audit (Agni lesson)
- Every component mounted and rendered?
- Every API handler registered in server entry point?
- Every hook connected?
- Walk full demo flow in browser

**Checkpoint:** Full demo flow in browser — ingest → approve → grant → trigger → wisdom → globe → revoke → blocked → re-grant → works.

---

## Phase 5: Deployment to murailabs.com/katha

### Infrastructure
- **Vault + Engine:** Azure App Service (Node.js + Python)
- **Dashboard/Globe:** Azure Static Web Apps (React build)
- **Domain:** Cloudflare CNAME → Azure endpoint (SSL via Cloudflare)
- **Database:** SQLite for demo (upgrade path: Supabase Postgres)
- **Secrets:** RS256 keypair + API keys as Azure App Service secrets

### Why Azure over Supabase
- `az cli` already integrated
- KATHA has custom RS256 JWT consent model — Supabase auth would conflict
- Supabase Postgres is a valid SQLite upgrade path if needed later

### Cloudflare rules
- Cache static assets (JS/CSS/images)
- Do NOT cache API calls — consent revocation must hit origin every time

**Checkpoint:** `curl https://murailabs.com/katha/api/health` returns 200. Full demo works from public URL.

---

## Build Dependencies

```
Phase 1 (Vault) ← no dependencies
Phase 2 (Ingest) ← depends on Phase 1 (writes to Vault)
Phase 3 (Engine) ← depends on Phase 1 (reads from Vault)
Phase 4 (UI)     ← depends on Phases 1, 2, 3 (calls all APIs)
Phase 5 (Deploy) ← depends on Phase 4 (deploys everything)
```

Phases 2 and 3 can run in parallel (both depend only on Phase 1).

---

## Success Criteria (from AGENTS.md)

1. ✅ Ingest completes in < 90 seconds for Sunita
2. ✅ Globe renders 12 dots with orbital animation
3. ✅ Revoking consent → generic response (no leaked data)
4. ✅ Re-granting consent → grounded wisdom
5. ✅ Exported passport is valid JSON-LD
6. ✅ Full audit trail for all operations
7. ✅ Live at murailabs.com/katha
