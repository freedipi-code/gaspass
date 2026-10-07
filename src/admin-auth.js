const crypto = require('crypto');

const COOKIE_NAME = 'canna_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const attempts = new Map();

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    try {
      cookies[decodeURIComponent(part.slice(0, separator).trim())] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch (_) {
      // Ignore malformed cookie values instead of failing the request.
    }
  }
  return cookies;
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSession(secret) {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const body = `${expires}.${crypto.randomBytes(18).toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

function validSession(token, secret) {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) <= Date.now() || !nonce) return false;
  const expected = sign(`${expires}.${nonce}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, encoded) {
  return new Promise((resolve) => {
    const [algorithm, n, r, p, saltHex, hashHex] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return resolve(false);
    const expected = Buffer.from(hashHex, 'hex');
    crypto.scrypt(String(password || ''), Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    }, (error, derived) => {
      if (error || derived.length !== expected.length) return resolve(false);
      return resolve(crypto.timingSafeEqual(derived, expected));
    });
  });
}

function securityHeaders(res) {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
}

function createAdminAuth({ passwordHash, sessionSecret, loginPage }) {
  function authenticated(req) {
    return validSession(parseCookies(req.get('cookie'))[COOKIE_NAME], sessionSecret);
  }

  function rateKey(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  function blocked(req) {
    const entry = attempts.get(rateKey(req));
    if (!entry) return false;
    if (entry.resetAt <= Date.now()) { attempts.delete(rateKey(req)); return false; }
    return entry.count >= 5;
  }

  function recordFailure(req) {
    const key = rateKey(req);
    const current = attempts.get(key);
    if (!current || current.resetAt <= Date.now()) attempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    else current.count += 1;
  }

  return {
    showLogin(req, res) {
      securityHeaders(res);
      if (authenticated(req)) return res.redirect('/admin');
      return res.sendFile(loginPage);
    },
    async login(req, res) {
      securityHeaders(res);
      if (blocked(req)) return res.status(429).send('Too many attempts. Try again in 15 minutes.');
      if (!await verifyPassword(req.body?.password, passwordHash)) {
        recordFailure(req);
        return res.redirect(303, '/admin/login#error');
      }
      attempts.delete(rateKey(req));
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.set('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(createSession(sessionSecret))}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; SameSite=Strict${secure}`);
      return res.redirect(303, '/admin');
    },
    logout(_req, res) {
      securityHeaders(res);
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.set('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${secure}`);
      return res.redirect(303, '/admin/login');
    },
    requirePage(req, res, next) {
      securityHeaders(res);
      if (authenticated(req)) return next();
      return res.redirect(303, '/admin/login');
    },
    requireApi(req, res, next) {
      securityHeaders(res);
      if (authenticated(req)) return next();
      return res.status(401).json({ error: 'Admin authentication required.' });
    },
  };
}

module.exports = { createAdminAuth };
