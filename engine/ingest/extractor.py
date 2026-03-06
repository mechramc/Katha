"""
extractor.py -- Claude API wisdom extraction.

Sends ONLY the text field from each record to Claude (never raw JSONL).
Uses the sacred extraction prompt from AGENTS.md (DO NOT MODIFY THE PROMPT).
Implements batching, timeout, and exponential backoff retry.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Optional

import anthropic

from ingest.models import RawRecord, WisdomSignal

logger = logging.getLogger(__name__)
# ---------------------------------------------------------------------------
# Sacred extraction prompt -- DO NOT MODIFY
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM_PROMPT = """You are a wisdom archaeologist. You read personal data and find
the living wisdom embedded in everyday moments -- not stated explicitly,
but revealed through patterns, actions, and choices.

For each entry, extract:
1. wisdomSignal: what this reveals about how this person lives
2. valueExpressed: what they believe, shown through action (not words)
3. situationalTagCandidates: when a descendant would need this wisdom
4. emotionalWeight: 1-10, how formative is this moment
5. lifeTheme: one of [failure-recovery, love-as-action, persistence,
   identity, letting-go, unconditional-support, wonder, endurance]

CRITICAL CONSTRAINTS:
- Be specific. "She sends money without announcing it" is correct.
  "She is generous" is not. Find the specific.
- Only return entries with emotionalWeight >= 6.
- content.original must be the verbatim source text. Never paraphrase it.
- wisdomExtracted is your interpretation. Mark it clearly as interpretation.
- Do not invent memories. Do not extrapolate beyond what the data shows.
- If an entry has no wisdom signal, return null for that entry.

Return a JSON array of LivingMemoryObjects. Schema in schema/living-memory-object-v1.json."""

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_BATCH_SIZE: int = 10
MAX_RETRIES: int = 4
INITIAL_BACKOFF_SECONDS: float = 2.0
REQUEST_TIMEOUT_SECONDS: float = 120.0
MODEL: str = "claude-sonnet-4-6"

def _build_user_message(records: list[RawRecord]) -> str:
    """
    Build the user message for a batch of records.

    CRITICAL: Only the text field is sent to Claude. Never raw JSONL.
    Each entry includes the record ID (for tracing) and the text only.
    """
    entries: list[str] = []
    for record in records:
        entries.append(
            f"[Record {record.id}]\n{record.text}"
        )
    return (
        "Extract living wisdom from the following personal entries. "
        "Return a JSON array. For entries with no wisdom signal, return null in the array.\n\n"
        + "\n\n---\n\n".join(entries)
    )


def _call_claude_with_retry(
    client: anthropic.Anthropic,
    user_message: str,
) -> str:
    """Call Claude API with exponential backoff retry on transient failures."""
    backoff = INITIAL_BACKOFF_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info("Claude API call attempt %d/%d", attempt, MAX_RETRIES)
            response = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=EXTRACTION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            text_content = response.content[0].text
            return text_content

        except anthropic.RateLimitError as exc:
            logger.warning("Rate limited (attempt %d): %s", attempt, exc)
            if attempt == MAX_RETRIES:
                raise
            time.sleep(backoff)
            backoff *= 2

        except anthropic.APITimeoutError as exc:
            logger.warning("Timeout (attempt %d): %s", attempt, exc)
            if attempt == MAX_RETRIES:
                raise
            time.sleep(backoff)
            backoff *= 2

        except anthropic.APIConnectionError as exc:
            logger.warning("Connection error (attempt %d): %s", attempt, exc)
            if attempt == MAX_RETRIES:
                raise
            time.sleep(backoff)
            backoff *= 2

    raise RuntimeError("Exhausted retries for Claude API call")

def _parse_response(
    raw_json: str,
    records: list[RawRecord],
) -> list[WisdomSignal]:
    """Parse Claude JSON response into WisdomSignal objects."""
    text = raw_json.strip()
    if text.startswith("```"):
        tl = text.split("\n")
        text = "\n".join(tl[1:-1]).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude response: %s", exc)
        return []
    if not isinstance(parsed, list):
        logger.error("Expected JSON array, got %s", type(parsed).__name__)
        return []
    rmap: dict[str, RawRecord] = {r.id: r for r in records}
    sigs: list[WisdomSignal] = []
    for i, item in enumerate(parsed):
        if item is None:
            continue
        try:
            sid = (item.get("sourceRef") or item.get("source_ref")
                   or item.get("recordId") or item.get("record_id")
                   or (records[i].id if i < len(records) else f"unknown_{i}"))
            co = item.get("content", {})
            ot = co.get("original", "") if isinstance(co, dict) else ""
            if not ot:
                ot = item.get("original_text") or item.get("text") or ""
            if not ot:
                sr = rmap.get(sid)
                if sr:
                    ot = sr.text
                elif i < len(records):
                    ot = records[i].text
            w = (item.get("wisdomSignal") or item.get("wisdom_signal")
                 or item.get("wisdomExtracted") or item.get("wisdom_extracted") or "")
            v = item.get("valueExpressed") or item.get("value_expressed") or ""
            tg = (item.get("situationalTagCandidates")
                  or item.get("situational_tag_candidates")
                  or item.get("situationalTags") or [])
            wt = int(item.get("emotionalWeight") or item.get("emotional_weight") or 0)
            th = item.get("lifeTheme") or item.get("life_theme") or ""
            if wt < 1 or not w:
                continue
            sigs.append(WisdomSignal(
                source_record_id=sid, original_text=ot, wisdom_signal=w,
                value_expressed=v,
                situational_tag_candidates=tg if isinstance(tg, list) else [tg],
                emotional_weight=min(max(wt, 1), 10), life_theme=th,
            ))
        except Exception as exc:
            logger.warning("Failed to parse signal at index %d: %s", i, exc)
    return sigs

def extract_wisdom(
    records: list[RawRecord],
    batch_size: int = DEFAULT_BATCH_SIZE,
    api_key: Optional[str] = None,
) -> list[WisdomSignal]:
    """
    Extract wisdom signals from a list of records using Claude API.

    Records are processed in batches. Only the text field of each record
    is sent to Claude (never raw JSONL data).

    Args:
        records: Deduplicated RawRecords from the loader.
        batch_size: Number of records per Claude API call.
        api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var).

    Returns:
        List of WisdomSignal objects extracted by Claude.
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY is required. Set it as an environment variable "
            "or pass api_key to extract_wisdom()."
        )

    client = anthropic.Anthropic(api_key=key)

    all_signals: list[WisdomSignal] = []
    total_batches = (len(records) + batch_size - 1) // batch_size

    for batch_idx in range(total_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, len(records))
        batch = records[start:end]

        logger.info(
            "Processing batch %d/%d (%d records)",
            batch_idx + 1,
            total_batches,
            len(batch),
        )

        user_message = _build_user_message(batch)
        raw_response = _call_claude_with_retry(client, user_message)
        signals = _parse_response(raw_response, batch)

        logger.info(
            "Batch %d/%d yielded %d wisdom signals",
            batch_idx + 1,
            total_batches,
            len(signals),
        )
        all_signals.extend(signals)

    logger.info(
        "Extraction complete: %d signals from %d records",
        len(all_signals),
        len(records),
    )
    return all_signals
