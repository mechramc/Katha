/**
 * writer.js — Append-only audit log writer.
 *
 * Every vault operation writes an audit entry.
 * This log is IMMUTABLE — no updates, no deletes, no modifications.
 */

'use strict';

/**
 * Prepared statement cache, keyed by database instance.
 * Avoids re-preparing the INSERT on every call.
 */
const stmtCache = new WeakMap();

/**
 * Returns (and caches) a prepared INSERT statement for the given db.
 * @param {import('better-sqlite3').Database} db
 */
function getInsertStmt(db) {
  let stmt = stmtCache.get(db);
  if (!stmt) {
    stmt = db.prepare(
      `INSERT INTO audit_log (passport_id, action, actor, details)
       VALUES (@passportId, @action, @actor, @details)`
    );
    stmtCache.set(db, stmt);
  }
  return stmt;
}

/**
 * Append an entry to the immutable audit log.
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @param {Object} entry
 * @param {string|null} entry.passportId - Passport ID, or null for system-level actions
 * @param {string} entry.action - Action identifier (e.g. "passport.create", "consent.grant")
 * @param {string} entry.actor - Who performed the action ("parent", "system", "agent")
 * @param {Object} [entry.details] - Optional details object (will be JSON-stringified)
 * @returns {number} The auto-incremented id of the inserted row
 */
function logAudit(db, { passportId = null, action, actor, details = null }) {
  if (!db) {
    throw new Error('audit/writer: db is required');
  }
  if (!action || typeof action !== 'string') {
    throw new Error('audit/writer: action must be a non-empty string');
  }
  if (!actor || typeof actor !== 'string') {
    throw new Error('audit/writer: actor must be a non-empty string');
  }

  const stmt = getInsertStmt(db);

  const result = stmt.run({
    passportId: passportId ?? null,
    action,
    actor,
    details: details != null ? JSON.stringify(details) : null,
  });

  return Number(result.lastInsertRowid);
}

/**
 * Read audit log entries with pagination and optional passport filtering.
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @param {Object} [options]
 * @param {string|null} [options.passportId] - Filter by passport ID (omit for all entries)
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.limit=20] - Entries per page
 * @returns {{ entries: Object[], total: number, page: number, limit: number }}
 */
function getAuditLog(db, { passportId = null, page = 1, limit = 20 } = {}) {
  if (!db) {
    throw new Error('audit/writer: db is required');
  }

  // Clamp page and limit to sane minimums
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const offset = (safePage - 1) * safeLimit;

  let entries;
  let total;

  if (passportId != null) {
    total = db
      .prepare('SELECT COUNT(*) AS cnt FROM audit_log WHERE passport_id = ?')
      .get(passportId).cnt;

    entries = db
      .prepare(
        `SELECT id, passport_id, action, actor, details, created_at
         FROM audit_log
         WHERE passport_id = ?
         ORDER BY id ASC
         LIMIT ? OFFSET ?`
      )
      .all(passportId, safeLimit, offset);
  } else {
    total = db
      .prepare('SELECT COUNT(*) AS cnt FROM audit_log')
      .get().cnt;

    entries = db
      .prepare(
        `SELECT id, passport_id, action, actor, details, created_at
         FROM audit_log
         ORDER BY id ASC
         LIMIT ? OFFSET ?`
      )
      .all(safeLimit, offset);
  }

  // Parse the JSON details back into objects for each entry
  const parsed = entries.map((row) => ({
    id: row.id,
    passportId: row.passport_id,
    action: row.action,
    actor: row.actor,
    details: row.details != null ? JSON.parse(row.details) : null,
    createdAt: row.created_at,
  }));

  return {
    entries: parsed,
    total,
    page: safePage,
    limit: safeLimit,
  };
}

module.exports = { logAudit, getAuditLog };
