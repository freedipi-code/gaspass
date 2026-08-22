const { PrismaClient } = require('@prisma/client');

function databaseUrlWithDefaults(value) {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (url.protocol === 'postgresql:' || url.protocol === 'postgres:') {
      // The remote PostgreSQL proxy can take more than Prisma's default five
      // seconds to complete its handshake, especially on the first request.
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', '30');
      }
    }
    return url.toString();
  } catch (_) {
    // Let Prisma report a useful validation error for a malformed URL.
    return value;
  }
}

const databaseUrl = databaseUrlWithDefaults(process.env.DATABASE_URL);

const prisma = new PrismaClient({
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
