"""
assembler.py -- Passport assembly and vault submission.

Responsibility:
- Collect LMOs into a Cultural Memory Passport (JSON-LD)
- Build the situational index (trigger -> memoryId[])
- POST passport to Vault API
- POST each LMO as a memory to Vault API
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

import httpx

from ingest.models import LivingMemoryObject, VALID_SITUATIONAL_TRIGGERS

logger = logging.getLogger(__name__)

DEFAULT_VAULT_URL: str = "http://localhost:3001"
HTTP_TIMEOUT_SECONDS: float = 30.0


def build_situational_index(lmos: list[LivingMemoryObject]) -> dict[str, list[str]]:
    """Build the situational index mapping each trigger to memory IDs."""
    index: dict[str, list[str]] = {t: [] for t in sorted(VALID_SITUATIONAL_TRIGGERS)}
    for lmo in lmos:
        for tag in lmo.situational_tags:
            if tag in index:
                index[tag].append(lmo.memory_id)
    non_empty = sum(1 for v in index.values() if v)
    logger.info("Situational index: %d triggers populated out of %d", non_empty, len(index))
    return index


def build_passport(
    lmos: list[LivingMemoryObject],
    profile: dict[str, Any],
    total_source_records: int,
) -> dict[str, Any]:
    """Assemble a Cultural Memory Passport as a JSON-LD document."""
    contributor_name: str = profile.get("name", "Unknown")
    family_name: str = contributor_name.split()[-1] if contributor_name else "Unknown"
    situational_index = build_situational_index(lmos)
    theme_counts: dict[str, int] = defaultdict(int)
    for lmo in lmos:
        theme_counts[lmo.life_theme] += 1
    sorted_themes = sorted(theme_counts.items(), key=lambda x: -x[1])
    values: list[str] = [theme for theme, _ in sorted_themes]
    memories: list[dict[str, Any]] = []
    for lmo in lmos:
        memories.append({
            "memoryId": lmo.memory_id,
            "sourceRef": lmo.source_ref,
            "contributor": {"name": lmo.contributor_name, "relationship": "self"},
            "emotionalWeight": lmo.emotional_weight,
            "lifeTheme": lmo.life_theme,
            "situationalTags": lmo.situational_tags,
            "memoryType": lmo.memory_type,
            "verifiedBySubject": lmo.verified_by_subject,
            "text": lmo.text,
            "createdAt": lmo.created_at,
        })
    now_iso = datetime.utcnow().isoformat() + "Z"
    passport: dict[str, Any] = {
        "@context": "https://katha.dev/schema/v1",
        "@type": "CulturalMemoryPassport",
        "heritage": {
            "familyName": family_name,
            "primaryContributor": {
                "name": contributor_name,
                "role": profile.get("job", "contributor"),
                "birthYear": datetime.now().year - profile.get("age", 0) if profile.get("age") else None,
                "culturalBackground": "South Indian Tamil",
                "occupation": profile.get("job", ""),
            },
            "languages": ["English", "Tamil"],
        },
        "values": values,
        "memories": memories,
        "situationalIndex": situational_index,
        "meta": {
            "createdAt": now_iso, "version": "1.0",
            "sourceCount": total_source_records, "lmoCount": len(lmos),
        },
    }
    return passport


async def post_passport_to_vault(
    passport: dict[str, Any], vault_url: str = DEFAULT_VAULT_URL,
) -> Optional[str]:
    """POST the passport to the Vault API. Returns passportId or None."""
    contributor = passport.get("heritage", {}).get("primaryContributor", {})
    family_name = passport.get("heritage", {}).get("familyName", "Unknown")
    body = {"familyName": family_name, "contributor": contributor.get("name", "Unknown"), "passportData": passport}
    url = f"{vault_url}/passport"
    logger.info("POSTing passport to %s", url)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            passport_id = data.get("data", {}).get("passportId")
            logger.info("Passport created with ID: %s", passport_id)
            return passport_id
        except httpx.HTTPStatusError as exc:
            logger.error("Vault returned %d for passport POST: %s", exc.response.status_code, exc.response.text[:500])
            return None
        except httpx.RequestError as exc:
            logger.error("Failed to reach vault at %s: %s", url, exc)
            return None


async def post_memories_to_vault(
    lmos: list[LivingMemoryObject], passport_id: str, vault_url: str = DEFAULT_VAULT_URL,
) -> int:
    """POST each LMO as a memory to the Vault API. Returns count of posted memories."""
    url = f"{vault_url}/memories"
    posted = 0
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        for lmo in lmos:
            body = {
                "passportId": passport_id, "memoryId": lmo.memory_id,
                "sourceRef": lmo.source_ref, "contributorName": lmo.contributor_name,
                "emotionalWeight": lmo.emotional_weight, "lifeTheme": lmo.life_theme,
                "situationalTags": lmo.situational_tags, "memoryType": lmo.memory_type,
                "verifiedBySubject": lmo.verified_by_subject, "text": lmo.text,
            }
            try:
                resp = await client.post(url, json=body)
                resp.raise_for_status()
                posted += 1
            except httpx.HTTPStatusError as exc:
                logger.error("Vault returned %d for memory %s", exc.response.status_code, lmo.memory_id)
            except httpx.RequestError as exc:
                logger.error("Failed to post memory %s: %s", lmo.memory_id, exc)
    logger.info("Posted %d/%d memories to vault", posted, len(lmos))
    return posted


async def assemble_and_submit(
    lmos: list[LivingMemoryObject], profile: dict[str, Any],
    total_source_records: int, vault_url: str = DEFAULT_VAULT_URL,
) -> tuple[Optional[str], int, dict[str, Any]]:
    """Full assembly: build passport, submit to vault, submit memories."""
    passport = build_passport(lmos, profile, total_source_records)
    logger.info("Assembled passport with %d memories, submitting to vault", len(lmos))
    passport_id = await post_passport_to_vault(passport, vault_url)
    memories_posted = 0
    if passport_id:
        memories_posted = await post_memories_to_vault(lmos, passport_id, vault_url)
        passport["passportId"] = passport_id
    else:
        logger.error("Passport submission failed; skipping memory submission")
    return passport_id, memories_posted, passport
