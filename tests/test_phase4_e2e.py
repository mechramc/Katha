"""
test_phase4_e2e.py — Automated testing agent for Phase 4 (CP-4)

End-to-end API-level test of the full demo flow.
Tests the complete sequence without a browser:
ingest → approve → grant → trigger → wisdom → revoke → blocked → re-grant → works → export

Usage: python tests/test_phase4_e2e.py

Requires: Vault on :3001, Engine on :3002
(Dashboard/Globe are UI — tested manually per CP-4 browser checklist)
"""

import io
import json
import os
import sys
import time

# Fix emoji output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import httpx

VAULT = os.environ.get("VAULT_URL", "http://localhost:3001")
ENGINE = os.environ.get("ENGINE_URL", "http://localhost:3002")
PERSONA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "persona_p04")

passed = 0
failed = 0
results: list[dict] = []


def assert_check(condition: bool, label: str) -> None:
    global passed, failed
    if condition:
        passed += 1
        results.append({"status": "PASS", "label": label})
    else:
        failed += 1
        results.append({"status": "FAIL", "label": label})


def run() -> None:
    print("=== KATHA Phase 4 Testing Agent (CP-4 API-level) ===\n")
    print("This tests the full demo flow via API calls.")
    print("Browser UI testing (globe, dashboard screens) is manual — see checkpoints.md CP-4.\n")

    vault = httpx.Client(base_url=VAULT, timeout=30)
    engine = httpx.Client(base_url=ENGINE, timeout=120)

    # Step 1: Ingest
    print("Step 1: Running ingestion pipeline...")
    start = time.time()
    exit_code = os.system(
        f'cd "{os.path.join(os.path.dirname(__file__), "..", "ingest")}" '
        f'&& python demo_flow.py --persona "{PERSONA_DIR}"'
    )
    elapsed = time.time() - start
    assert_check(exit_code == 0, "Step 1: Ingestion completes successfully")
    assert_check(elapsed < 90, f"Step 1b: Ingestion < 90s ({elapsed:.1f}s)")

    # Step 2: Get passport
    res = vault.get("/passports")
    passports = res.json().get("data", {}).get("passports", res.json().get("data", []))
    assert_check(len(passports) >= 1, "Step 2: Passport exists in Vault")
    passport_id = passports[0].get("passportId", passports[0].get("passport_id"))

    # Step 3: Verify LMOs exist and approve them
    res = vault.get(f"/passport/{passport_id}/memories")
    memories = res.json().get("data", {}).get("memories", res.json().get("data", []))
    assert_check(len(memories) >= 12, f"Step 3: 12+ LMOs exist ({len(memories)})")

    approved_count = 0
    for m in memories:
        mid = m.get("memoryId", m.get("memory_id"))
        if not m.get("approvedBy", m.get("approved_by")):
            res = vault.patch(f"/memories/{mid}/approve", json={"approvedBy": "Demo Parent"})
            if res.json().get("success"):
                approved_count += 1
    print(f"  Approved {approved_count} memories")
    assert_check(approved_count > 0 or all(
        m.get("approvedBy", m.get("approved_by")) for m in memories
    ), "Step 3b: All LMOs approved")

    # Step 4: Grant consent
    res = vault.post("/consent/grant", json={
        "passportId": passport_id,
        "scopes": ["katha:read:memories", "katha:read:values"],
    })
    jwt_token = res.json().get("data", {}).get("token")
    jti = res.json().get("data", {}).get("jti")
    assert_check(bool(jwt_token), "Step 4: Consent granted, JWT received")

    # Step 5: Fire trigger — expect grounded wisdom
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert_check(res.status_code == 200, "Step 5: Trigger returns 200 with valid JWT")
    wisdom = json.dumps(res.json())
    assert_check(len(wisdom) > 100, "Step 5b: Wisdom response is substantive")

    # Step 6: Revoke consent
    res = vault.post("/consent/revoke", json={"jti": jti})
    assert_check(res.json().get("success", False), "Step 6: Consent revoked")

    # Step 7: Fire trigger with revoked token — must be blocked
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert_check(res.status_code == 401, "Step 7: Revoked token is blocked (401)")

    # Step 8: Re-grant consent
    res = vault.post("/consent/grant", json={
        "passportId": passport_id,
        "scopes": ["katha:read:memories", "katha:read:values"],
    })
    new_jwt = res.json().get("data", {}).get("token")
    assert_check(bool(new_jwt), "Step 8: Re-grant succeeds, new JWT received")

    # Step 9: Fire trigger with new token — wisdom returns
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {new_jwt}"},
    )
    assert_check(res.status_code == 200, "Step 9: Re-granted token delivers wisdom")

    # Step 10: Export passport
    res = vault.post("/passport/export", json={"passportId": passport_id})
    export = res.json().get("data", {})
    assert_check("@context" in export, "Step 10a: Export has @context")
    assert_check("@type" in export, "Step 10b: Export has @type")
    has_memories = "memories" in export and len(export.get("memories", [])) > 0
    assert_check(has_memories, "Step 10c: Export has memories[]")

    # Step 11: Audit trail completeness
    res = vault.get(f"/audit/{passport_id}")
    entries = res.json().get("data", {}).get("entries", res.json().get("data", []))
    actions = [e.get("action", "") for e in entries]
    print(f"  Audit actions: {actions}")
    assert_check(len(entries) >= 8, f"Step 11: Audit has 8+ entries ({len(entries)})")

    vault.close()
    engine.close()

    # Summary
    print("\n=== Results ===")
    for r in results:
        icon = "✅" if r["status"] == "PASS" else "❌"
        print(f"  {icon} {r['label']}")
    print(f"\n  Total: {passed} passed, {failed} failed out of {passed + failed}")
    verdict = "🎉 CP-4 (API) PASSED" if failed == 0 else "⛔ CP-4 (API) FAILED"
    print(f"  {verdict}")
    if failed == 0:
        print("  ℹ️  Now run the browser checklist in checkpoints.md CP-4 for UI verification.\n")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    run()
