# KATHA — Verification Checkpoints

> Each checkpoint is a gate. Do not proceed to the next phase until the checkpoint passes.
> These are the "definition of done" for each phase — not just "code exists" but "it works."

---

## CP-1: Vault Stands Alone

**Gate for:** Phase 2 (Ingest) and Phase 3 (Engine) can begin

**Verification steps:**

```bash
# 1. Generate keys
cd vault && node scripts/generate-keys.js
# ✓ keys/private.pem and keys/public.pem exist

# 2. Start server
npm start
# ✓ "Vault listening on port 3001" in terminal

# 3. Health check
curl http://localhost:3001/health
# ✓ { "success": true, "version": "0.1.0" }

# 4. Create a passport
curl -X POST http://localhost:3001/passport \
  -H "Content-Type: application/json" \
  -d '{"familyName":"Rajan","contributor":"Sunita Rajan","passportData":{...}}'
# ✓ { "success": true, "data": { "passportId": "<uuid>" } }

# 5. Store an LMO
curl -X POST http://localhost:3001/memories \
  -H "Content-Type: application/json" \
  -d '{"passportId":"<uuid>","memoryId":"<uuid>","text":"...","emotionalWeight":8,...}'
# ✓ { "success": true }

# 6. Approve the LMO
curl -X PATCH http://localhost:3001/memories/<memoryId>/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"Parent Name"}'
# ✓ { "success": true, "data": { "approvedAt": "..." } }

# 7. Issue a consent token
curl -X POST http://localhost:3001/consent/grant \
  -H "Content-Type: application/json" \
  -d '{"passportId":"<uuid>","scopes":["katha:read:memories","katha:read:values"]}'
# ✓ { "success": true, "data": { "token": "<jwt>", "jti": "<jti>" } }

# 8. Read passport with token
curl http://localhost:3001/passport/<uuid> \
  -H "Authorization: Bearer <jwt>"
# ✓ { "success": true, "data": { ... passport ... } }

# 9. Revoke the token
curl -X POST http://localhost:3001/consent/revoke \
  -H "Content-Type: application/json" \
  -d '{"jti":"<jti>"}'
# ✓ { "success": true }

# 10. Try reading with revoked token
curl http://localhost:3001/passport/<uuid> \
  -H "Authorization: Bearer <jwt>"
# ✓ 401 Unauthorized — no passport data in response body

# 11. Check audit log
curl http://localhost:3001/audit
# ✓ Contains entries for: passport_create, memory_store, memory_approve,
#   consent_grant, passport_read, consent_revoke, passport_read_denied

# 12. Verify JWKS endpoint
curl http://localhost:3001/.well-known/jwks.json
# ✓ Returns public key in JWK format

# 13. Verify error responses
curl http://localhost:3001/passport/nonexistent-id \
  -H "Authorization: Bearer <jwt>"
# ✓ Error response does NOT contain any passport data
```

**Pass criteria:** All 13 steps succeed. Audit log has 7+ entries. Revoked token returns 401.

---

## CP-2: Pipeline Produces a Valid Passport

**Gate for:** Phase 3 integration tests and Phase 4 (UI)

**Precondition:** CP-1 passed, Vault is running on :3001

**Verification steps:**

```bash
# 1. Run the demo flow
cd ingest && python demo_flow.py --persona ../data/persona_p04/
# ✓ Completes without errors
# ✓ Logs show: loaded X records, deduplicated to Y, extracted Z signals,
#   classified N LMOs (N >= 12), assembled passport, posted to Vault

# 2. Check timing
# ✓ Total time logged < 90 seconds

# 3. Verify passport in Vault
curl http://localhost:3001/passports
# ✓ At least one passport listed

curl http://localhost:3001/passport/<passportId>/memories
# ✓ 12+ LMOs returned
# ✓ All have emotionalWeight >= 6
# ✓ All have valid sourceRef pointing to original JSONL
# ✓ All have situationalTags from the 12-trigger taxonomy
# ✓ memoryType is "recorded" for all (Sunita authored her own data)

# 4. Validate JSON-LD
curl -X POST http://localhost:3001/passport/export -d '{"passportId":"<uuid>"}'
# ✓ Output validates against schema/cultural-memory-passport-v1.json
# ✓ situationalIndex has entries mapping triggers to memoryIds
# ✓ @context and @type fields present

# 5. Idempotency check
cd ingest && python demo_flow.py --persona ../data/persona_p04/
# ✓ Running again does NOT create duplicate LMOs (dedup by text hash)
# ✓ Same passport, same LMO count
```

**Pass criteria:** 12+ LMOs, all weight >= 6, valid JSON-LD, < 90 seconds, idempotent.

---

## CP-3: Wisdom Engine Delivers Grounded Wisdom

**Gate for:** Phase 4 (UI integration with engine)

**Precondition:** CP-1 and CP-2 passed, Vault running with ingested passport

**Verification steps:**

