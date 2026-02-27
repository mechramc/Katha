"""
wisdom_engine.py -- FastAPI application for wisdom delivery.

Runs on ENGINE_PORT (default 3002). STATELESS -- no caching.
Every request requires fresh JWT validation against vault.
Revoked/invalid token -> generic response (never leak memories).
Never invent content not anchored in LMO source data.
"""

import logging
import os
import shutil
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from prompt_builder import assemble_prompt
from situational_index import (
    TRIGGERS,
    VALID_TRIGGER_IDS,
    MatchedMemory,
    is_valid_trigger,
    match_trigger,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("wisdom_engine")

VAULT_URL: str = os.getenv("VAULT_URL", "http://localhost:3001")
ENGINE_PORT: int = int(os.getenv("ENGINE_PORT", "3002"))
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

GENERIC_RESPONSE: str = (
    "I am sorry, but I am unable to share family wisdom at this time. "
    "The necessary consent has not been granted or has been revoked. "
    "Please ask a parent or guardian to grant access through the KATHA dashboard."
)


class TriggerRequest(BaseModel):
    """Request body for the /trigger endpoint."""
    trigger: str = Field(..., description="One of the 12 predefined situational trigger IDs")
    passportId: str = Field(..., description="UUID of the Cultural Memory Passport")


class MemoryUsed(BaseModel):
    """Summary of a memory that contributed to the wisdom response."""
    memoryId: str
    contributorName: str
    memoryType: str
    emotionalWeight: int
    lifeTheme: str
    matchType: str


class WisdomData(BaseModel):
    """Successful wisdom delivery payload."""
    wisdom: str
    trigger: str
    memoriesUsed: list[MemoryUsed]


class EngineResponse(BaseModel):
    """Standard engine API response envelope."""
    success: bool
    data: WisdomData | dict[str, str] | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """Health check response."""
    success: bool
    version: str = "0.1.0"


class TriggerListResponse(BaseModel):
    """Response for /triggers listing."""
    success: bool
    data: dict[str, Any]


http_client: httpx.AsyncClient | None = None
claude_client: anthropic.AsyncAnthropic | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage async HTTP client and Claude client lifecycle."""
    global http_client, claude_client
    http_client = httpx.AsyncClient(timeout=30.0)
    if ANTHROPIC_API_KEY:
        claude_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    else:
        logger.warning("ANTHROPIC_API_KEY not set -- Claude calls will fail")
    logger.info("Wisdom Engine started (vault=%s, model=%s)", VAULT_URL, CLAUDE_MODEL)
    yield
    await http_client.aclose()
    logger.info("Wisdom Engine shut down")


app = FastAPI(
    title="KATHA Wisdom Engine",
    description="Situational trigger detection and ancestor wisdom delivery",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def validate_jwt_with_vault(token: str) -> dict[str, Any]:
    """Validate JWT via vault GET /consent/status. Fresh every call, NEVER cached."""
    assert http_client is not None
    try:
        resp = await http_client.get(
            f"{VAULT_URL}/consent/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            logger.warning("Vault returned %d for consent/status", resp.status_code)
            return {"valid": False}
        body = resp.json()
        if not body.get("success"):
            return {"valid": False}
        data = body.get("data", {})
        return {
            "valid": data.get("valid", False),
            "scopes": data.get("scopes", []),
            "subject": data.get("subject", ""),
            "error": data.get("error"),
        }
    except httpx.HTTPError as exc:
        logger.error("Vault communication error: %s", exc)
        return {"valid": False}


async def fetch_passport_memories(passport_id: str) -> list[dict[str, Any]]:
    """Fetch all memories for a passport via GET /passport/:id/memories."""
    assert http_client is not None
    try:
        resp = await http_client.get(
            f"{VAULT_URL}/passport/{passport_id}/memories",
            params={"limit": "100"},
        )
        if resp.status_code != 200:
            logger.warning("Vault returned %d for passport/%s/memories", resp.status_code, passport_id)
            return []
        body = resp.json()
        if not body.get("success"):
            return []
        return body.get("data", {}).get("memories", [])
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch memories: %s", exc)
        return []


async def fetch_passport_metadata(passport_id: str) -> dict[str, Any] | None:
    """Fetch passport metadata via GET /passports."""
    assert http_client is not None
    try:
        resp = await http_client.get(f"{VAULT_URL}/passports")
        if resp.status_code != 200:
            return None
        body = resp.json()
        if not body.get("success"):
            return None
        for p in body.get("data", {}).get("passports", []):
            if p.get("passportId") == passport_id:
                return p
        return None
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch passport metadata: %s", exc)
        return None


async def call_claude(messages: list[dict[str, str]]) -> str:
    """Call Claude API with assembled prompt. Separates system from user messages."""
    if claude_client is None:
        raise RuntimeError("Claude client not initialized -- check ANTHROPIC_API_KEY")
    system_content: str = ""
    user_messages: list[dict[str, str]] = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            user_messages.append(msg)
    logger.info("Calling Claude (model=%s, system_len=%d)", CLAUDE_MODEL, len(system_content))
    response = await claude_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=system_content,
        messages=user_messages,
    )
    text_blocks = [block.text for block in response.content if block.type == "text"]
    return chr(10).join(text_blocks)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(success=True)


@app.get("/triggers", response_model=TriggerListResponse)
async def list_triggers() -> TriggerListResponse:
    """List all 12 available situational triggers."""
    triggers = [
        {"id": tid, "label": info["label"], "description": info["description"]}
        for tid, info in TRIGGERS.items()
    ]
    return TriggerListResponse(success=True, data={"triggers": triggers, "total": len(triggers)})


@app.post("/trigger", response_model=EngineResponse)
async def trigger_wisdom(
    body: TriggerRequest,
    authorization: str | None = Header(default=None),
) -> EngineResponse:
    """Deliver ancestor wisdom for a situational trigger."""
    # Step 1: Validate trigger ID
    if not is_valid_trigger(body.trigger):
        return EngineResponse(
            success=False, data=None,
            error=f"Unknown trigger: {body.trigger}. Valid triggers: {sorted(VALID_TRIGGER_IDS)}",
        )

    # Step 2: Extract and validate JWT
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Missing or malformed Authorization header")
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization[7:]  # Strip "Bearer "
    # Fresh validation against vault -- NEVER cached
    validation = await validate_jwt_with_vault(token)

    if not validation.get("valid"):
        logger.info("JWT validation failed for passport %s: %s", body.passportId, validation.get("error", "unknown"))
        raise HTTPException(status_code=401, detail="Invalid or revoked token")

    # Step 3: Check passport binding — token must match requested passport
    token_subject: str = validation.get("subject", "")
    expected_subject = f"passport:{body.passportId}"
    if token_subject and token_subject != expected_subject:
        logger.info("Token passport mismatch: token=%s, requested=%s", token_subject, body.passportId)
        raise HTTPException(status_code=403, detail="Token was not granted for this passport")

    # Step 4: Check scopes
    scopes: list[str] = validation.get("scopes", [])
    has_read_scope = any("read:memories" in s or "read:wisdom" in s for s in scopes)
    if not has_read_scope:
        logger.info("Token lacks required scope: %s", scopes)
        raise HTTPException(status_code=403, detail="Insufficient scope")

    # Step 5: Fetch memories from vault
    memories = await fetch_passport_memories(body.passportId)
    if not memories:
        logger.info("No memories found for passport %s", body.passportId)
        return EngineResponse(
            success=True,
            data=WisdomData(
                wisdom="Your ancestor's memories are being gathered. None are available for this moment yet.",
                trigger=body.trigger, memoriesUsed=[],
            ),
        )

    # Step 5: Match trigger to memories
    matched: list[MatchedMemory] = match_trigger(body.trigger, memories)
    if not matched:
        logger.info("No memories matched trigger '%s' for passport %s", body.trigger, body.passportId)
        return EngineResponse(
            success=True,
            data=WisdomData(
                wisdom="Your ancestor lived many experiences, but none that directly speak to this moment have been shared yet.",
                trigger=body.trigger, memoriesUsed=[],
            ),
        )

    # Limit to top 5 most relevant memories for prompt context window
    top_memories: list[MatchedMemory] = matched[:5]

    # Step 6: Resolve contributor identity
    passport_meta = await fetch_passport_metadata(body.passportId)
    contributor_name: str = top_memories[0].contributor_name
    occupation: str = ""
    if passport_meta:
        contributor_name = passport_meta.get("contributor", contributor_name)
    themes: list[str] = list({m.life_theme for m in top_memories if m.life_theme})

    # Step 7: Build three-layer prompt
    messages = assemble_prompt(
        contributor_name=contributor_name, occupation=occupation,
        themes=themes, memories=top_memories, trigger=body.trigger,
    )

    # Step 8: Call Claude
    try:
        wisdom_text = await call_claude(messages)
    except Exception as exc:
        logger.error("Claude API call failed: %s", exc)
        return EngineResponse(success=False, data=None, error="Failed to generate wisdom response. Please try again.")

    # Step 9: Return response
    memories_used: list[MemoryUsed] = [
        MemoryUsed(
            memoryId=m.memory_id, contributorName=m.contributor_name,
            memoryType=m.memory_type, emotionalWeight=m.emotional_weight,
            lifeTheme=m.life_theme, matchType=m.match_type,
        )
        for m in top_memories
    ]
    logger.info("Wisdom delivered: trigger='%s', passport='%s', memories_used=%d", body.trigger, body.passportId, len(memories_used))

    return EngineResponse(
        success=True,
        data=WisdomData(wisdom=wisdom_text, trigger=body.trigger, memoriesUsed=memories_used),
    )


class IngestResponse(BaseModel):
    """Response for the /ingest upload endpoint."""
    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None


@app.post("/ingest", response_model=IngestResponse)
async def ingest_upload(files: list[UploadFile] = File(...)) -> IngestResponse:
    """Accept JSONL file uploads and run the ingestion pipeline.

    Saves uploaded files to a temp directory, runs demo_flow.run_pipeline(),
    and returns the result. Before ingesting, checks vault for an existing
    passport by contributor name and passes passportId for upsert if found.
    """
    # Add project root to path so ingest modules can be imported
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from ingest.demo_flow import run_pipeline
    from ingest.loader import load

    tmp_dir = tempfile.mkdtemp(prefix="katha_ingest_")
    try:
        # Save uploaded files to temp directory
        saved_count = 0
        max_file_size = 10 * 1024 * 1024  # 10 MB per file
        allowed_extensions = {".jsonl", ".json"}
        for f in files:
            if not f.filename:
                continue
            # Sanitize filename to prevent path traversal
            safe_name = os.path.basename(f.filename)
            if not safe_name or ".." in safe_name:
                logger.warning("Rejected unsafe filename: %s", f.filename)
                continue
            _, ext = os.path.splitext(safe_name.lower())
            if ext not in allowed_extensions:
                logger.warning("Rejected file with invalid extension: %s", f.filename)
                continue
            content = await f.read()
            if len(content) > max_file_size:
                return IngestResponse(success=False, error=f"File {safe_name} exceeds 10 MB limit")
            dest = os.path.join(tmp_dir, safe_name)
            with open(dest, "wb") as out:
                out.write(content)
            saved_count += 1
            logger.info("Saved uploaded file: %s (%d bytes)", safe_name, len(content))

        if saved_count == 0:
            return IngestResponse(success=False, error="No files uploaded")

        # Load records to get contributor name for dedup check
        try:
            _records, profile = load(tmp_dir)
        except Exception as exc:
            logger.error("Failed to load uploaded files: %s", exc)
            return IngestResponse(success=False, error=f"Failed to parse uploaded files: {exc}")

        contributor_name = profile.get("name", "")
        existing_passport_id: str | None = None

        # Check vault for existing passport by contributor name
        if contributor_name:
            assert http_client is not None
            try:
                resp = await http_client.get(
                    f"{VAULT_URL}/passports/search",
                    params={"contributor": contributor_name},
                )
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("success") and body.get("data"):
                        existing_passport_id = body["data"].get("passportId")
                        logger.info("Found existing passport %s for contributor %s — will upsert",
                                    existing_passport_id, contributor_name)
            except httpx.HTTPError as exc:
                logger.warning("Could not check for existing passport: %s", exc)

        # Run the pipeline
        result = await run_pipeline(
            persona_dir=tmp_dir,
            vault_url=VAULT_URL,
            passport_id=existing_passport_id,
        )

        return IngestResponse(
            success=True,
            data={
                "passportId": result.passport_id,
                "contributorName": result.contributor_name,
                "totalRecords": result.total_records_loaded,
                "uniqueRecords": result.unique_records,
                "wisdomSignals": result.wisdom_signals_extracted,
                "lmosAfterGate": result.lmos_after_gate,
                "memoriesPosted": result.memories_posted,
                "elapsedSeconds": result.elapsed_seconds,
            },
        )
    except Exception as exc:
        logger.error("Ingest pipeline failed: %s", exc, exc_info=True)
        return IngestResponse(success=False, error=f"Pipeline failed: {exc}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("wisdom_engine:app", host="0.0.0.0", port=ENGINE_PORT, reload=True)

