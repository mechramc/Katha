# AGENTS.md — KATHA Coding Agent Alignment Document

> **Read this file completely before writing a single line of code.**
> This document governs every coding decision in this repository.
> It applies to Claude, Codex, Copilot, Cursor, and any other AI coding agent.

---

## What This Project Is

KATHA is a **multi-generational family wisdom transmission system**.

It ingests personal data (JSONL files from the hackathon dataset or personal exports), extracts the living wisdom embedded in everyday moments using Claude AI, and structures that wisdom into a **Cultural Memory Passport** — a portable, consent-controlled JSON-LD document owned entirely by the family.

A **Wisdom Engine** then delivers the right ancestor memory to the right descendant at the right moment in their life — grounded in what the ancestor actually wrote and said, not in generative fiction.

**This is not a chatbot. This is not a RAG system. This is not a journaling app.**

It is an indexing, consent, and delivery infrastructure for intergenerational wisdom.

---

## The Five Components — What Each Does

Before touching any file, understand what each component is responsible for. Do not blur these boundaries.

### 1. `ingest/` — The Ingestion Pipeline (Python)
**Responsibility:** Transform raw JSONL files into structured Living Memory Objects (LMOs) and assemble a Cultural Memory Passport.

**It does:**
- Load and deduplicate JSONL records across all persona files
- Call Claude API with the extraction prompt to find wisdom signals
- Classify LMOs (emotionalWeight, lifeTheme, situationalTags)
- Assemble the full passport JSON-LD structure
- Build the situational index (trigger → LMO[] lookup)
- Write the assembled passport to the Vault via REST API

**It does NOT:**
- Store anything itself — all persistence goes through the Vault API
- Generate stories or deliver wisdom — that is the Wisdom Engine's job
- Modify source records — originals are immutable
- Accept user input directly — it is a pipeline, not a service

### 2. `vault/` — The Passport Vault (Node.js + Express + SQLite)
**Responsibility:** Store passports, issue consent tokens, maintain the audit log, enforce authorization.

**It does:**
- Store all passports and LMOs in SQLite
- Issue RS256-signed JWTs with scoped access
- Validate tokens on every authenticated request
- Enforce scope intersection (agent gets only what parent approved)
- Maintain an immutable append-only audit log
- Handle revocation — check the registry on every request, no caching
- Expose 21 REST endpoints (see `/vault/routes/`)

**It does NOT:**
- Call Claude API — it is storage and auth, not intelligence
- Make decisions about what wisdom to deliver — that is the Engine
- Trust agent-provided scope claims — it enforces the intersection
- Cache revocation status anywhere

### 3. `globe/` — The Living Memory Globe (Three.js + React)
**Responsibility:** Visualize the family's memory tree as an interactive 3D globe.

**It does:**
- Fetch LMO globe payload from `/memories/globe` endpoint
- Render dots in 3D space, sized by `emotionalWeight`, colored by `emotionalTag`
- Show orbital rings per generation depth
- Handle click → memory card hover overlay
- Play AI video if available (HeyGen pre-generated asset)
- Animate — living memories pulse, departed memories are static

**It does NOT:**
- Contain business logic
- Call Claude API directly
- Store any state beyond the current session's display state
- Expose family data to the browser beyond what the Vault returns for display

### 4. `dashboard/` — The Parent Dashboard (React + Tailwind)
**Responsibility:** Give the parent family admin control over the passport and consent layer.

**It does:**
- Trigger ingestion pipeline via the Vault API
- Display extracted LMOs awaiting approval
- Allow approve / reject / edit for each LMO before it enters the passport
- Show consent grant/revoke UI with plain-language scope descriptions
- Display paginated audit log
- Handle passport export and import

**It does NOT:**
- Bypass the parent approval step — every LMO must be reviewed before entering the passport
- Allow direct editing of source records
- Show the full passport JSON to the user (summarized view only)
- Allow scope grants without explicit parent action

### 5. `engine/` — The Wisdom Engine (Python FastAPI)
**Responsibility:** Detect situational triggers, activate the right memories, build the layered prompt, and generate wisdom delivery via Claude.