```bash
# 1. Start engine
cd engine && uvicorn wisdom_engine:app --port 3002
# ✓ "Engine listening on port 3002"

# 2. Health check
curl http://localhost:3002/health
# ✓ { "success": true }

# 3. Issue a fresh consent token
curl -X POST http://localhost:3001/consent/grant \
  -d '{"passportId":"<uuid>","scopes":["katha:read:memories","katha:read:values"]}'
# ✓ Got JWT

# 4. Fire a trigger with valid token
curl -X POST http://localhost:3002/trigger \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"descendant-struggling-silently","passportId":"<uuid>"}'
# ✓ Response contains wisdom grounded in Sunita's memories
# ✓ Response references specific actions/moments from her data
# ✓ Response is in Sunita's voice/perspective

# 5. Fire trigger WITHOUT token
curl -X POST http://localhost:3002/trigger \
  -H "Content-Type: application/json" \
  -d '{"trigger":"descendant-struggling-silently","passportId":"<uuid>"}'
# ✓ 401 — generic response, NO Sunita data

# 6. Revoke and retry
curl -X POST http://localhost:3001/consent/revoke -d '{"jti":"<jti>"}'
curl -X POST http://localhost:3002/trigger \
  -H "Authorization: Bearer <jwt>" \
  -d '{"trigger":"descendant-struggling-silently","passportId":"<uuid>"}'
# ✓ 401 — generic response, NO Sunita data leaked

# 7. Re-grant and retry
curl -X POST http://localhost:3001/consent/grant \
  -d '{"passportId":"<uuid>","scopes":["katha:read:memories"]}'
# Got new JWT
curl -X POST http://localhost:3002/trigger \
  -H "Authorization: Bearer <new-jwt>" \
  -d '{"trigger":"descendant-struggling-silently","passportId":"<uuid>"}'
# ✓ Grounded wisdom returns again

# 8. Verify audit trail
curl http://localhost:3001/audit/<passportId>
# ✓ Contains: trigger_activated, wisdom_delivered, consent_revoked,
#   trigger_denied, consent_granted, trigger_activated, wisdom_delivered

# 9. Verify statelessness
# Restart the engine process
# Fire trigger again with valid token
# ✓ Same quality response (no state was lost because none was stored)
```

**Pass criteria:** Grounded wisdom with valid token. Generic response on revocation. Re-grant works. Full audit trail. Stateless.

---

## CP-4: Full Demo Flow in Browser

**Gate for:** Phase 5 (Deployment)

**Precondition:** CP-1, CP-2, CP-3 all passed

**Verification steps (manual in browser):**

1. Open `http://localhost:3000` (dashboard)
   - ✓ App loads, navigation visible, no console errors

2. Navigate to **Ingest Trigger** screen
   - ✓ Click "Start Ingestion" for Sunita p04
   - ✓ Progress indicator shows extraction happening
   - ✓ Completion message with LMO count

3. Navigate to **Memory Approval** screen
   - ✓ 12+ unapproved LMOs listed
   - ✓ Each shows wisdom text, source reference, emotional weight
   - ✓ Recorded memories have solid badge
   - ✓ Approve each one individually (no bulk approve)

4. Navigate to **Consent Grant** screen
   - ✓ Plain-language scope descriptions displayed
   - ✓ Toggle scopes on, click "Grant Access"
   - ✓ JWT token visible (or "Access Granted" confirmation)

5. Fire a trigger (via UI or curl)
   - ✓ Response appears with grounded wisdom in Sunita's voice

6. Navigate to **Globe** (or globe view in dashboard)
   - ✓ 12 dots rendering on sphere
   - ✓ Dots vary in size (emotional weight) and color (life theme)
   - ✓ Hover/click on a dot shows MemoryCard
   - ✓ Card shows wisdom text, contributor, memory type

7. Navigate to **Consent Grant**, click "Revoke"
   - ✓ Fire trigger again → generic response (Sunita's data NOT present)

8. Click "Re-Grant"
   - ✓ Fire trigger again → Sunita's grounded wisdom returns

9. Navigate to **Audit Log**
   - ✓ Full chronological trail visible
   - ✓ Entries for: ingest, approve, grant, trigger, deliver, revoke, deny, re-grant, deliver

10. Navigate to **Passport Export**
    - ✓ Click "Export"
    - ✓ JSON-LD file downloads
    - ✓ Contains @context, @type, memories[], situationalIndex

**Pass criteria:** All 10 steps pass. No console errors. No silent failures. Every screen reachable. Globe renders. Consent flow complete.

---

## CP-5: Live at murailabs.com/katha

**Gate for:** Hackathon submission

**Verification steps:**

```bash
# 1. API health
curl https://murailabs.com/katha/api/health
# ✓ 200 OK

# 2. Dashboard loads
# Open https://murailabs.com/katha in browser
# ✓ React app loads, no errors

# 3. Full demo flow
# Repeat all CP-4 steps against production URL
# ✓ All pass

# 4. Revocation latency
# Time from revoke click to denied response
# ✓ < 1 second (no caching)

# 5. SSL
curl -I https://murailabs.com/katha/api/health
# ✓ Strict-Transport-Security header present
# ✓ Certificate valid (Cloudflare)

# 6. No data leaks
# Check network tab — no raw JSONL sent to external APIs
# Check responses — error messages contain no passport data
```

**Pass criteria:** Public URL works. Full demo flow passes. SSL valid. Revocation instant. No data leaks.
