/**
 * server.js — KATHA Vault Express entry point.
 *
 * Initializes SQLite, registers routes, starts HTTP server.
 */

'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.VAULT_PORT || 3001;
const DB_PATH = process.env.VAULT_DB_PATH || path.join(__dirname, '..', 'data', 'katha.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schemaPath = path.join(__dirname, 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

// Express app
const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Attach db to request for route handlers
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Health endpoint (T-011)
app.get('/health', (req, res) => {
  res.json({ success: true, version: '0.1.0' });
});

// Register routes
const passportRoutes = require('./routes/passports');
const memoryRoutes = require('./routes/memories');
const consentRoutes = require('./routes/consent');
const auditRoutes = require('./routes/audit');

app.use(passportRoutes);
app.use(memoryRoutes);
app.use(consentRoutes);
app.use(auditRoutes);

// Error handler — never leak passport data
app.use((err, req, res, _next) => {
  console.error('Vault error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    error: err.expose ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Vault listening on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Vault...');
  server.close();
  db.close();
  process.exit(0);
});

module.exports = { app, db };
