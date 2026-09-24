const { PrismaClient } = require('@prisma/client');

// Append connection pool params to DATABASE_URL if not already present
const dbUrl = process.env.DATABASE_URL || '';
const separator = dbUrl.includes('?') ? '&' : '?';
const pooledUrl = dbUrl.includes('connection_limit')
  ? dbUrl
  : `${dbUrl}${separator}connection_limit=3&pool_timeout=120&connect_timeout=60&socket_timeout=120`;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: pooledUrl,
    },
  },
});

// Gracefully disconnect on shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
