"""
demo_flow.py -- Full end-to-end demo pipeline.

Runs the complete ingestion flow for a persona:
1. Load JSONL files and deduplicate
2. Extract wisdom via Claude API
3. Classify and gate LMOs (emotionalWeight >= 6)
4. Assemble Cultural Memory Passport
5. Write passport + memories to Vault

Target: Complete in < 90 seconds.

Usage:
    python -m ingest.demo_flow --persona ../data/persona_p04/
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from dotenv import load_dotenv

from ingest.assembler import assemble_and_submit
from ingest.classifier import classify_and_gate
from ingest.extractor import extract_wisdom
from ingest.loader import load
from ingest.models import IngestResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("katha.demo")


async def run_pipeline(
    persona_dir: str, vault_url: str = "http://localhost:3001",
    passport_id: str | None = None,
) -> IngestResult:
    """Execute the full ingestion pipeline."""
    start_time = time.monotonic()

    logger.info("=" * 60)
    logger.info("STEP 1: Loading records from %s", persona_dir)
    logger.info("=" * 60)
    records, profile = load(persona_dir)
    total_loaded = len(records)
    contributor_name: str = profile.get("name", "Unknown")
    persona_id: str = profile.get("persona_id", "unknown")
    logger.info("Loaded %d unique records for %s (%s)", total_loaded, contributor_name, persona_id)

    logger.info("=" * 60)
    logger.info("STEP 2: Extracting wisdom via Claude API")
    logger.info("=" * 60)
    signals = extract_wisdom(records)
    logger.info("Extracted %d wisdom signals", len(signals))

    logger.info("=" * 60)
    logger.info("STEP 3: Classifying and gating LMOs (weight >= 6)")
    logger.info("=" * 60)
    lmos = classify_and_gate(signals, contributor_name)
    logger.info("%d LMOs passed the emotional weight gate", len(lmos))

    logger.info("=" * 60)
    logger.info("STEP 4: Assembling passport and submitting to vault")
    logger.info("=" * 60)
    passport_id, memories_posted, passport = await assemble_and_submit(
        lmos=lmos, profile=profile, total_source_records=total_loaded, vault_url=vault_url,
        passport_id=passport_id,
    )

    elapsed = time.monotonic() - start_time

    output_dir = Path(persona_dir) / "output"
    output_dir.mkdir(exist_ok=True)
    passport_path = output_dir / "cultural-memory-passport.json"
    with open(passport_path, "w", encoding="utf-8") as f:
        json.dump(passport, f, indent=2, ensure_ascii=False)
    logger.info("Passport written to %s", passport_path)

    result = IngestResult(
        persona_id=persona_id, contributor_name=contributor_name,
        total_records_loaded=total_loaded, unique_records=total_loaded,
        wisdom_signals_extracted=len(signals), lmos_after_gate=len(lmos),
        passport_id=passport_id, memories_posted=memories_posted,
        elapsed_seconds=round(elapsed, 2),
    )

    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info("Persona:             %s (%s)", contributor_name, persona_id)
    logger.info("Records loaded:      %d", result.total_records_loaded)
    logger.info("Unique records:      %d", result.unique_records)
    logger.info("Wisdom signals:      %d", result.wisdom_signals_extracted)
    logger.info("LMOs (after gate):   %d", result.lmos_after_gate)
    logger.info("Passport ID:         %s", result.passport_id or "FAILED")
    logger.info("Memories posted:     %d", result.memories_posted)
    logger.info("Elapsed time:        %.2fs", result.elapsed_seconds)
    if elapsed > 90:
        logger.warning("Pipeline exceeded 90-second target (%.2fs)", elapsed)
    else:
        logger.info("Within 90-second target.")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="KATHA Ingestion Pipeline -- Demo Flow")
    parser.add_argument("--persona", type=str, required=True, help="Path to persona data directory")
    parser.add_argument("--vault-url", type=str, default="http://localhost:3001", help="Vault API base URL")
    args = parser.parse_args()
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded environment from %s", env_path)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY not set. Set it in .env or environment.")
        sys.exit(1)
    result = asyncio.run(run_pipeline(args.persona, args.vault_url))
    if not result.passport_id:
        logger.error("Pipeline completed but passport creation failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
