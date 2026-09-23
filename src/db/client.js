const { PrismaClient } = require('@prisma/client');

function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return value;

  const url = new URL(value);
  // This bot and its dashboard share a small hosted PostgreSQL instance.
  // Prisma's CPU-based default (9 locally) can exhaust the server when more
  // than one process is running, so use a deliberately small shared pool.
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '2');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20');
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT || '10');
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
