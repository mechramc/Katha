# KATHA — Atomic Task List

> Every task is a single, verifiable unit of work. No task takes more than ~2 hours.
> Status: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 1: Schema & Vault (Foundation)

### 1.1 Schema Validation
- [ ] **T-001** Create `schema/validate.js` — load JSON schemas, expose `validatePassport()` and `validateLMO()` functions
- [ ] **T-002** Write 3 test cases: valid passport passes, missing required field fails, invalid emotionalWeight (0 or 11) fails
- [ ] **T-003** Verify `situational-trigger-taxonomy.json` has all 12 triggers with id, label, description, examples

### 1.2 Vault Server Core
- [ ] **T-004** Implement `vault/src/server.js` — Express app, dotenv config, CORS, JSON body parser, error handler middleware
- [ ] **T-005** Implement SQLite initialization — read `schema.sql`, create tables on startup if not exists
- [ ] **T-006** Implement `vault/src/audit/writer.js` — `logAudit(passportId, action, actor, details)` function, append-only INSERT
- [ ] **T-007** Implement `vault/src/routes/passports.js` — `POST /passport` (create/update), `GET /passport/:id` (read), `POST /passport/export` (JSON-LD), `GET /passports` (list with pagination)
- [ ] **T-008** Implement `vault/src/routes/memories.js` — `POST /memories` (store LMOs), `GET /memories/:id` (single), `PATCH /memories/:id/approve` (parent approval), `GET /passport/:id/memories` (list by passport)
- [ ] **T-009** Wire audit logging into passport and memory routes — every mutation writes audit entry BEFORE returning response
- [ ] **T-010** Implement `vault/src/routes/audit.js` — `GET /audit` (paginated), `GET /audit/:passportId` (filtered). Read-only, no update/delete
- [ ] **T-011** Add `GET /health` endpoint — returns `{ success: true, version: "0.1.0" }`
- [ ] **T-012** Verify all response shapes match `{ success: bool, data: {}, error: string|null }` convention

### 1.3 Key Generation & Auth
- [ ] **T-013** Implement `vault/scripts/generate-keys.js` — generate RS256 keypair, write to `vault/keys/private.pem` and `vault/keys/public.pem`, create keys dir if missing
- [ ] **T-014** Implement `vault/src/consent/issue.js` — `issueToken(passportId, scopes, expiresIn)` using `jose`, RS256 signing, returns JWT with jti, iss, sub, aud, scopes, constraints (noTraining, retentionDays:0, dataMinimization, coppaCompliant)
- [ ] **T-015** Implement `vault/src/consent/revoke.js` — `revokeToken(jti)` adds to revocation registry in SQLite, `isRevoked(jti)` checks registry (NO caching)
- [ ] **T-016** Implement `vault/src/consent/validate.js` — `validateToken(jwt)`: verify RS256 signature, check expiry, check revocation registry, intersect requested scopes with granted scopes, return 401 if revoked, 403 if scope mismatch
- [ ] **T-017** Implement `vault/src/routes/consent.js` — `POST /consent/grant` (issue JWT), `POST /consent/revoke` (revoke by jti), `GET /consent/status` (check validity), `GET /.well-known/jwks.json` (public key)
- [ ] **T-018** Add auth middleware to protected routes — passports (read), memories (read), consent status require valid JWT. Passport create, memory store, consent grant/revoke require admin or parent role
- [ ] **T-019** Verify: issue token → use token → revoke token → same token rejected → re-grant → new token works

### 1.4 Phase 1 Integration
- [ ] **T-020** Run full Vault manually: start server, create passport via curl, store LMOs, approve one, issue JWT, read passport with JWT, revoke, verify 401, check audit log has all entries
- [ ] **T-021** Verify error responses never leak passport data in error messages

