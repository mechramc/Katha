/**
 * test_phase1_vault.js — Automated testing agent for Phase 1 (CP-1)
 *
 * Runs after Phase 1 implementation is complete.
 * Executes all 13 CP-1 verification steps programmatically.
 * Exit code 0 = all pass, non-zero = failures found.
 *
 * Usage: node tests/test_phase1_vault.js
 *
 * Requires: Vault running on localhost:3001
 */

'use strict';

const BASE = process.env.VAULT_URL || 'http://localhost:3001';
let passportId, memoryId, jwt, jti;
let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', label });
  } else {
    failed++;
    results.push({ status: 'FAIL', label });
  }
}

async function request(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('=== KATHA Phase 1 Testing Agent (CP-1) ===\n');

  // T1: Health check
  {
    const { status, data } = await request('GET', '/health');
    assert(status === 200 && data?.success === true, 'T1: Health endpoint returns 200 + success');
  }

  // T2: Create a passport
  {
    const { status, data } = await request('POST', '/passport', {
      familyName: 'Rajan',
      contributor: 'Sunita Rajan',
      passportData: {
        '@context': 'https://katha.dev/schema/v1',
        '@type': 'CulturalMemoryPassport',
      },
    });
    assert(status === 201 || (status === 200 && data?.success), 'T2: Create passport succeeds');
    passportId = data?.data?.passportId;
    assert(!!passportId, 'T2b: Passport ID returned');
  }

  // T3: Store an LMO
  {
    memoryId = crypto.randomUUID();
    const { status, data } = await request('POST', '/memories', {
      passportId,
      memoryId,
      sourceRef: 'persona_p04/lifelog_001.jsonl:42',
      contributorName: 'Sunita Rajan',
      emotionalWeight: 8,
      lifeTheme: 'sacrifice',
      situationalTags: ['descendant-struggling-silently'],
      memoryType: 'recorded',
      text: 'She sends money to her son every month without telling anyone.',
    });
    assert(data?.success === true, 'T3: Store LMO succeeds');
  }

  // T4: Approve the LMO
  {
    const { status, data } = await request('PATCH', `/memories/${memoryId}/approve`, {
      approvedBy: 'Test Parent',
    });
    assert(data?.success === true, 'T4: Approve LMO succeeds');
    assert(!!data?.data?.approvedAt, 'T4b: Approval timestamp returned');
  }

  // T5: Issue consent token
  {
    const { status, data } = await request('POST', '/consent/grant', {
      passportId,
      scopes: ['katha:read:memories', 'katha:read:values'],
    });
    assert(data?.success === true, 'T5: Issue consent token succeeds');
    jwt = data?.data?.token;
    jti = data?.data?.jti;
    assert(!!jwt, 'T5b: JWT returned');
    assert(!!jti, 'T5c: JTI returned');
  }

  // T6: Read passport with valid token
  {
    const { status, data } = await request('GET', `/passport/${passportId}`, null, {
      Authorization: `Bearer ${jwt}`,
    });
    assert(data?.success === true, 'T6: Read passport with valid JWT succeeds');
  }

  // T7: Revoke the token
  {
    const { status, data } = await request('POST', '/consent/revoke', { jti });
    assert(data?.success === true, 'T7: Revoke token succeeds');
  }

  // T8: Read with revoked token — must fail
  {
    const { status, data } = await request('GET', `/passport/${passportId}`, null, {
      Authorization: `Bearer ${jwt}`,
    });
    assert(status === 401, 'T8: Revoked token returns 401');
    assert(!data?.data?.passportData, 'T8b: No passport data leaked in revoked response');
  }

  // T9: Audit log has entries
  {
    const { status, data } = await request('GET', '/audit');
    const entries = data?.data?.entries || data?.data || [];
    assert(Array.isArray(entries) && entries.length >= 6, 'T9: Audit log has 6+ entries');
    const actions = entries.map((e) => e.action);
    assert(actions.includes('passport_create') || actions.includes('passport.create'), 'T9b: Audit has passport create');
    assert(actions.includes('consent_revoke') || actions.includes('consent.revoke'), 'T9c: Audit has consent revoke');
  }

  // T10: JWKS endpoint
  {
    const { status, data } = await request('GET', '/.well-known/jwks.json');
    assert(status === 200, 'T10: JWKS endpoint returns 200');
    assert(data?.keys?.length > 0, 'T10b: JWKS has at least one key');
  }

  // T11: Re-grant after revocation
  {
    const { data } = await request('POST', '/consent/grant', {
      passportId,
      scopes: ['katha:read:memories'],
    });
    const newJwt = data?.data?.token;
    assert(!!newJwt, 'T11: Re-grant returns new JWT');

    const readRes = await request('GET', `/passport/${passportId}`, null, {
      Authorization: `Bearer ${newJwt}`,
    });
    assert(readRes.data?.success === true, 'T11b: Re-granted token works');
  }

  // T12: Error response doesn't leak data
  {
    const { status, data } = await request('GET', '/passport/nonexistent-uuid', null, {
      Authorization: `Bearer ${jwt}`,
    });
    const responseStr = JSON.stringify(data);
    assert(!responseStr.includes('Sunita'), 'T12: Error response does not leak passport data');
  }

  // T13: Response shape convention
  {
    const { data } = await request('GET', '/health');
    assert('success' in data, 'T13: Response has success field');
  }

  // Summary
  console.log('\n=== Results ===');
  for (const r of results) {
    console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.label}`);
  }
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  ${failed === 0 ? '🎉 CP-1 PASSED' : '⛔ CP-1 FAILED'}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Testing agent crashed:', err.message);
  console.error('Is the Vault running on', BASE, '?');
  process.exit(2);
});
