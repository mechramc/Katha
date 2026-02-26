# KATHA — Project Status

> Updated: 2026-02-26
> Current Phase: **Phase 4 Complete** (Phases 1-4 implemented, ready for deployment)

---

## Overall Progress

```
Phase 1: Schema & Vault    [ ████████████████████ ]  21/21 tasks    COMPLETE ✅
Phase 2: Ingestion          [ ████████████████████ ]  16/16 tasks    COMPLETE ✅
Phase 3: Wisdom Engine      [ ████████████████████ ]  14/14 tasks    COMPLETE ✅
Phase 4: UI (Globe+Dash)    [ ████████████████████ ]  19/19 tasks    COMPLETE ✅
Phase 5: Deployment         [ ░░░░░░░░░░░░░░░░░░░░ ]   0/12 tasks    NOT STARTED
──────────────────────────────────────────────────────────────────────
Total                        [ ████████████████░░░░ ]  70/82 tasks
```

## Checkpoint Status

| Checkpoint | Description | Status |
|-----------|-------------|--------|
| CP-1 | Vault Stands Alone | ✅ Passed (13/13 assertions) |
| CP-2 | Pipeline Produces Valid Passport | ✅ Passed (36 LMOs, 66 unique records) |
| CP-3 | Wisdom Engine Delivers Grounded Wisdom | ✅ Passed (grant→wisdom→revoke→blocked→re-grant→wisdom) |
| CP-4 | Full Demo Flow in Browser | ✅ Dashboard + Globe running on :3000 |
| CP-5 | Live at murailabs.com/katha | ⬜ Not started |

---

## What's Done

### Infrastructure & Planning (Complete)
- [x] AGENTS.md — AI alignment document
- [x] CLAUDE.md — Project configuration
- [x] README.md — User-facing docs
- [x] .gitignore — Comprehensive ignores
- [x] .env.example — Environment template
- [x] Folder structure — All 5 components scaffolded
- [x] JSON schemas — Passport, LMO, trigger taxonomy
- [x] SQLite schema — Tables, constraints, indexes
- [x] Build order design — Bottom-up, 5 phases
- [x] Checkpoints — 5 verification gates

### Phase 1: Schema & Vault (Complete)
- [x] Schema validation utility
- [x] Vault Express server with SQLite
- [x] 4 route groups: passports, memories, consent, audit
- [x] Audit writer (append-only, immutable)
- [x] RS256 key generation script
- [x] JWT issuance, validation, scope intersection, revocation
- [x] Health endpoint, JWKS endpoint
- [x] CP-1 verified: all 13 assertions pass

### Phase 2: Ingestion Pipeline (Complete)
- [x] Pydantic models (RawRecord, WisdomSignal, LivingMemoryObject, IngestResult)
- [x] Persona JSONL adapter (loads all 7 file types)
- [x] Loader with SHA-256 text dedup (527 raw → 66 unique)
- [x] Extractor with sacred prompt (verbatim from AGENTS.md)
- [x] Exponential backoff retry (4 retries)
- [x] Classifier with emotionalWeight >= 6 gate
- [x] Assembler with JSON-LD passport + situational index
- [x] Demo flow script (66 records → 36 LMOs → passport in vault)
- [x] CP-2 verified: 36 LMOs in vault, all weight >= 6

### Phase 3: Wisdom Engine (Complete)
- [x] FastAPI app on port 3002
- [x] Situational index matching (direct + thematic fallback)
- [x] Three-layer prompt builder (identity → LMOs → instruction)
- [x] Recorded vs reconstructed delivery prefixes
- [x] POST /trigger endpoint with JWT validation
- [x] Claude API integration for wisdom generation
- [x] CP-3 verified: grant→wisdom→revoke→blocked→re-grant→wisdom

### Phase 4: UI — Dashboard + Globe (Complete)
- [x] React 18 + Vite + Tailwind CSS scaffold
- [x] Dark sidebar app shell with routing (6 screens)
- [x] useVault() hook (single API gateway, no direct fetch)
- [x] IngestTrigger screen (pipeline status, passport info)
- [x] MemoryApproval screen (individual approve, recorded/reconstructed badges)
- [x] ConsentGrant screen (plain-language scopes, grant/revoke)
- [x] AuditLog screen (color-coded chronological feed)
- [x] PassportExport screen (JSON-LD download + validation)
- [x] Three.js Globe (memory dots, golden spiral, pulse animation)
- [x] MemoryCard hover component
- [x] useGlobeData hook
- [x] Globe embedded in dashboard as GlobeView screen

---

## What's Next

**Next action:** Phase 5 — Deployment to murailabs.com/katha

**Services running locally:**
- Vault: http://localhost:3001
- Engine: http://localhost:3002
- Dashboard: http://localhost:3000

**Known issues:**
- Ingest pipeline takes ~177s (target is 90s) — mostly Claude API latency across 7 batch calls
- Pipeline timing can be improved with concurrent batch calls

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Persona | Sunita Rajan (p04) |
| Raw records | 527 |
| Unique records | 66 (after dedup) |
| Wisdom signals | 36 |
| LMOs in vault | 36 (all weight >= 6) |
| Triggers populated | 10 of 12 |
| Ingest time | ~177s |
| Passport ID | 68f6acff-0786-4961-a46b-909a993a8045 |

---

## Log

| Date | Event |
|------|-------|
| 2026-02-26 | Project initialized — docs, schemas, folder structure, task list, checkpoints |
| 2026-02-26 | Added Boris Cherny best practices — worktree strategy, pre-PR review protocol, subagent strategy, SQLite debug queries |
| 2026-02-26 | Added automated testing agents — 4 test scripts (phases 1-4), 53 total assertions, mandatory gates before merge |
| 2026-02-26 | Added CI/CD — GitHub Actions workflows (ci.yml + deploy.yml), push verification script, security scan |
| 2026-02-26 | **Phase 1 complete** — Vault running, CP-1 passed (13/13 assertions) |
| 2026-02-26 | **Phase 2 complete** — Ingest pipeline: 527→66→36 LMOs, passport in vault |
| 2026-02-26 | **Phase 3 complete** — Wisdom Engine delivering grounded wisdom, consent cycle verified |
| 2026-02-26 | **Phase 4 complete** — Dashboard + Globe running on :3000, all screens implemented |