**It does:**
- Detect the life trigger from context (explicit or inferred)
- Query the Vault's `/activate/:trigger` endpoint with a valid scoped JWT
- Build the three-layer prompt: identity layer + LMO injection + delivery instruction
- Call Claude API with the assembled prompt
- Log the delivery event to the Vault audit log
- Return the generated response

**It does NOT:**
- Invent content not anchored in LMO source data — the prompt forbids this explicitly
- Store family data — it is stateless; all data comes from the Vault per request
- Cache passport content between requests
- Accept requests without a valid scoped JWT

---

## The Data Model — Know This Before Touching Anything

### Living Memory Object (LMO)
Every wisdom extraction produces an LMO. This is the atomic unit of the system.

```json
{
  "memoryId": "lmo_p04_043",
  "sourceRef": "ll_0043",
  "contributor": "Sunita Rajan",
  "contributorRole": "mother",
  "recordedAt": "2024-07-19T00:00:00-05:00",
  "memory_type": "recorded",
  "verifiedBySubject": true,
  "content": {
    "original": "My son Rohan called. He's been out of work three months now. He sounded okay but his voice does that thing when he's not okay. I sent money I didn't say was coming.",
    "wisdomExtracted": "Love expressed as quiet, unannounced action. Support that does not require acknowledgment to be real.",
    "valueExpressed": "unconditional-support"
  },
  "classification": {
    "emotionalTag": "Love",
    "emotionalWeight": 9,
    "lifeTheme": "love-as-action",
    "situationalTags": [
      {
        "trigger": "descendant-struggling-silently",
        "ageRange": {"min": 16, "max": 60},
        "deliveryGuidance": "When they won't ask for help. When pride is in the way. This is what she did."
      }
    ]
  },
  "visualization": {
    "globeColor": "#C0392B",
    "pulseActive": true,
    "generationDepth": 1
  }
}
```

### Rules about LMOs — never break these:
1. `sourceRef` must always point to a real record in the source dataset
2. `content.original` is always the verbatim source text — never paraphrase it
3. `content.wisdomExtracted` is an interpretation — always subordinate to `content.original`
4. `memory_type` must be either `"recorded"` or `"reconstructed"` — no other values
5. LMOs with `memory_type: "reconstructed"` must have `verifiedBySubject: false`
6. `emotionalWeight` must be an integer 1–10; only LMOs >= 6 enter the passport
7. LMOs cannot be modified after parent approval — create a new version instead

### The Situational Trigger Vocabulary
Do not invent new trigger names. Use only these (extend the list in `schema/situational-trigger-taxonomy.json` if needed, with team review):

```
descendant-struggling-silently
descendant-considering-quitting
descendant-proud-of-small-success
descendant-feeling-behind-peers
descendant-supporting-own-child
descendant-questioning-purpose
descendant-facing-time
descendant-tech-anxiety
descendant-grief-loss
descendant-career-crossroads
descendant-relationship-conflict
descendant-new-parent
```

### The Cultural Memory Passport
The top-level JSON-LD document. Schema is in `schema/cultural-memory-passport-v1.json`.

Key rules:
- `@context` must always be `"https://katha.murailabs.com/schema/v1"`
- `@type` must always be `"CulturalMemoryPassport"`
- `schemaVersion` must match the schema file version
- The `auditLog` array is append-only — never delete or modify entries
- The `situationalIndex` is rebuilt by the assembler — never manually edit it

---

## The Consent Architecture — Understand This Completely

Every agent request to the Vault must include a valid JWT. The JWT is issued by the Vault after parent approval. This is not optional infrastructure — it is the core product promise.

### JWT structure you must enforce:
```json
{
  "iss": "vault.katha.murailabs.local",
  "sub": "passport:{passportId}",
  "aud": "agent:{agentId}",
  "scopes": ["katha:read:memories", "katha:read:values"],
  "constraints": {
    "noTraining": true,
    "retentionDays": 0,
    "dataMinimization": true,
    "coppaCompliant": true
  },
  "jti": "unique-token-id",
  "revocationEndpoint": "https://vault.katha.local/revoke"
}
```