### 1.5 Phase 1 Testing Agent (GATE)
- [ ] **T-021a** Run `node tests/test_phase1_vault.js` — automated CP-1 checkpoint (13 assertions). Must exit 0 before proceeding.
- [ ] **T-021b** Pre-PR review: "Review all Phase 1 changes critically. Check for bugs, edge cases, security issues. Rate confidence 1-10." (Boris Principle #6)
- [ ] **T-021c** Push to GitHub, run `bash scripts/verify-push.sh` — verify `vault-lint` + `vault-test` + `security` jobs pass in CI
- [ ] **T-021d** If CI fails: pull logs with `gh run view <id> --log-failed`, fix errors, re-push, re-verify until green
- [ ] **T-021e** Merge or commit Phase 1 only after T-021a passes AND CI is green

---

## Phase 2: Ingestion Pipeline

### 2.1 Data Loading
- [ ] **T-022** Define Pydantic models in `ingest/models.py` — `RawRecord`, `WisdomSignal`, `LMOCandidate`, `LMO`, `Passport` (no raw dicts crossing boundaries)
- [ ] **T-023** Implement `ingest/adapters/persona_jsonl.py` — read JSONL files from a directory, parse each line, return list of `RawRecord`
- [ ] **T-024** Implement `ingest/loader.py` — accept persona directory path, call adapter, deduplicate by content hash (text field), return clean `list[RawRecord]`
- [ ] **T-025** Test loader with real Sunita p04 data — verify dedup works, count unique records

### 2.2 Extraction
- [ ] **T-026** Implement `ingest/extractor.py` — take `list[RawRecord]`, extract text snippets only (NEVER send full JSONL), call Claude API with canonical extraction prompt from AGENTS.md
- [ ] **T-027** Add timeout (30s) and exponential backoff retry (3 attempts) to Claude API calls
- [ ] **T-028** Parse Claude response into `list[WisdomSignal]`, handle null returns (no wisdom signal) gracefully
- [ ] **T-029** Verify: only extracted text sent to Claude, not full record with id/ts/refs/pii_level

### 2.3 Classification & Assembly
- [ ] **T-030** Implement `ingest/classifier.py` — take `list[WisdomSignal]`, assign emotionalWeight/lifeTheme/situationalTags, gate: discard weight < 6, return `list[LMO]`
- [ ] **T-031** Implement `ingest/assembler.py` — take `list[LMO]` + heritage info, build situational index (trigger → memoryId[]), wrap as JSON-LD passport, validate against schema, POST to Vault API
- [ ] **T-032** Verify assembled passport validates against `schema/cultural-memory-passport-v1.json`
- [ ] **T-033** Verify pipeline is idempotent — running twice on same files produces same passport (dedup by text hash)

### 2.4 Demo Flow
- [ ] **T-034** Implement `ingest/demo_flow.py` — chain loader → extractor → classifier → assembler, accept `--persona` arg, log progress to stdout
- [ ] **T-035** Run `demo_flow.py` on Sunita p04 data end-to-end, verify 12+ LMOs produced
- [ ] **T-036** Measure and log total pipeline time — target < 90 seconds
- [ ] **T-037** Verify passport in Vault via curl after demo_flow completes

### 2.5 Phase 2 Testing Agent (GATE)
- [ ] **T-037a** Run `python tests/test_phase2_ingest.py` — automated CP-2 checkpoint (10 assertions). Must exit 0 before proceeding.
- [ ] **T-037b** Pre-PR review: "Review all Phase 2 changes critically. Check for bugs, edge cases, security issues. Rate confidence 1-10."
- [ ] **T-037c** Push to GitHub, run `bash scripts/verify-push.sh` — verify `ingest-lint` + `ingest-test` jobs pass in CI
- [ ] **T-037d** If CI fails: pull logs with `gh run view <id> --log-failed`, fix errors, re-push, re-verify until green
- [ ] **T-037e** Merge `feature/ingest-pipeline` → `main` only after T-037a passes AND CI is green

---

## Phase 3: Wisdom Engine

### 3.1 FastAPI App
- [ ] **T-038** Implement `engine/wisdom_engine.py` — FastAPI app, dotenv config, CORS, health endpoint on ENGINE_PORT (3002)
- [ ] **T-039** Implement `engine/situational_index.py` — load trigger taxonomy from schema, `match_triggers(trigger_id, passport)` returns matching memoryIds from passport's situationalIndex

### 3.2 Prompt Builder
- [ ] **T-040** Implement `engine/prompt_builder.py` — `build_prompt(contributor, lmos, trigger)`:
  - Layer 1 (Identity): "You are {name}, a {role}..." from passport heritage
  - Layer 2 (LMOs): matching memories' text, faithful to source
  - Layer 3 (Instruction): delivery directive, "transmitting inheritance not generating advice"
- [ ] **T-041** Handle `memoryType` in prompt — recorded: "{name} wrote:", reconstructed: "{name} is remembered by their family as someone who..."
- [ ] **T-042** Verify prompt never includes raw JSONL data, only extracted text snippets

### 3.3 Delivery Endpoint
- [ ] **T-043** Implement `POST /trigger` endpoint — accepts `{ trigger: string, passportId: string }` + JWT in Authorization header
- [ ] **T-044** Wire validation: call Vault `/consent/status` to validate JWT, check revocation, verify scope intersection. Revoked/invalid → return generic response (no memories leaked)
- [ ] **T-045** Wire delivery: match trigger → retrieve LMOs from Vault → build prompt → call Claude → return grounded response
- [ ] **T-046** Log delivery event to Vault audit trail BEFORE returning response
- [ ] **T-047** Verify engine is stateless — no passport caching between requests, fresh JWT validation every time

### 3.4 Phase 3 Integration
- [ ] **T-048** Full flow: fire trigger with valid JWT → get grounded wisdom in Sunita's voice
- [ ] **T-049** Revoke JWT → fire same trigger → get generic response (no Sunita data)
- [ ] **T-050** Re-grant new JWT → fire trigger → get grounded wisdom again
- [ ] **T-051** Check audit log has entries for: trigger activation, delivery, revocation, re-grant

### 3.5 Phase 3 Testing Agent (GATE)
- [ ] **T-051a** Run `python tests/test_phase3_engine.py` — automated CP-3 checkpoint (14 assertions). Must exit 0 before proceeding.
- [ ] **T-051b** Pre-PR review: "Review all Phase 3 changes critically. Check for bugs, edge cases, security issues. Rate confidence 1-10."
- [ ] **T-051c** Push to GitHub, run `bash scripts/verify-push.sh` — verify `engine-lint` + `engine-test` jobs pass in CI
- [ ] **T-051d** If CI fails: pull logs with `gh run view <id> --log-failed`, fix errors, re-push, re-verify until green
- [ ] **T-051e** Merge `feature/wisdom-engine` → `main` only after T-051a passes AND CI is green

---

## Phase 4: UI (Globe + Dashboard)

### 4.1 Dashboard Scaffolding
- [ ] **T-052** Initialize React 18 app in `dashboard/` with Tailwind CSS, configure proxy to Vault (3001) and Engine (3002)
- [ ] **T-053** Implement `dashboard/hooks/useVault.js` — single hook for all Vault API calls (GET/POST/PATCH), handles auth header injection, error states. No direct `fetch()` in components
- [ ] **T-054** Implement app shell — navigation between 5 screens, route setup

### 4.2 Dashboard Screens
- [ ] **T-055** Implement `IngestTrigger.jsx` — select persona directory, trigger ingestion via API, show progress/completion status
- [ ] **T-056** Implement `MemoryApproval.jsx` — list unapproved LMOs, show text + source, approve/reject individually (no bulk approve), visually distinguish recorded (solid badge) vs reconstructed (striped badge + "Reconstructed — family testimony" label)
- [ ] **T-057** Implement `ConsentGrant.jsx` — plain-language scope toggles mapped to JWT scopes, grant button (calls `/consent/grant`), revoke button (calls `/consent/revoke`), shows current token status
- [ ] **T-058** Implement `AuditLog.jsx` — paginated chronological feed from `/audit`, read-only, no edit/delete
- [ ] **T-059** Implement `PassportExport.jsx` — calls `/passport/export`, validates JSON-LD against schema, download button

### 4.3 Globe Visualization
- [ ] **T-060** Set up Three.js scene in `globe/Globe.jsx` — sphere geometry, orbital camera controls, ambient + point lighting
- [ ] **T-061** Render memory dots — one dot per LMO, sized by emotionalWeight, colored by lifeTheme, orbital ring positions
- [ ] **T-062** Recorded memories: full opacity, pulse animation. Reconstructed: 60% opacity, dashed ring, no pulse
- [ ] **T-063** Implement `globe/MemoryCard.jsx` — hover/click on dot shows card with wisdom text, contributor, relationship, life theme, emotional weight, memory type badge
- [ ] **T-064** Implement `globe/useGlobeData.js` — fetch passport data via `useVault()`, transform for Three.js consumption
- [ ] **T-065** Verify 12 dots render for Sunita's passport without crashing

### 4.4 Wiring Audit (Agni Lesson)
- [ ] **T-066** Audit: every component imported and rendered in app shell?
- [ ] **T-067** Audit: every Vault route handler registered in `server.js`?
- [ ] **T-068** Audit: `useVault()` hook used everywhere (no raw `fetch()`)?
- [ ] **T-069** Audit: error states handled and displayed on every screen (no silent failures)?
- [ ] **T-070** Walk full demo flow in browser: ingest → approve → grant → trigger → wisdom → globe → revoke → blocked → re-grant → works

### 4.5 Phase 4 Testing Agent (GATE)
- [ ] **T-070a** Run `python tests/test_phase4_e2e.py` — automated CP-4 API-level test (16 assertions). Must exit 0.
- [ ] **T-070b** Manual browser walkthrough per CP-4 checklist in checkpoints.md (10 steps). Document pass/fail.
- [ ] **T-070c** Pre-PR review: "Review all Phase 4 changes critically. Check for bugs, edge cases, security issues. Rate confidence 1-10."
- [ ] **T-070d** Push to GitHub, run `bash scripts/verify-push.sh` — verify `e2e-test` + `security` jobs pass in CI
- [ ] **T-070e** If CI fails: pull logs with `gh run view <id> --log-failed`, fix errors, re-push, re-verify until green
- [ ] **T-070f** Merge `feature/dashboard-ui` and `feature/globe-viz` → `main` only after T-070a + T-070b pass AND CI is green

---

## Phase 5: Deployment

### 5.1 Azure Setup
- [ ] **T-071** Create Azure App Service for Vault (Node.js 18)
- [ ] **T-072** Create Azure App Service for Engine (Python 3.11)
- [ ] **T-073** Create Azure Static Web App for Dashboard + Globe (React build)
- [ ] **T-074** Configure Azure App Service secrets: RS256 keypair, ANTHROPIC_API_KEY, VAULT_PORT, ENGINE_PORT
- [ ] **T-075** Deploy Vault to Azure, verify `/health` returns 200

### 5.2 Cloudflare + Domain
- [ ] **T-076** Create Cloudflare CNAME: `murailabs.com/katha` → Azure endpoint
- [ ] **T-077** Configure Cloudflare: cache static assets, bypass cache for API routes (consent revocation must hit origin)
- [ ] **T-078** Verify SSL termination at Cloudflare

### 5.3 CI/CD Pipeline Verification
- [ ] **T-078a** Push to `main`, verify `deploy.yml` workflow triggers automatically
- [ ] **T-078b** Verify `verify-ci` job passes (confirms CI was green before deploy)
- [ ] **T-078c** Verify `deploy-vault`, `deploy-engine`, `deploy-dashboard` jobs all succeed
- [ ] **T-078d** Verify `post-deploy-verify` smoke test passes (health checks + no secret leaks)
- [ ] **T-078e** If any deploy job fails: `gh run view <id> --log-failed`, fix, re-push

### 5.4 Production Verification
- [ ] **T-079** `curl https://murailabs.com/katha/api/health` returns 200
- [ ] **T-080** Run full demo flow from public URL
- [ ] **T-081** Verify audit trail works in production
- [ ] **T-082** Verify revocation latency < 1 second (no caching)

---

## Task Count Summary

| Phase | Tasks | IDs | Gate |
|-------|-------|-----|------|
| Phase 1: Schema & Vault | 26 | T-001 → T-021e | `test_phase1_vault.js` + CI green |
| Phase 2: Ingestion | 21 | T-022 → T-037e | `test_phase2_ingest.py` + CI green |
| Phase 3: Wisdom Engine | 19 | T-038 → T-051e | `test_phase3_engine.py` + CI green |
| Phase 4: UI | 25 | T-052 → T-070f | `test_phase4_e2e.py` + browser + CI green |
| Phase 5: Deployment | 17 | T-071 → T-082 | Deploy workflow green + smoke test |
| **Total** | **108** | | |

## Testing Agent Commands (Quick Reference)

```bash
# After Phase 1 — Vault must be running on :3001
node tests/test_phase1_vault.js

# After Phase 2 — Vault running, persona data available
python tests/test_phase2_ingest.py

# After Phase 3 — Vault + Engine running, passport ingested
python tests/test_phase3_engine.py

# After Phase 4 — Full stack running
python tests/test_phase4_e2e.py
# Then: manual browser walkthrough per checkpoints.md CP-4
```
