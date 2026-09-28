const { PrismaClient } = require('@prisma/client');

function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return value;

  const url = new URL(value);
  // This bot and its dashboard share a small hosted PostgreSQL instance.
  // Keep the pool bounded because the bot and dashboard share the database,
  // while leaving enough room for concurrent Telegram callbacks.
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '5');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '30');
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT || '10');
  }
  if (!url.searchParams.has('socket_timeout')) {
    url.searchParams.set('socket_timeout', process.env.DB_SOCKET_TIMEOUT || '30');
  }
  return url.toString();
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: { url: runtimeDatabaseUrl() },
  },
});

module.exports = prisma;
