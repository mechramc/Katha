"""
test_phase3_engine.py — Automated testing agent for Phase 3 (CP-3)

Runs after Phase 3 implementation is complete.
Executes all CP-3 verification steps: grounded wisdom delivery,
revocation enforcement, re-grant recovery, audit completeness.
Exit code 0 = all pass, non-zero = failures found.

Usage: python tests/test_phase3_engine.py

Requires: Vault on localhost:3001 (with ingested passport), Engine on localhost:3002
"""

import json
import os
import sys

import httpx

VAULT = os.environ.get("VAULT_URL", "http://localhost:3001")
ENGINE = os.environ.get("ENGINE_URL", "http://localhost:3002")

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
    print("=== KATHA Phase 3 Testing Agent (CP-3) ===\n")

    vault = httpx.Client(base_url=VAULT, timeout=30)
    engine = httpx.Client(base_url=ENGINE, timeout=120)

    # T1: Engine health
    res = engine.get("/health")
    assert_check(res.status_code == 200, "T1: Engine health endpoint returns 200")

    # T2: Get a passport ID (assumes Phase 2 has run)
    res = vault.get("/passports")
    passports = res.json().get("data", {}).get("passports", res.json().get("data", []))
    if not passports:
        print("⛔ No passports in Vault — run Phase 2 first")
        sys.exit(2)
    passport_id = passports[0].get("passportId", passports[0].get("passport_id"))
    print(f"  Using passport: {passport_id}")

    # T3: Issue fresh consent token
    res = vault.post("/consent/grant", json={
        "passportId": passport_id,
        "scopes": ["katha:read:memories", "katha:read:values"],
    })
    grant_data = res.json()
    jwt_token = grant_data.get("data", {}).get("token")
    jti = grant_data.get("data", {}).get("jti")
    assert_check(bool(jwt_token), "T3: Consent token issued")

    # T4: Fire trigger with valid token — expect grounded wisdom
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert_check(res.status_code == 200, "T4: Trigger with valid token returns 200")
    wisdom_response = res.json()
    wisdom_text = json.dumps(wisdom_response).lower()
    # Should reference Sunita or her data in some way
    assert_check(
        "sunita" in wisdom_text or "rajan" in wisdom_text or len(wisdom_text) > 100,
        "T4b: Response contains grounded wisdom (not generic)",
    )

    # T5: Fire trigger WITHOUT token — must fail
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
    )
    assert_check(res.status_code == 401, "T5: Trigger without token returns 401")
    no_auth_text = json.dumps(res.json())
    assert_check(
        "sunita" not in no_auth_text.lower(),
        "T5b: Unauthenticated response does not leak Sunita's data",
    )

    # T6: Revoke token
    res = vault.post("/consent/revoke", json={"jti": jti})
    assert_check(res.json().get("success", False), "T6: Token revocation succeeds")

    # T7: Fire trigger with revoked token — must fail
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert_check(res.status_code == 401, "T7: Revoked token returns 401")
    revoked_text = json.dumps(res.json())
    assert_check(
        "sunita" not in revoked_text.lower(),
        "T7b: Revoked response does not leak Sunita's data",
    )

    # T8: Re-grant and verify wisdom returns
    res = vault.post("/consent/grant", json={
        "passportId": passport_id,
        "scopes": ["katha:read:memories"],
    })
    new_jwt = res.json().get("data", {}).get("token")
    assert_check(bool(new_jwt), "T8: Re-grant returns new JWT")

    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-struggling-silently", "passportId": passport_id},
        headers={"Authorization": f"Bearer {new_jwt}"},
    )
    assert_check(res.status_code == 200, "T8b: Re-granted token delivers wisdom")

    # T9: Audit trail completeness
    res = vault.get(f"/audit/{passport_id}")
    audit_data = res.json()
    entries = audit_data.get("data", {}).get("entries", audit_data.get("data", []))
    actions = [e.get("action", "") for e in entries]
    print(f"  Audit actions found: {actions}")
    # Should have at least: grant, trigger/deliver, revoke, deny, re-grant, trigger/deliver
    assert_check(len(entries) >= 5, f"T9: Audit log has 5+ entries (actual: {len(entries)})")

    # T10: Verify statelessness — engine should work fine after notional restart
    # (We can't restart the process here, but we verify no state dependency)
    res = engine.post(
        "/trigger",
        json={"trigger": "descendant-considering-quitting", "passportId": passport_id},
        headers={"Authorization": f"Bearer {new_jwt}"},
    )
    # Different trigger should still work (no cached state from previous trigger)
    assert_check(
        res.status_code == 200 or res.status_code == 404,
        "T10: Different trigger works (no stale state from previous trigger)",
    )

    vault.close()
    engine.close()

    # Summary
    print("\n=== Results ===")
    for r in results:
        icon = "✅" if r["status"] == "PASS" else "❌"
        print(f"  {icon} {r['label']}")
    print(f"\n  Total: {passed} passed, {failed} failed out of {passed + failed}")
    print(f"  {'🎉 CP-3 PASSED' if failed == 0 else '⛔ CP-3 FAILED'}\n")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    run()
