/**
 * generate-keys.js — Generate RS256 keypair for JWT signing.
 *
 * Usage: node scripts/generate-keys.js
 * Output: keys/private.pem, keys/public.pem
 *
 * These keys are GITIGNORED. Generate fresh keys per environment.
 */

'use strict';

const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEYS_DIR = path.resolve(__dirname, '..', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

// ---------------------------------------------------------------------------
// Pre-flight: check if keys already exist
// ---------------------------------------------------------------------------

if (fs.existsSync(PRIVATE_KEY_PATH) || fs.existsSync(PUBLIC_KEY_PATH)) {
  console.log('Keys already exist:');
  if (fs.existsSync(PRIVATE_KEY_PATH)) console.log('  -', PRIVATE_KEY_PATH);
  if (fs.existsSync(PUBLIC_KEY_PATH)) console.log('  -', PUBLIC_KEY_PATH);
  console.log('Skipping generation. Delete the existing keys first if you need new ones.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Ensure output directory exists
// ---------------------------------------------------------------------------

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  console.log('Created directory:', KEYS_DIR);
}

// ---------------------------------------------------------------------------
// Generate 2048-bit RSA keypair (RS256)
// ---------------------------------------------------------------------------

console.log('Generating 2048-bit RSA keypair...');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// ---------------------------------------------------------------------------
// Write keys to disk
// ---------------------------------------------------------------------------

fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

console.log('RS256 keypair generated successfully:');
console.log('  Private key:', PRIVATE_KEY_PATH);
console.log('  Public  key:', PUBLIC_KEY_PATH);
