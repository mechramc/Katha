-- KATHA Vault SQLite Schema
-- Run once on first startup to initialize the database.

CREATE TABLE IF NOT EXISTS passports (
    passport_id   TEXT PRIMARY KEY,
    family_name   TEXT NOT NULL,
    contributor   TEXT NOT NULL,
    passport_data TEXT NOT NULL,       -- Full JSON-LD document
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
    memory_id        TEXT PRIMARY KEY,
    passport_id      TEXT NOT NULL REFERENCES passports(passport_id),
    source_ref       TEXT NOT NULL,
    contributor_name TEXT NOT NULL,
    emotional_weight INTEGER NOT NULL CHECK (emotional_weight BETWEEN 1 AND 10),
    life_theme       TEXT NOT NULL,
    situational_tags TEXT NOT NULL,    -- JSON array
    memory_type      TEXT NOT NULL CHECK (memory_type IN ('recorded', 'reconstructed')),
    verified_by_subj INTEGER NOT NULL DEFAULT 0,
    text             TEXT NOT NULL,
    approved_by      TEXT,
    approved_at      TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consent_tokens (
    jti           TEXT PRIMARY KEY,
    passport_id   TEXT NOT NULL REFERENCES passports(passport_id),
    scopes        TEXT NOT NULL,       -- JSON array of granted scopes
    issued_at     TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at    TEXT NOT NULL,
    revoked       INTEGER NOT NULL DEFAULT 0,
    revoked_at    TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    passport_id   TEXT,
    action        TEXT NOT NULL,
    actor         TEXT NOT NULL,
    details       TEXT,                -- JSON payload
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_passport ON memories(passport_id);
CREATE INDEX IF NOT EXISTS idx_memories_weight ON memories(emotional_weight);
CREATE INDEX IF NOT EXISTS idx_consent_passport ON consent_tokens(passport_id);
CREATE INDEX IF NOT EXISTS idx_consent_revoked ON consent_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_audit_passport ON audit_log(passport_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
