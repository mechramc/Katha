/**
 * audit.js — Audit log routes.
 * Read-only. No update or delete endpoints. Ever.
 */

'use strict';

const { Router } = require('express');
const { getAuditLog } = require('../audit/writer');

const router = Router();

// GET /audit — Retrieve full audit log (paginated)
router.get('/audit', (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = getAuditLog(req.db, { page, limit });

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /audit/:passportId — Audit entries for a specific passport
router.get('/audit/:passportId', (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = getAuditLog(req.db, {
      passportId: req.params.passportId,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
