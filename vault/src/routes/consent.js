/**
 * consent.js — Consent token routes.
 */

'use strict';

const { Router } = require('express');
const { issueToken } = require('../consent/issue');
const { revokeToken } = require('../consent/revoke');
const { validateToken, getPublicKeyJWK } = require('../consent/validate');
const { logAudit } = require('../audit/writer');

const router = Router();

// POST /consent/grant — Issue a scoped JWT
router.post('/consent/grant', async (req, res, next) => {
  try {
    const { passportId, scopes, expiresIn } = req.body;

    if (!passportId || !scopes) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields: passportId, scopes',
      });
    }

    // Verify passport exists
    const passport = req.db.prepare('SELECT passport_id FROM passports WHERE passport_id = ?').get(passportId);
    if (!passport) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Passport not found',
      });
    }

    const result = await issueToken(req.db, { passportId, scopes, expiresIn });

    logAudit(req.db, {
      passportId,
      action: 'consent.grant',
      actor: req.body.actor || 'parent',
      details: { jti: result.jti, scopes },
    });

    res.status(201).json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /consent/revoke — Revoke a token by JTI
router.post('/consent/revoke', (req, res, next) => {
  try {
    const { jti } = req.body;
    if (!jti) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required field: jti',
      });
    }

    const result = revokeToken(req.db, jti);

    if (result.success) {
      // Look up passport for audit
      const tokenRow = req.db.prepare('SELECT passport_id FROM consent_tokens WHERE jti = ?').get(jti);
      logAudit(req.db, {
        passportId: tokenRow?.passport_id || null,
        action: 'consent.revoke',
        actor: req.body.actor || 'parent',
        details: { jti },
      });
    }

    res.json({
      success: result.success,
      data: result,
      error: result.error || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /consent/status — Check token validity
router.get('/consent/status', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Missing Authorization header',
      });
    }

    const token = authHeader.slice(7);
    const result = await validateToken(req.db, token);

    res.json({
      success: true,
      data: {
        valid: result.valid,
        scopes: result.payload?.scopes || [],
        subject: result.payload?.sub || null,
        error: result.error || null,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /consent/tokens/:passportId — List active (non-revoked, non-expired) tokens
router.get('/consent/tokens/:passportId', (req, res, next) => {
  try {
    const { passportId } = req.params;
    const rows = req.db.prepare(
      `SELECT jti, scopes, issued_at, expires_at, revoked
       FROM consent_tokens
       WHERE passport_id = ? AND revoked = 0 AND expires_at > datetime('now')
       ORDER BY issued_at DESC`
    ).all(passportId);

    const tokens = rows.map((r) => ({
      jti: r.jti,
      scopes: JSON.parse(r.scopes),
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      passportId,
    }));

    res.json({
      success: true,
      data: { tokens, total: tokens.length },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /.well-known/jwks.json — Public key endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  try {
    const jwk = getPublicKeyJWK();
    res.json({ keys: [jwk] });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to load public key',
    });
  }
});

module.exports = router;
