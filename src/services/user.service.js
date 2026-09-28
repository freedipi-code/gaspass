const prisma = require('../db/client');

const CACHE_TTL_MS = Number(process.env.USER_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE_ENTRIES = Number(process.env.USER_CACHE_MAX_ENTRIES || 10_000);
const userCache = new Map();
const pendingUsers = new Map();

function rememberUser(user) {
  if (!user?.telegramId) return user;

  if (userCache.size >= MAX_CACHE_ENTRIES && !userCache.has(user.telegramId)) {
    const oldestKey = userCache.keys().next().value;
    if (oldestKey !== undefined) userCache.delete(oldestKey);
  }

  userCache.delete(user.telegramId);
  userCache.set(user.telegramId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
  return user;
}

function cachedUser(telegramId, { allowExpired = false } = {}) {
  const cached = userCache.get(telegramId);
  if (!cached) return null;
  if (!allowExpired && cached.expiresAt <= Date.now()) return null;
  return cached.user;
}

function isTransientDatabaseError(error) {
  return ['P1001', 'P1002', 'P2024'].includes(error?.code);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTransientRetry(operation) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === 1) throw error;
      await wait(250);
    }
  }
  throw lastError;
}

async function getOrCreateTelegramUser(from) {
  const telegramId = String(from.id);
  const fresh = cachedUser(telegramId);
  if (fresh) return fresh;
  if (pendingUsers.has(telegramId)) return pendingUsers.get(telegramId);

  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
  const request = withTransientRetry(() => prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: from.username || null,
      fullName,
    },
    update: {
      username: from.username || null,
      fullName,
    },
  }))
    .then(rememberUser)
    .catch((error) => {
      // If PostgreSQL has a brief network interruption, an already-known user
      // can continue navigating with the last cached profile.
      const stale = cachedUser(telegramId, { allowExpired: true });
      if (stale && isTransientDatabaseError(error)) return stale;
      throw error;
    })
    .finally(() => pendingUsers.delete(telegramId));

  pendingUsers.set(telegramId, request);
  return request;
}

module.exports = { getOrCreateTelegramUser, rememberUser };
