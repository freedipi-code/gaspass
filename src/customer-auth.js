const crypto = require('crypto');

const COOKIE_NAME = 'canna_customer_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    try {
      cookies[decodeURIComponent(part.slice(0, separator).trim())] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch (_) {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSession(userId, secret) {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const body = `${Number(userId)}.${expires}.${crypto.randomBytes(18).toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

function readSession(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const [userId, expires, nonce, signature] = parts;
  if (!/^\d+$/.test(userId) || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !nonce) return null;
  const expected = sign(`${userId}.${expires}.${nonce}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return { userId: Number(userId), expiresAt: new Date(Number(expires)) };
}

function sessionFromRequest(req, secret) {
  return readSession(parseCookies(req.get('cookie'))[COOKIE_NAME], secret);
}

function sessionCookie(userId, secret) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(createSession(userId, secret))}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(password), salt, 64, SCRYPT_OPTIONS, (error, derived) => {
      if (error) return reject(error);
      return resolve(`scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('hex')}$${derived.toString('hex')}`);
    });
  });
}

function verifyPassword(password, encoded) {
  return new Promise((resolve) => {
    const [algorithm, n, r, p, saltHex, hashHex] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return resolve(false);
    const expected = Buffer.from(hashHex, 'hex');
    crypto.scrypt(String(password || ''), Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT_OPTIONS.maxmem,
    }, (error, derived) => {
      if (error || derived.length !== expected.length) return resolve(false);
      return resolve(crypto.timingSafeEqual(derived, expected));
    });
  });
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function validPassword(value) {
  const password = String(value || '');
  return password.length >= 10 && password.length <= 128;
}

function securityHeaders(res) {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
}

module.exports = {
  COOKIE_NAME,
  SESSION_SECONDS,
  clearSessionCookie,
  hashPassword,
  normalizeEmail,
  readSession,
  securityHeaders,
  sessionCookie,
  sessionFromRequest,
  validPassword,
  verifyPassword,
};
