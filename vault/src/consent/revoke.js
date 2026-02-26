/**
 * revoke.js — Token revocation registry.
 * Checked on EVERY authenticated request — never cached.
 */

'use strict';

/**
 * Revoke a token by JTI.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} jti
 * @returns {{ success: boolean }}
 */
function revokeToken(db, jti) {
  if (!jti) throw new Error('jti is required');

  const row = db.prepare('SELECT jti, revoked FROM consent_tokens WHERE jti = ?').get(jti);
  if (!row) {
    return { success: false, error: 'Token not found' };
  }
  if (row.revoked) {
    return { success: true, alreadyRevoked: true };
  }

  db.prepare(
    "UPDATE consent_tokens SET revoked = 1, revoked_at = datetime('now') WHERE jti = ?"
  ).run(jti);

  return { success: true };
}

/**
 * Check if a token is revoked.
 * This MUST be called on every authenticated request.
 * NEVER cache this result.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} jti
 * @returns {boolean}
 */
function isRevoked(db, jti) {
  if (!jti) return true; // No JTI = treat as revoked
  const row = db.prepare('SELECT revoked FROM consent_tokens WHERE jti = ?').get(jti);
  if (!row) return true; // Unknown token = treat as revoked
  return !!row.revoked;
}

module.exports = { revokeToken, isRevoked };
