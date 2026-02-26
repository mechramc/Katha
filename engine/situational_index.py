"""
situational_index.py -- Trigger taxonomy and memory matching.

Loads the 12 predefined situational triggers and provides filtering/ranking
of Living Memory Objects by trigger match and emotional weight.
Uses the taxonomy defined in schema/situational-trigger-taxonomy.json.
"""

import logging
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# -- 12 Predefined Triggers ---------------------------------------------------

TRIGGERS: dict[str, dict[str, Any]] = {
    "descendant-struggling-silently": {
        "label": "Struggling Silently",
        "description": "The descendant is facing hardship but not asking for help.",
        "related_themes": ["persistence", "endurance", "unconditional-support"],
    },
    "descendant-considering-quitting": {
        "label": "Considering Quitting",
        "description": "The descendant is thinking about giving up on something important.",
        "related_themes": ["persistence", "failure-recovery", "endurance"],
    },
    "descendant-first-failure": {
        "label": "First Failure",
        "description": "The descendant is experiencing a significant failure for the first time.",
        "related_themes": ["failure-recovery", "persistence", "wonder"],
    },
    "descendant-leaving-home": {
        "label": "Leaving Home",
        "description": "The descendant is moving away from family for the first time.",
        "related_themes": ["identity", "letting-go", "love-as-action"],
    },
    "descendant-becoming-parent": {
        "label": "Becoming a Parent",
        "description": "The descendant is becoming a parent themselves.",
        "related_themes": ["love-as-action", "unconditional-support", "identity"],
    },
    "descendant-losing-someone": {
        "label": "Losing Someone",
        "description": "The descendant is grieving a loss.",
        "related_themes": ["letting-go", "love-as-action", "endurance"],
    },
    "descendant-facing-injustice": {
        "label": "Facing Injustice",
        "description": "The descendant is confronting unfairness or discrimination.",
        "related_themes": ["persistence", "identity", "endurance"],
    },
    "descendant-celebrating-milestone": {
        "label": "Celebrating a Milestone",
        "description": "The descendant is achieving something worth celebrating.",
        "related_themes": ["wonder", "love-as-action", "persistence"],
    },
    "descendant-feeling-alone": {
        "label": "Feeling Alone",
        "description": "The descendant feels isolated or disconnected from family.",
        "related_themes": ["unconditional-support", "love-as-action", "identity"],
    },
    "descendant-questioning-identity": {
        "label": "Questioning Identity",
        "description": "The descendant is wrestling with who they are.",
        "related_themes": ["identity", "letting-go", "wonder"],
    },
    "descendant-making-sacrifice": {
        "label": "Making a Sacrifice",
        "description": "The descendant is giving up something important for someone else.",
        "related_themes": ["love-as-action", "letting-go", "endurance"],
    },
    "descendant-seeking-purpose": {
        "label": "Seeking Purpose",
        "description": "The descendant is searching for meaning or direction in life.",
        "related_themes": ["identity", "wonder", "persistence"],
    },
}

VALID_TRIGGER_IDS: set[str] = set(TRIGGERS.keys())

LIFE_THEMES: set[str] = {
    "failure-recovery",
    "love-as-action",
    "persistence",
    "identity",
    "letting-go",
    "unconditional-support",
    "wonder",
    "endurance",
}


class MatchedMemory(BaseModel):
    """A memory that matched a trigger, with its match metadata."""

    memory_id: str
    contributor_name: str
    emotional_weight: int
    life_theme: str
    situational_tags: list[str]
    memory_type: str  # "recorded" | "reconstructed"
    text: str
    source_ref: str
    match_type: str  # "direct" (tag match) or "thematic" (theme match)


def is_valid_trigger(trigger_id: str) -> bool:
    """Check if a trigger ID is one of the 12 predefined triggers."""
    return trigger_id in VALID_TRIGGER_IDS


def get_trigger_info(trigger_id: str) -> dict[str, Any] | None:
    """Return metadata for a trigger, or None if invalid."""
    return TRIGGERS.get(trigger_id)


def match_trigger(trigger_id: str, memories: list[dict[str, Any]]) -> list[MatchedMemory]:
    """
    Filter and rank memories by situational trigger match.

    Matching strategy:
    1. Direct match: memory\'s situationalTags contains the trigger_id
    2. Thematic fallback: memory\'s lifeTheme matches one of the trigger\'s related themes

    Results ranked by emotionalWeight descending, direct matches first.
    """
    if not is_valid_trigger(trigger_id):
        logger.warning("Unknown trigger_id: %s", trigger_id)
        return []

    trigger_info = TRIGGERS[trigger_id]
    related_themes = set(trigger_info.get("related_themes", []))

    direct_matches: list[MatchedMemory] = []
    thematic_matches: list[MatchedMemory] = []

    for mem in memories:
        tags = mem.get("situationalTags", [])
        if not isinstance(tags, list):
            tags = []

        theme = mem.get("lifeTheme", "")
        memory_id = mem.get("memoryId", "")
        contributor_name = mem.get("contributorName", "")
        emotional_weight = mem.get("emotionalWeight", 0)
        memory_type = mem.get("memoryType", "recorded")
        text = mem.get("text", "")
        source_ref = mem.get("sourceRef", "")

        matched = MatchedMemory(
            memory_id=memory_id,
            contributor_name=contributor_name,
            emotional_weight=emotional_weight,
            life_theme=theme,
            situational_tags=tags,
            memory_type=memory_type,
            text=text,
            source_ref=source_ref,
            match_type="",
        )

        if trigger_id in tags:
            matched.match_type = "direct"
            direct_matches.append(matched)
        elif theme in related_themes:
            matched.match_type = "thematic"
            thematic_matches.append(matched)

    # Sort each group by emotionalWeight descending
    direct_matches.sort(key=lambda m: m.emotional_weight, reverse=True)
    thematic_matches.sort(key=lambda m: m.emotional_weight, reverse=True)

    # Direct matches first, then thematic
    combined = direct_matches + thematic_matches

    logger.info(
        "Trigger \'%s\': %d direct matches, %d thematic matches",
        trigger_id,
        len(direct_matches),
        len(thematic_matches),
    )

    return combined
