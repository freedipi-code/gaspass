const express = require('express');
const path = require('path');
const config = require('./config');
const bot = require('./bot/bot');
const adminRouter = require('./bot/admin.router');
const storefrontRouter = require('./storefront.router');
const { createAdminAuth } = require('./admin-auth');

function setupExpressApp(app) {
  app.locals.bot = bot;
  const adminAuth = createAdminAuth({
    passwordHash: config.adminAuth.passwordHash,
    sessionSecret: config.adminAuth.sessionSecret,
    loginPage: path.join(__dirname, 'public/admin/login.html'),
  });
  // Public storefront and its API
  app.use('/api/store', storefrontRouter);
  app.use('/images', express.static(path.join(__dirname, '..', 'images')));
  app.get('/images/:file', (_req, res) => res.sendFile(path.join(__dirname, '..', 'images', 'cana.jpeg')));
  app.use('/', express.static(path.join(__dirname, 'public/store')));
  // Password-protected admin dashboard and API
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.get('/admin/login', adminAuth.showLogin);
  app.post('/admin/login', adminAuth.login);
  app.post('/admin/logout', adminAuth.logout);
  app.use('/api/admin', adminAuth.requireApi, adminRouter);
  app.use('/admin', adminAuth.requirePage, express.static(path.join(__dirname, 'public/admin')));
  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));
}

async function startPolling() {
  await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
  const me = await bot.telegram.getMe();
  console.log(`🤖 Bot lancé en mode POLLING (dev) — @${me.username}`);
  
  // Start Express for admin dashboard in development/polling
  const app = express();
  setupExpressApp(app);
  const port = config.webhook.port || 3000;
  app.listen(port, () => {
    console.log(`📊 Admin Dashboard disponible sur http://localhost:${port}/admin`);
  });

  await bot.launch();
}

async function startWebhook() {
  if (!config.webhook.domain) {
    throw new Error('WEBHOOK_DOMAIN est requis en mode webhook');
  }
  const app = express();
  const url = config.webhook.domain.replace(/\/$/, '') + config.webhook.path;
  const me = await bot.telegram.getMe();

  setupExpressApp(app);

  // Webhook Telegram avec validation par secret token
  app.use(await bot.createWebhook({
    domain: config.webhook.domain,
    path: config.webhook.path,
    secret_token: config.webhook.secret || undefined,
    drop_pending_updates: false,
  }));

  app.listen(config.webhook.port, () => {
    console.log(`🤖 Bot lancé en mode WEBHOOK sur le port ${config.webhook.port} — @${me.username}`);
    console.log(`   URL configurée : ${url}`);
    console.log(`📊 Admin Dashboard disponible sur /admin`);
  });
}

(async () => {
  try {
    if (config.mode === 'webhook') {
      await startWebhook();
    } else {
      await startPolling();
    }
  } catch (e) {
    console.error('Échec du démarrage du bot :', e);
    process.exit(1);
  }
})();

// Arrêt propre
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
