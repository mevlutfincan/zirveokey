'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyResendWebhook } = require('../resend-webhook');

const now = Date.now();
const secret = 'whsec_' + crypto.randomBytes(32).toString('base64');
const body = Buffer.from(JSON.stringify({ type: 'email.delivered', data: { email_id: 'email_test_123' } }));
const messageId = 'msg_test_123';
const timestamp = String(Math.floor(now / 1000));

function requestFor(rawBody = body, ts = timestamp, id = messageId) {
  const signature = crypto.createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
    .update(id + '.' + ts + '.' + rawBody.toString('utf8'))
    .digest('base64');
  const headers = {
    'svix-id': id,
    'svix-timestamp': ts,
    'svix-signature': 'v1,' + signature
  };
  return { rawBody, get(name) { return headers[name.toLowerCase()]; } };
}

test('accepts a valid Resend/Svix signature', () => {
  assert.equal(verifyResendWebhook(requestFor(), secret, now), true);
});

test('rejects a modified body', () => {
  const req = requestFor();
  req.rawBody = Buffer.from(req.rawBody.toString('utf8') + ' ');
  assert.equal(verifyResendWebhook(req, secret, now), false);
});

test('rejects a stale timestamp', () => {
  const stale = String(Math.floor(now / 1000) - 301);
  assert.equal(verifyResendWebhook(requestFor(body, stale), secret, now), false);
});

test('rejects missing signature headers and raw body', () => {
  assert.equal(verifyResendWebhook({ get: () => null, rawBody: body }, secret, now), false);
  assert.equal(verifyResendWebhook({ get: () => 'present' }, secret, now), false);
});

test('rejects a wrong signing secret', () => {
  const wrongSecret = 'whsec_' + crypto.randomBytes(32).toString('base64');
  assert.equal(verifyResendWebhook(requestFor(), wrongSecret, now), false);
});
