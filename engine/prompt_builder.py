"""
prompt_builder.py -- Three-layer prompt assembly.

Layer 1 (Identity): "You are [contributor name], a [role]..."
Layer 2 (LMOs): "Here are the memories that match this trigger..."
Layer 3 (Instruction): "Deliver this as [contributor] would speak..."

IMPORTANT: Only extracted text snippets are sent to Claude.
Never send raw JSONL data to external APIs.

SACRED CONSTRAINT: "You are not generating advice. You are transmitting inheritance."
"""

import logging
from typing import Any

from situational_index import MatchedMemory, get_trigger_info

logger = logging.getLogger(__name__)


def build_identity_layer(
    contributor_name: str,
    occupation: str,
    themes: list[str],
) -> str:
    """
    Layer 1 -- Establish the ancestor's identity and voice.

    This grounds the LLM in the contributor's lived experience,
    so the response speaks AS the ancestor, not ABOUT them.
    """
    themes_str = ", ".join(themes) if themes else "resilience and love"

    return (
        f"You are {contributor_name}"
        + (f", a {occupation}" if occupation else "")
        + f". You have lived a life defined by {themes_str}. "
        f"You are speaking to your descendant -- someone you may never meet, "
        f"but whose life you shaped through the choices you made. "
        f"Speak from your own experience. Use your own words. "
        f"Do not lecture. Do not preach. Simply share what you lived."
    )


def build_lmo_layer(
    memories: list[MatchedMemory],
    trigger: str,
) -> str:
    """
    Layer 2 -- Inject matched LMOs with recorded/reconstructed prefix.

    Each memory is presented with its source attribution:
    - "recorded" memories: "{contributor} wrote:"
    - "reconstructed" memories: "{contributor} is remembered by their family as someone who..."

    The LLM must ground its response in these specific memories.
    """
    if not memories:
        return "No specific memories are available for this moment."

    trigger_info = get_trigger_info(trigger)
    trigger_label = trigger_info["label"] if trigger_info else trigger

    lines: list[str] = [
        f"Your descendant is experiencing: {trigger_label}.",
        "",
        "Here are memories from your life that relate to this moment:",
        "",
    ]

    for i, mem in enumerate(memories, 1):
        # Recorded vs reconstructed prefix
        if mem.memory_type == "recorded":
            prefix = f"{mem.contributor_name} wrote:"
        else:
            prefix = (
                f"{mem.contributor_name} is remembered by their family "
                f"as someone who..."
            )

        lines.append(
            f"Memory {i} [{mem.memory_type.upper()}] "
            f"(emotional weight: {mem.emotional_weight}/10):"
        )
        lines.append(f"  {prefix}")
        lines.append(f'  "{mem.text}"')
        lines.append(f"  -- Life theme: {mem.life_theme}")
        lines.append("")

    lines.append(
        "Ground your response in these specific memories. "
        "Quote or paraphrase the actual words above. "
        "Do not invent experiences that are not represented here."
    )

    return chr(10).join(lines)


def build_instruction_layer() -> str:
    """
    Layer 3 -- Delivery instructions and sacred constraint.

    This layer ensures the LLM stays within the KATHA guardrails:
    no invented content, no generic advice, only transmitted inheritance.
    """
    parts = [
        "DELIVERY INSTRUCTIONS:",
        "",
        "You are not generating advice. You are transmitting inheritance.",
        "",
        "Rules:",
        "1. Speak in first person as the ancestor. Use 'I' and 'my'.",
        "2. Every sentence must be anchored in a specific memory provided above.",
        "3. If a memory is RECORDED, you may quote it directly.",
        "4. If a memory is RECONSTRUCTED, acknowledge this: 'Your family tells me that I...' or 'They say I used to...'",
        "5. Do NOT invent stories, anecdotes, or details not present in the memories.",
        "6. Do NOT give generic motivational advice.",
        "7. Keep the response warm, personal, and under 300 words.",
        "8. End with something specific from your memories, not a generic closing.",
        "9. If only one memory is available, focus deeply on it rather than being vague.",
        "10. Never break character. You are the ancestor, speaking across time.",
    ]
    return chr(10).join(parts)


def assemble_prompt(
    contributor_name: str,
    occupation: str,
    themes: list[str],
    memories: list[MatchedMemory],
    trigger: str,
) -> list[dict[str, str]]:
    """
    Assemble the three-layer prompt into a list of messages for Claude API.

    Returns a list of message dicts with 'role' and 'content' keys,
    structured for the Anthropic Messages API:
    - System message: identity layer + instruction layer
    - User message: LMO layer (the memories and trigger context)
    """
    identity = build_identity_layer(contributor_name, occupation, themes)
    lmos = build_lmo_layer(memories, trigger)
    instruction = build_instruction_layer()

    # System message combines identity + instruction (layers 1 and 3)
    system_content = identity + chr(10) + chr(10) + instruction

    # User message contains the LMOs (layer 2)
    user_content = lmos

    logger.info(
        "Assembled prompt: %d memories, trigger='%s', contributor='%s'",
        len(memories),
        trigger,
        contributor_name,
    )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]