### Scope enforcement rules — never relax these:
1. **Scope intersection is mandatory.** If the JWT claims `["katha:read:memories", "katha:read:values"]` but the parent only approved `["katha:read:memories"]`, return only memories. Strip the rest silently. Never grant more than the parent approved.
2. **Revocation check on every request.** Check `jti` against the revocation registry on every authenticated call. No caching of revocation status. If revoked, return 401 immediately.
3. **`retentionDays: 0` means zero.** The Wisdom Engine must not store passport data between requests. Each request fetches fresh from the Vault.
4. **`noTraining: true` is contractual.** Never pass passport data as training examples to any model. Prompt injection of LMOs for inference is allowed. Fine-tuning on family data is not.
5. **RS256 only.** Never accept unsigned requests to authenticated endpoints. Never use HS256 (symmetric) for production tokens.

---

## The Extraction Prompt — Do Not Modify Without Review

The extraction prompt in `ingest/extractor.py` is the intelligence core of the system. It took significant iteration to get right. Do not change it without understanding the consequences.

```python
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
```

### What you must never change:
- The specificity constraint ("She sends money" not "She is generous")
- The `emotionalWeight >= 6` threshold
- The instruction to return null for low-signal entries
- The prohibition on invention and extrapolation
- The requirement that `content.original` is verbatim

### What you may adjust with care:
- The `lifeTheme` vocabulary (add entries, do not remove)
- The number of `situationalTagCandidates` returned (default: 1–3)
- Formatting instructions for JSON output

---

## What KATHA Does Not Do — Enforce This in Code

These are not opinions. They are architectural constraints. Every PR must respect them.

| KATHA Does | KATHA Does Not |
|---|---|
| Extract wisdom already present in source data | Invent beliefs or memories not in the data |
| Anchor every LMO to a verbatim `sourceRef` | Replace or overwrite source records |
| Require parent approval before LMOs enter passport | Auto-add extracted memories without human review |
| Label reconstructed memories explicitly everywhere | Present reconstructed memories as first-person recordings |
| Enforce scope intersection on every vault request | Grant agents more access than the parent approved |
| Check revocation registry on every request | Cache revocation status anywhere in the system |
| Log every access with full provenance | Allow any unauthenticated read of passport data |
| Store data locally by default | Send raw personal data files to external APIs |
| Allow families to delete any memory at any time | Lock families into the system or their data |

---

## Reconstructed vs Recorded Memories — Never Confuse These

If you are writing code that handles memory retrieval, display, or delivery, you must distinguish these two types at every layer.

```python
# CORRECT — check memory type before delivery
def build_delivery_prefix(lmo):
    if lmo['memory_type'] == 'reconstructed':
        return f"{lmo['contributor']} is remembered by their family as someone who..."
    elif lmo['memory_type'] == 'recorded':
        return f"{lmo['contributor']} wrote:"
    else:
        raise ValueError(f"Unknown memory_type: {lmo['memory_type']}")

# WRONG — never do this
def build_delivery_prefix(lmo):
    return f"{lmo['contributor']} said:"  # ← ambiguous, implies recorded, may be false
```

In the Globe (`globe/`), reconstructed dots must be visually distinct:
- Recorded memories: `pulseActive: true`, full color opacity
- Reconstructed memories: `pulseActive: false`, 60% opacity, dashed ring

In the Dashboard (`dashboard/`), reconstructed memories must show a label badge: `"Reconstructed — family testimony"`. This is not optional styling.

In JSON-LD exports, the `memory_type` field must always be included. Never omit it.

---

## API Conventions — Follow These Exactly

### Vault REST API
- All endpoints return `{ success: bool, data: {}, error: string|null }`
- Authenticated endpoints require `Authorization: Bearer <jwt>` header
- Pagination: `?page=1&limit=20` on list endpoints
- Audit log entries are written **before** returning the response, not after
- Errors must never leak passport data in the error message

### Ingestion Pipeline
- The pipeline is idempotent — running it twice on the same files produces the same passport
- Deduplication is by `text` field hash — identical entries across repeated runs are merged
- Pipeline status is polled via `GET /ingest/status/:jobId` — never block the caller

