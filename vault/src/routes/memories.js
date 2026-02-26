/**
 * memories.js — LMO management routes.
 */

'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../audit/writer');

const router = Router();

// POST /memories — Store new LMOs
router.post('/memories', (req, res, next) => {
  try {
    const {
      passportId,
      memoryId,
      sourceRef,
      contributorName,
      emotionalWeight,
      lifeTheme,
      situationalTags,
      memoryType,
      verifiedBySubject,
      text,
    } = req.body;

    if (!passportId || !sourceRef || !contributorName || !emotionalWeight || !lifeTheme || !text || !memoryType) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields',
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

    if (emotionalWeight < 1 || emotionalWeight > 10) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'emotionalWeight must be between 1 and 10',
      });
    }

    if (memoryType !== 'recorded' && memoryType !== 'reconstructed') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'memoryType must be "recorded" or "reconstructed"',
      });
    }

    const id = memoryId || uuidv4();
    const tagsStr = Array.isArray(situationalTags) ? JSON.stringify(situationalTags) : (situationalTags || '[]');
    const verified = verifiedBySubject ? 1 : 0;

    // Upsert — deduplicate by memoryId
    const existing = req.db.prepare('SELECT memory_id FROM memories WHERE memory_id = ?').get(id);
    if (existing) {
      return res.json({
        success: true,
        data: { memoryId: id, status: 'already_exists' },
        error: null,
      });
    }

    req.db.prepare(
      `INSERT INTO memories (memory_id, passport_id, source_ref, contributor_name, emotional_weight,
       life_theme, situational_tags, memory_type, verified_by_subj, text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, passportId, sourceRef, contributorName, emotionalWeight, lifeTheme, tagsStr, memoryType, verified, text);

    logAudit(req.db, {
      passportId,
      action: 'memory.store',
      actor: req.body.actor || 'system',
      details: { memoryId: id, emotionalWeight, memoryType },
    });

    res.status(201).json({
      success: true,
      data: { memoryId: id },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /memories/:id — Single LMO
router.get('/memories/:id', (req, res, next) => {
  try {
    const row = req.db.prepare('SELECT * FROM memories WHERE memory_id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Memory not found',
      });
    }

    res.json({
      success: true,
      data: formatMemory(row),
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /memories/:id/approve — Parent approval
router.patch('/memories/:id/approve', (req, res, next) => {
  try {
    const { approvedBy } = req.body;
    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required field: approvedBy',
      });
    }

    const row = req.db.prepare('SELECT * FROM memories WHERE memory_id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Memory not found',
      });
    }

    const approvedAt = new Date().toISOString();
    req.db.prepare(
      'UPDATE memories SET approved_by = ?, approved_at = ? WHERE memory_id = ?'
    ).run(approvedBy, approvedAt, req.params.id);

    logAudit(req.db, {
      passportId: row.passport_id,
      action: 'memory.approve',
      actor: approvedBy,
      details: { memoryId: req.params.id },
    });

    res.json({
      success: true,
      data: { memoryId: req.params.id, approvedBy, approvedAt },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /passport/:id/memories — List LMOs for a passport
router.get('/passport/:id/memories', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const total = req.db.prepare('SELECT COUNT(*) as count FROM memories WHERE passport_id = ?').get(req.params.id).count;
    const rows = req.db.prepare(
      'SELECT * FROM memories WHERE passport_id = ? ORDER BY emotional_weight DESC LIMIT ? OFFSET ?'
    ).all(req.params.id, limit, offset);

    res.json({
      success: true,
      data: {
        memories: rows.map(formatMemory),
        total,
        page,
        limit,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

function formatMemory(row) {
  let tags;
  try {
    tags = JSON.parse(row.situational_tags);
  } catch {
    tags = [];
  }
  return {
    memoryId: row.memory_id,
    passportId: row.passport_id,
    sourceRef: row.source_ref,
    contributorName: row.contributor_name,
    emotionalWeight: row.emotional_weight,
    lifeTheme: row.life_theme,
    situationalTags: tags,
    memoryType: row.memory_type,
    verifiedBySubject: !!row.verified_by_subj,
    text: row.text,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

module.exports = router;
