const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPassword,
  normalizeEmail,
  readSession,
  sessionCookie,
  validPassword,
  verifyPassword,
} = require('../src/customer-auth');

test('customer passwords are hashed and verified without storing plaintext', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes('correct horse'), false);
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('incorrect password', hash), false);
});

test('customer sessions are signed and reject tampering', () => {
  const secret = 'test-session-secret-with-enough-entropy';
  const cookie = sessionCookie(42, secret);
  const token = decodeURIComponent(cookie.match(/canna_customer_session=([^;]+)/)[1]);
  assert.equal(readSession(token, secret).userId, 42);
  assert.equal(readSession(`${token}tampered`, secret), null);
});

test('account inputs normalize email and enforce password length', () => {
  assert.equal(normalizeEmail('  Customer@Example.COM '), 'customer@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(validPassword('1234567890'), true);
  assert.equal(validPassword('short'), false);
});