### Wisdom Engine
- Engine is stateless — no session state, no passport caching
- Every request requires a fresh JWT validation against the Vault
- The three-layer prompt must always be assembled in order: identity → LMOs → delivery instruction
- Delivery events must be logged to the Vault audit log before returning the response

---

## File Structure — Where Things Live

```
katha/
├── AGENTS.md                     ← you are here
├── README.md                     ← user-facing docs
├── .env.example                  ← all env vars, no values
├── schema/
│   ├── cultural-memory-passport-v1.json
│   ├── living-memory-object-v1.json
│   └── situational-trigger-taxonomy.json
├── ingest/
│   ├── loader.py                 ← load + deduplicate JSONL
│   ├── extractor.py              ← Claude API extraction (DO NOT MODIFY PROMPT)
│   ├── classifier.py             ← emotionalWeight gate, LMO classification
│   ├── assembler.py              ← passport assembly + situational index
│   └── adapters/
│       ├── persona_jsonl.py      ← hackathon dataset format
│       ├── google_takeout.py     ← Gmail + Calendar
│       ├── chatgpt_export.py     ← ChatGPT conversations
│       └── claude_export.py      ← Claude conversations
├── vault/
│   ├── src/
│   │   ├── routes/               ← 21 route handlers (one file per route group)
│   │   ├── consent/
│   │   │   ├── issue.js          ← JWT issuance (RS256 only)
│   │   │   ├── validate.js       ← token validation + scope intersection
│   │   │   └── revoke.js         ← revocation registry
│   │   ├── audit/
│   │   │   └── writer.js         ← append-only audit log
│   │   └── db/
│   │       ├── schema.sql        ← SQLite schema
│   │       └── migrations/       ← versioned migrations
│   └── keys/                     ← RS256 keypair (GITIGNORED)
├── globe/
│   ├── Globe.jsx                 ← main Three.js component
│   ├── MemoryCard.jsx            ← hover card + video player
│   └── useGlobeData.js           ← Vault API feed hook
├── dashboard/
│   ├── IngestTrigger.jsx
│   ├── MemoryApproval.jsx        ← parent approval flow
│   ├── ConsentGrant.jsx          ← plain-language scope UI
│   ├── AuditLog.jsx
│   └── PassportExport.jsx
├── engine/
│   ├── wisdom_engine.py          ← FastAPI app
│   ├── prompt_builder.py         ← three-layer prompt assembly
│   └── situational_index.py      ← trigger taxonomy + matching
├── data/
│   ├── persona_p04/              ← Sunita's hackathon files (primary demo)
│   └── synthetic_tamil_family/   ← pre-built demo passport (backup)
└── docs/
    ├── threat-model.md
    ├── dti-portability-alignment.md
    └── coppa-compliance.md
```

---

## Hard Rules — Breaking These Fails the Project

These are not suggestions. They are the line between KATHA working and KATHA being disqualified, ethically compromised, or architecturally broken.

### 1. Never send raw personal data files to external APIs
The ingestion pipeline extracts text snippets locally and sends only those snippets to Claude. The JSONL files themselves never leave the local machine.

```python
# CORRECT
extracted_text = entry['text']  # just the text field
response = claude.complete(prompt=extraction_prompt + extracted_text)

# WRONG
response = claude.complete(prompt=extraction_prompt + json.dumps(entire_entry))
# ← never send full entry with id, ts, refs, pii_level to external API
```

### 2. Never modify the audit log
The audit log is append-only. There is no delete endpoint. There is no update endpoint. If you find yourself writing code that modifies an existing audit log entry, stop. You are doing something wrong.

### 3. Never skip the parent approval step
The `MemoryApproval.jsx` flow exists for a reason. There is no `--force` flag, no admin bypass, no bulk-approve endpoint. Every LMO must be individually reviewed by a human parent before entering the passport.

### 4. Never present reconstructed memories as recorded
Every code path that renders or delivers a reconstructed memory must include the label. No exceptions for "clean UI" or "better UX." The label is the UX.

### 5. Never grant scopes the parent did not explicitly approve
The scope intersection in `vault/src/consent/validate.js` must run on every authenticated request. It is not a one-time check at token issuance. An agent that acquires a token and then calls endpoints outside its granted scopes must receive 403.

