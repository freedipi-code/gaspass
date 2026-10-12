const { PrismaClient } = require('@prisma/client');

function databaseUrlWithDefaults(value) {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (url.protocol === 'postgresql:' || url.protocol === 'postgres:') {
      // Some remote PostgreSQL proxies need longer than Prisma's default
      // timeout for the first connection.
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', '30');
      }
    }
    return url.toString();
  } catch (_) {
    // Prisma will report a useful error if DATABASE_URL is malformed.
    return value;
  }
}

const databaseUrl = databaseUrlWithDefaults(process.env.DATABASE_URL);

const prisma = new PrismaClient({
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
