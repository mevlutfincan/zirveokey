'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');

const databaseUrl = new URL(process.env.DATABASE_URL || '');
const databaseName = databaseUrl.pathname.replace(/^\//, '');
if (process.env.NODE_ENV !== 'test' ||
    !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
    !databaseName.endsWith('_test')) {
  throw new Error('Webhook integration test is restricted to a local *_test database.');
}
if (!process.env.RESEND_WEBHOOK_SECRET) throw new Error('RESEND_WEBHOOK_SECRET is required for the test.');

const port = 3101;
const baseUrl = 'http://127.0.0.1:' + port;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk.toString(); });
child.stderr.on('data', chunk => { logs += chunk.toString(); });

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function signedHeaders(eventId, body, timestamp) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const signature = crypto.createHmac('sha256', key)
    .update(eventId + '.' + timestamp + '.' + body)
    .digest('base64');
  return {
    'content-type': 'application/json',
    'svix-id': eventId,
    'svix-timestamp': timestamp,
    'svix-signature': 'v1,' + signature
  };
}

async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode !== null) throw new Error('Test server exited early: ' + logs);
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) { ready = true; break; }
    } catch {}
    await sleep(500);
  }
  assert.equal(ready, true, 'Test server did not become ready: ' + logs);

  const eventId = 'msg_integration_' + crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'email_integration_test' } });
  const headers = signedHeaders(eventId, body, timestamp);

  const invalid = await fetch(baseUrl + '/api/webhooks/resend', {
    method: 'POST', headers: { ...headers, 'svix-signature': 'v1,invalid' }, body
  });
  assert.equal(invalid.status, 401, 'Invalid webhook signature was not rejected.');

  const accepted = await fetch(baseUrl + '/api/webhooks/resend', { method: 'POST', headers, body });
  assert.equal(accepted.status, 204, 'Valid webhook event was not accepted.');

  const duplicate = await fetch(baseUrl + '/api/webhooks/resend', { method: 'POST', headers, body });
  assert.equal(duplicate.status, 204, 'Duplicate webhook delivery was not acknowledged.');

  const unsupportedBody = JSON.stringify({ type: 'email.unknown', data: {} });
  const unsupportedHeaders = signedHeaders(eventId + '_unsupported', unsupportedBody, timestamp);
  const unsupported = await fetch(baseUrl + '/api/webhooks/resend', {
    method: 'POST', headers: unsupportedHeaders, body: unsupportedBody
  });
  assert.equal(unsupported.status, 400, 'Unsupported webhook event type was accepted.');

  const stored = await pool.query('SELECT COUNT(*)::int AS count FROM resend_webhook_events WHERE event_id=$1', [eventId]);
  assert.equal(stored.rows[0].count, 1, 'Duplicate webhook delivery created more than one database record.');
  console.log('Resend webhook integration checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try { child.kill('SIGTERM'); } catch {}
  await pool.end();
});
