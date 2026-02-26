"""
classifier.py -- LMO classification and emotional weight gating.

Responsibility:
- Validate emotionalWeight >= 6 gate (discard lower)
- Map situational tag candidates to official trigger taxonomy
- Validate lifeTheme against official themes
- Build fully formed LivingMemoryObject with UUIDs
"""

from __future__ import annotations

import logging
import uuid

from ingest.models import (
    VALID_LIFE_THEMES,
    VALID_SITUATIONAL_TRIGGERS,
    LivingMemoryObject,
    WisdomSignal,
)

logger = logging.getLogger(__name__)

EMOTIONAL_WEIGHT_GATE: int = 6


def _normalize_trigger(candidate: str) -> str | None:
    """Map a free-form situational tag candidate to an official trigger ID."""
    normalized = candidate.strip().lower()
    if normalized in VALID_SITUATIONAL_TRIGGERS:
        return normalized
    with_prefix = f"descendant-{normalized}"
    if with_prefix in VALID_SITUATIONAL_TRIGGERS:
        return with_prefix
    for trigger in VALID_SITUATIONAL_TRIGGERS:
        core = trigger.replace("descendant-", "")
        if core in normalized or normalized in core:
            return trigger
    keyword_map: dict[str, str] = {
        "struggle": "descendant-struggling-silently",
        "silent": "descendant-struggling-silently",
        "quit": "descendant-considering-quitting",
        "giving up": "descendant-considering-quitting",
        "fail": "descendant-first-failure",
        "rejection": "descendant-first-failure",
        "leaving": "descendant-leaving-home",
        "moving away": "descendant-leaving-home",
        "parent": "descendant-becoming-parent",
        "child": "descendant-becoming-parent",
        "loss": "descendant-losing-someone",
        "grief": "descendant-losing-someone",
        "death": "descendant-losing-someone",
        "injustice": "descendant-facing-injustice",
        "discrimination": "descendant-facing-injustice",
        "unfair": "descendant-facing-injustice",
        "milestone": "descendant-celebrating-milestone",
        "celebration": "descendant-celebrating-milestone",
        "achievement": "descendant-celebrating-milestone",
        "alone": "descendant-feeling-alone",
        "lonely": "descendant-feeling-alone",
        "isolated": "descendant-feeling-alone",
        "identity": "descendant-questioning-identity",
        "who am i": "descendant-questioning-identity",
        "sacrifice": "descendant-making-sacrifice",
        "purpose": "descendant-seeking-purpose",
        "meaning": "descendant-seeking-purpose",
        "direction": "descendant-seeking-purpose",
    }
    for keyword, trigger in keyword_map.items():
        if keyword in normalized:
            return trigger
    return None


def _validate_life_theme(theme: str) -> str:
    """Validate and normalize a life theme against the official set."""
    normalized = theme.strip().lower()
    if normalized in VALID_LIFE_THEMES:
        return normalized
    alias_map: dict[str, str] = {
        "resilience": "persistence",
        "sacrifice": "love-as-action",
        "generosity": "love-as-action",
        "love": "love-as-action",
        "support": "unconditional-support",
        "failure": "failure-recovery",
        "recovery": "failure-recovery",
        "curiosity": "wonder",
        "discovery": "wonder",
        "loss": "letting-go",
        "grief": "letting-go",
        "self": "identity",
        "who-i-am": "identity",
        "grit": "endurance",
        "stamina": "endurance",
        "determination": "persistence",
    }
    for alias, theme_id in alias_map.items():
        if alias in normalized:
            return theme_id
    logger.warning("Unrecognized life theme, defaulting to persistence: %s", theme)
    return "persistence"


def classify_and_gate(
    signals: list[WisdomSignal],
    contributor_name: str,
) -> list[LivingMemoryObject]:
    """Apply emotional weight gate and build validated LMOs."""
    pre_gate = len(signals)
    lmos: list[LivingMemoryObject] = []
    for signal in signals:
        if signal.emotional_weight < EMOTIONAL_WEIGHT_GATE:
            continue
        valid_tags: list[str] = []
        for candidate in signal.situational_tag_candidates:
            mapped = _normalize_trigger(candidate)
            if mapped and mapped not in valid_tags:
                valid_tags.append(mapped)
        if not valid_tags:
            theme_defaults: dict[str, str] = {
                "failure-recovery": "descendant-first-failure",
                "love-as-action": "descendant-struggling-silently",
                "persistence": "descendant-considering-quitting",
                "identity": "descendant-questioning-identity",
                "letting-go": "descendant-losing-someone",
                "unconditional-support": "descendant-feeling-alone",
                "wonder": "descendant-seeking-purpose",
                "endurance": "descendant-considering-quitting",
            }
            vt = _validate_life_theme(signal.life_theme)
            valid_tags = [theme_defaults.get(vt, "descendant-seeking-purpose")]
        validated_theme = _validate_life_theme(signal.life_theme)
        lmo = LivingMemoryObject(
            memory_id=str(uuid.uuid4()),
            source_ref=signal.source_record_id,
            contributor_name=contributor_name,
            emotional_weight=signal.emotional_weight,
            life_theme=validated_theme,
            situational_tags=valid_tags,
            memory_type="recorded",
            verified_by_subject=True,
            text=signal.original_text,
            wisdom_extracted=signal.wisdom_signal,
            value_expressed=signal.value_expressed,
        )
        lmos.append(lmo)
    gated_out = pre_gate - len(lmos)
    logger.info(
        "Classification: %d signals -> %d LMOs (%d gated out below weight %d)",
        pre_gate, len(lmos), gated_out, EMOTIONAL_WEIGHT_GATE,
    )
    return lmos
