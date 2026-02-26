/**
 * issue.js — RS256 JWT issuance.
 * RS256 signing only — symmetric algorithms are prohibited.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { SignJWT } = require('jose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

let privateKey = null;

/**
 * Load the RS256 private key from disk.
 * Caches after first load.
 */
function getPrivateKey() {
  if (privateKey) return privateKey;

  const keyPath = process.env.JWT_PRIVATE_KEY_PATH ||
    path.join(__dirname, '..', '..', 'keys', 'private.pem');

  const pem = fs.readFileSync(keyPath, 'utf-8');
  privateKey = crypto.createPrivateKey(pem);
  return privateKey;
}

/**
 * Issue a scoped RS256 JWT consent token.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Object} params
 * @param {string} params.passportId
 * @param {string[]} params.scopes
 * @param {string} [params.expiresIn='24h']
 * @returns {Promise<{ token: string, jti: string, expiresAt: string }>}
 */
async function issueToken(db, { passportId, scopes, expiresIn = '24h' }) {
  if (!passportId) throw new Error('passportId is required');
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('scopes must be a non-empty array');
  }

  const jti = uuidv4();
  const key = getPrivateKey();

  const token = await new SignJWT({
    scopes,
    constraints: {
      noTraining: true,
      retentionDays: 0,
      dataMinimization: true,
      coppaCompliant: true,
    },
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('vault.katha.murailabs.local')
    .setSubject(`passport:${passportId}`)
    .setAudience('agent:katha-engine')
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

  // Calculate actual expiry
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const expiresAt = new Date(payload.exp * 1000).toISOString();

  // Store in consent_tokens table
  db.prepare(
    'INSERT INTO consent_tokens (jti, passport_id, scopes, expires_at) VALUES (?, ?, ?, ?)'
  ).run(jti, passportId, JSON.stringify(scopes), expiresAt);

  return { token, jti, expiresAt };
}

module.exports = { issueToken, getPrivateKey };
