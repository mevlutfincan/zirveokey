'use strict';

const crypto = require('node:crypto');

function verifyResendWebhook(req, secret, now = Date.now()) {
  const messageId = req.get('svix-id');
  const timestamp = req.get('svix-timestamp');
  const signatures = req.get('svix-signature');
  if (!secret || !messageId || !timestamp || !signatures || !Buffer.isBuffer(req.rawBody)) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(now / 1000 - timestampNumber) > 300) return false;

  const encodedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let key;
  try {
    key = Buffer.from(encodedSecret, 'base64');
  } catch {
    return false;
  }
  if (!key.length) return false;

  const signedPayload = messageId + '.' + timestamp + '.' + req.rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', key).update(signedPayload).digest();
  return signatures.split(' ').some(entry => {
    const parts = entry.split(',');
    if (parts.length !== 2 || parts[0] !== 'v1') return false;
    let supplied;
    try {
      supplied = Buffer.from(parts[1], 'base64');
    } catch {
      return false;
    }
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
}

module.exports = { verifyResendWebhook };
