/**
 * validate.js — Token validation and scope intersection.
 *
 * On every authenticated request:
 * 1. Verify RS256 signature
 * 2. Check revocation registry (no caching)
 * 3. Intersect requested scopes with granted scopes
 * 4. Reject if intersection is empty
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { jwtVerify, importSPKI } = require('jose');
const { isRevoked } = require('./revoke');
const crypto = require('crypto');

let publicKey = null;

/**
 * Load the RS256 public key.
 */
async function getPublicKey() {
  if (publicKey) return publicKey;

  const keyPath = process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(__dirname, '..', '..', 'keys', 'public.pem');

  const pem = fs.readFileSync(keyPath, 'utf-8');
  publicKey = await importSPKI(pem, 'RS256');
  return publicKey;
}

/**
 * Get the public key as a JWK for the JWKS endpoint.
 */
function getPublicKeyJWK() {
  const keyPath = process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(__dirname, '..', '..', 'keys', 'public.pem');

  const pem = fs.readFileSync(keyPath, 'utf-8');
  const keyObj = crypto.createPublicKey(pem);
  const jwk = keyObj.export({ format: 'jwk' });
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'katha-vault-1';
  return jwk;
}

/**
 * Validate a JWT token.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} token - The JWT string
 * @returns {Promise<{ valid: boolean, payload?: object, error?: string }>}
 */
async function validateToken(db, token) {
  try {
    const key = await getPublicKey();

    const { payload } = await jwtVerify(token, key, {
      issuer: 'vault.katha.murailabs.local',
      audience: 'agent:katha-engine',
    });

    // Check revocation — NEVER cached
    if (isRevoked(db, payload.jti)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Intersect requested scopes with granted scopes.
 * Returns only the scopes that were both requested AND granted.
 *
 * @param {string[]} granted - Scopes in the JWT
 * @param {string[]} requested - Scopes the caller wants
 * @returns {string[]} Intersection
 */
function intersectScopes(granted, requested) {
  if (!Array.isArray(granted) || !Array.isArray(requested)) return [];
  const grantedSet = new Set(granted);
  return requested.filter((s) => grantedSet.has(s));
}

/**
 * Express middleware for JWT authentication.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.slice(7);

  validateToken(req.db, token)
    .then((result) => {
      if (!result.valid) {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'Token validation failed',
        });
      }
      req.auth = result.payload;
      next();
    })
    .catch((err) => {
      res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication failed',
      });
    });
}

module.exports = { validateToken, intersectScopes, authMiddleware, getPublicKeyJWK };
