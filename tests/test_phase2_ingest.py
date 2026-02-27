"""
test_phase2_ingest.py — Automated testing agent for Phase 2 (CP-2)

Runs after Phase 2 implementation is complete.
Executes all CP-2 verification steps programmatically.
Exit code 0 = all pass, non-zero = failures found.

Usage: python tests/test_phase2_ingest.py

Requires: Vault running on localhost:3001
"""

import io
import json
import os
import sys
import time

# Fix emoji output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import httpx

BASE = os.environ.get("VAULT_URL", "http://localhost:3001")
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
    global passed, failed
    print("=== KATHA Phase 2 Testing Agent (CP-2) ===\n")
    client = httpx.Client(base_url=BASE, timeout=120)

    # T1: Run demo_flow and measure time
    print("Running demo_flow.py...")
    start = time.time()
    exit_code = os.system(
        f'cd "{os.path.join(os.path.dirname(__file__), "..", "ingest")}" '
        f'&& python demo_flow.py --persona "{PERSONA_DIR}"'
    )
    elapsed = time.time() - start
    assert_check(exit_code == 0, "T1: demo_flow.py completes without error")
    assert_check(elapsed < 90, f"T2: Pipeline completes in < 90s (actual: {elapsed:.1f}s)")

    # T3: Verify passports exist
    res = client.get("/passports")
    data = res.json()
    passports = data.get("data", {}).get("passports", data.get("data", []))
    assert_check(len(passports) >= 1, "T3: At least one passport in Vault")

    if not passports:
        print("\n⛔ No passports found — cannot continue tests")
        _print_summary()
        sys.exit(1)

    passport_id = passports[0].get("passportId", passports[0].get("passport_id"))

    # T4: Verify LMO count
    res = client.get(f"/passport/{passport_id}/memories")
    data = res.json()
    memories = data.get("data", {}).get("memories", data.get("data", []))
    assert_check(len(memories) >= 12, f"T4: 12+ LMOs produced (actual: {len(memories)})")

    # T5: All LMOs have emotionalWeight >= 6
    weights = [m.get("emotionalWeight", m.get("emotional_weight", 0)) for m in memories]
    all_above_6 = all(w >= 6 for w in weights)
    assert_check(all_above_6, "T5: All LMOs have emotionalWeight >= 6")

    # T6: All LMOs have valid sourceRef
    source_refs = [m.get("sourceRef", m.get("source_ref", "")) for m in memories]
    all_have_refs = all(len(s) > 0 for s in source_refs)
    assert_check(all_have_refs, "T6: All LMOs have non-empty sourceRef")

    # T7: All LMOs have situationalTags from the taxonomy
    valid_triggers = {
        "descendant-struggling-silently",
        "descendant-considering-quitting",
        "descendant-first-failure",
        "descendant-leaving-home",
        "descendant-becoming-parent",
        "descendant-losing-someone",
        "descendant-facing-injustice",
        "descendant-celebrating-milestone",
        "descendant-feeling-alone",
        "descendant-questioning-identity",
        "descendant-making-sacrifice",
        "descendant-seeking-purpose",
    }
    all_tags = []
    for m in memories:
        tags = m.get("situationalTags", m.get("situational_tags", []))
        if isinstance(tags, str):
            tags = json.loads(tags)
        all_tags.extend(tags)
    all_valid = all(t in valid_triggers for t in all_tags)
    assert_check(all_valid, "T7: All situationalTags are from the 12-trigger taxonomy")

    # T8: All LMOs have memoryType = "recorded" (Sunita authored her own data)
    types = [m.get("memoryType", m.get("memory_type", "")) for m in memories]
    all_recorded = all(t == "recorded" for t in types)
    assert_check(all_recorded, "T8: All memoryType = 'recorded' for Sunita's data")

    # T9: Export validates as JSON-LD
    res = client.post("/passport/export", json={"passportId": passport_id})
    export_data = res.json()
    passport_export = export_data.get("data", {})
    assert_check("@context" in passport_export, "T9a: Exported passport has @context")
    assert_check("@type" in passport_export, "T9b: Exported passport has @type")
    assert_check("situationalIndex" in passport_export or "situational_index" in passport_export,
                 "T9c: Exported passport has situationalIndex")

    # T10: Idempotency — run again, same count
    print("\nRunning demo_flow.py again (idempotency check)...")
    os.system(
        f'cd "{os.path.join(os.path.dirname(__file__), "..", "ingest")}" '
        f'&& python demo_flow.py --persona "{PERSONA_DIR}"'
    )
    res2 = client.get(f"/passport/{passport_id}/memories")
    data2 = res2.json()
    memories2 = data2.get("data", {}).get("memories", data2.get("data", []))
    assert_check(
        len(memories2) == len(memories),
        f"T10: Idempotent — same LMO count after re-run ({len(memories2)} == {len(memories)})",
    )

    client.close()
    _print_summary()
    sys.exit(1 if failed > 0 else 0)


def _print_summary() -> None:
    print("\n=== Results ===")
    for r in results:
        icon = "✅" if r["status"] == "PASS" else "❌"
        print(f"  {icon} {r['label']}")
    print(f"\n  Total: {passed} passed, {failed} failed out of {passed + failed}")
    print(f"  {'🎉 CP-2 PASSED' if failed == 0 else '⛔ CP-2 FAILED'}\n")


if __name__ == "__main__":
    run()