### 6. Never cache revocation status
`vault/src/consent/revoke.js` maintains a registry. Check it on every request. The parent's ability to revoke access immediately is a product promise. Caching breaks that promise.

### 7. Never invent content in the Wisdom Engine
The three-layer prompt in `engine/prompt_builder.py` includes the instruction: "You are not generating advice. You are transmitting inheritance." If you modify this prompt, you must preserve this constraint. The engine's output must be anchored to LMO source data, not free-form generation.

---

## What the Demo Must Show — Build Toward This

The hackathon demo runs in 8 minutes and follows this exact sequence. Every component must support this flow end-to-end without crashing:

1. **Load Sunita's files** — `python ingest/loader.py --persona data/persona_p04/`
2. **Extract and classify** — Pipeline calls Claude, produces 12 LMOs, assembles passport
3. **Globe renders** — 12 dots appear in the browser, orbital rings visible, largest dot is ll_0043
4. **Click ll_0043** — Memory card hovers: raw source text + extracted wisdom visible side by side
5. **Consent flow** — Wisdom Engine requests scopes, dashboard shows plain-language labels, parent approves, JWT issued in terminal
6. **Trigger fires** — `descendant-struggling-silently` → index finds ll_0043 → layered prompt assembles → Claude generates response
7. **Before/after** — Generic response shown first, then KATHA response grounded in Sunita's memories
8. **Revocation** — Parent revokes token → trigger fires → generic response → parent re-grants → Sunita's voice returns
9. **Export** — `POST /passport/export` → 4.7KB JSON-LD bundle in terminal

If any step in this sequence fails, the demo fails. Prioritize this flow above all other features.

---

## Coding Standards

### Python (`ingest/`, `engine/`)
- Python 3.11+
- Type hints on all function signatures
- `pydantic` for data validation on all API inputs and outputs
- `httpx` for async HTTP calls to Vault and Claude API
- No raw `dict` passing between functions — use dataclasses or pydantic models
- All Claude API calls must have a timeout and retry with exponential backoff

### JavaScript/Node.js (`vault/`)
- Node.js 18+
- `express` for routing
- `better-sqlite3` for synchronous SQLite access (no async SQLite)
- `jose` for JWT operations (RS256)
- No `eval()`, no `Function()`, no dynamic require
- All routes must validate request shape before processing

### React (`globe/`, `dashboard/`)
- React 18+
- Tailwind CSS for all styling — no inline styles except Three.js canvas
- No `localStorage` or `sessionStorage` — all state in React state or fetched from Vault
- All Vault API calls go through a single `useVault()` hook — no direct `fetch()` in components
- Error states must be handled and displayed — no silent failures

### General
- `.env.example` must be kept current — every new env var added to code must appear in `.env.example`
- No API keys in code, comments, or commit history
- Every new endpoint must have a corresponding audit log write
- Tests live in `__tests__/` (JS) or `tests/` (Python) alongside the component they test

---

## What Success Looks Like

When the system is working correctly:

- Running `python ingest/demo_flow.py` completes end-to-end in under 90 seconds
- The globe renders 12 dots without crashing when Sunita's passport is loaded
- Revoking a token and immediately firing a trigger returns a generic response (not Sunita's memories)
- Re-granting the token and firing the trigger returns a response grounded in her memories
- Exporting the passport produces valid JSON-LD that validates against `schema/cultural-memory-passport-v1.json`
- The audit log after a full demo run contains entries for: ingest, approval, consent grant, trigger activation, delivery, revocation, re-grant, export

If all of these pass, the demo is ready.

---

## When You Are Unsure

If you are unsure whether a change is consistent with the project:

1. **Re-read the LMO rules** — is the change preserving source fidelity?
2. **Re-read the consent rules** — is the change respecting the parent's control?
3. **Re-read the demo sequence** — does the change support or break the 8-step flow?
4. **Ask yourself:** does this make KATHA more like a chatbot or more like an infrastructure layer?

KATHA is infrastructure. It should feel like a database with a soul, not like a conversational agent.

---

*KATHA — The Living Family Wisdom Tree*
*Murai Labs · Data Portability Hackathon 2026*
*The compound interest of human wisdom, growing indefinitely, never lost again.*
