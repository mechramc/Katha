/**
 * passports.js — Passport CRUD routes.
 */

'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../audit/writer');
const { authMiddleware } = require('../consent/validate');

const router = Router();

// POST /passport — Create or update a passport
router.post('/passport', (req, res, next) => {
  try {
    const { familyName, contributor, passportData, passportId } = req.body;

    if (!familyName || !contributor || !passportData) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required fields: familyName, contributor, passportData',
      });
    }

    const id = passportId || uuidv4();
    const dataStr = typeof passportData === 'string' ? passportData : JSON.stringify(passportData);

    const existing = req.db.prepare('SELECT passport_id FROM passports WHERE passport_id = ?').get(id);

    if (existing) {
      req.db.prepare(
        `UPDATE passports SET family_name = ?, contributor = ?, passport_data = ?, updated_at = datetime('now') WHERE passport_id = ?`
      ).run(familyName, contributor, dataStr, id);

      logAudit(req.db, {
        passportId: id,
        action: 'passport.update',
        actor: req.body.actor || 'system',
        details: { familyName },
      });
    } else {
      req.db.prepare(
        'INSERT INTO passports (passport_id, family_name, contributor, passport_data) VALUES (?, ?, ?, ?)'
      ).run(id, familyName, contributor, dataStr);

      logAudit(req.db, {
        passportId: id,
        action: 'passport.create',
        actor: req.body.actor || 'system',
        details: { familyName, contributor },
      });
    }

    res.status(existing ? 200 : 201).json({
      success: true,
      data: { passportId: id },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /passport/:id — Retrieve a passport (requires valid JWT)
router.get('/passport/:id', authMiddleware, (req, res, next) => {
  try {
    const row = req.db.prepare('SELECT * FROM passports WHERE passport_id = ?').get(req.params.id);

    if (!row) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Passport not found',
      });
    }

    let passportData;
    try {
      passportData = JSON.parse(row.passport_data);
    } catch {
      passportData = row.passport_data;
    }

    logAudit(req.db, {
      passportId: req.params.id,
      action: 'passport.read',
      actor: 'api',
    });

    res.json({
      success: true,
      data: {
        passportId: row.passport_id,
        familyName: row.family_name,
        contributor: row.contributor,
        passportData,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /passports — List all passports (paginated)
router.get('/passports', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const total = req.db.prepare('SELECT COUNT(*) as count FROM passports').get().count;
    const rows = req.db.prepare(
      'SELECT passport_id, family_name, contributor, created_at, updated_at FROM passports ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const passports = rows.map((r) => ({
      passportId: r.passport_id,
      familyName: r.family_name,
      contributor: r.contributor,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({
      success: true,
      data: { passports, total, page, limit },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /passports/search?contributor=<name> — Find passport by contributor name
router.get('/passports/search', (req, res, next) => {
  try {
    const { contributor } = req.query;
    if (!contributor) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required query parameter: contributor',
      });
    }

    const row = req.db.prepare(
      'SELECT passport_id, family_name, contributor, created_at, updated_at FROM passports WHERE contributor = ? ORDER BY created_at DESC LIMIT 1'
    ).get(contributor);

    if (!row) {
      return res.json({
        success: true,
        data: null,
        error: null,
      });
    }

    res.json({
      success: true,
      data: {
        passportId: row.passport_id,
        familyName: row.family_name,
        contributor: row.contributor,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /passport/:id — Delete a passport and its memories
router.delete('/passport/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = req.db.prepare('SELECT passport_id FROM passports WHERE passport_id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Passport not found',
      });
    }

    // Wrap in transaction: delete dependent rows (FK), then passport
    const deleteAll = req.db.transaction(() => {
      const memResult = req.db.prepare('DELETE FROM memories WHERE passport_id = ?').run(id);
      req.db.prepare('DELETE FROM consent_tokens WHERE passport_id = ?').run(id);
      req.db.prepare('DELETE FROM passports WHERE passport_id = ?').run(id);
      return memResult.changes;
    });
    const memoriesDeleted = deleteAll();

    logAudit(req.db, {
      passportId: id,
      action: 'passport.delete',
      actor: req.body?.actor || 'system',
      details: { memoriesDeleted },
    });

    res.json({
      success: true,
      data: { passportId: id, memoriesDeleted },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /passport/export — Export as JSON-LD
router.post('/passport/export', (req, res, next) => {
  try {
    const { passportId } = req.body;
    if (!passportId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Missing required field: passportId',
      });
    }

    const passport = req.db.prepare('SELECT * FROM passports WHERE passport_id = ?').get(passportId);
    if (!passport) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Passport not found',
      });
    }

    // Get all approved memories for this passport
    const memories = req.db.prepare(
      'SELECT * FROM memories WHERE passport_id = ? AND approved_by IS NOT NULL ORDER BY emotional_weight DESC'
    ).all(passportId);

    // Build situational index
    const situationalIndex = {};
    for (const m of memories) {
      let tags;
      try {
        tags = JSON.parse(m.situational_tags);
      } catch {
        tags = [];
      }
      for (const tag of tags) {
        if (!situationalIndex[tag]) situationalIndex[tag] = [];
        situationalIndex[tag].push(m.memory_id);
      }
    }

    // Build JSON-LD export
    let existingData = {};
    try {
      existingData = JSON.parse(passport.passport_data);
    } catch {
      // ignore
    }

    const exported = {
      '@context': existingData['@context'] || 'https://katha.dev/schema/v1',
      '@type': existingData['@type'] || 'CulturalMemoryPassport',
      passportId,
      heritage: existingData.heritage || {
        familyName: passport.family_name,
        primaryContributor: {
          name: passport.contributor,
          role: 'contributor',
        },
      },
      values: existingData.values || [],
      memories: memories.map((m) => ({
        memoryId: m.memory_id,
        sourceRef: m.source_ref,
        contributor: { name: m.contributor_name },
        emotionalWeight: m.emotional_weight,
        lifeTheme: m.life_theme,
        situationalTags: JSON.parse(m.situational_tags || '[]'),
        memoryType: m.memory_type,
        verifiedBySubject: !!m.verified_by_subj,
        text: m.text,
        approvedBy: m.approved_by,
        approvedAt: m.approved_at,
        createdAt: m.created_at,
      })),
      situationalIndex,
      meta: {
        createdAt: passport.created_at,
        updatedAt: passport.updated_at,
        version: '1.0',
        sourceCount: memories.length,
        lmoCount: memories.length,
      },
    };

    logAudit(req.db, {
      passportId,
      action: 'passport.export',
      actor: req.body.actor || 'api',
      details: { lmoCount: memories.length },
    });

    res.json({
      success: true,
      data: exported,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
