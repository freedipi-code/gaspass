const express = require('express');
const path = require('path');
const config = require('./config');
const bot = require('./bot/bot');
const adminRouter = require('./bot/admin.router');

let webhookReady = false;
let httpServer;

function setupExpressApp(app) {
  // Mount admin API routes
  app.use('/api/admin', adminRouter);
  // Serve admin static dashboard
  app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
  // Health check
  app.get('/health', (_req, res) => res.json({
    ok: true,
    mode: config.mode,
    webhookReady: config.mode === 'webhook' ? webhookReady : undefined,
  }));
}

async function startPolling() {
  await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
  const me = await bot.telegram.getMe();
  console.log(`🤖 Bot lancé en mode POLLING (dev) — @${me.username}`);
  
  // Start Express for admin dashboard in development/polling
  const app = express();
  setupExpressApp(app);
  const port = config.webhook.port || 3000;
  httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`[startup] HTTP server listening on 0.0.0.0:${port}`);
    console.log(`[startup] Admin dashboard available at /admin`);
  });

  console.log('[startup] Starting Telegram polling...');
  await bot.launch({ dropPendingUpdates: false });
}

async function startWebhook() {
  if (!config.webhook.domain) {
    throw new Error('WEBHOOK_DOMAIN est requis en mode webhook');
  }
  const app = express();
  const url = config.webhook.domain.replace(/\/$/, '') + config.webhook.path;

  // Validate Telegram updates before Telegraf receives them. Hosting health
  // checks sometimes POST an empty object to the webhook path.
  app.use(config.webhook.path, express.json({ limit: '1mb' }), (req, res, next) => {
    if (req.method !== 'POST') return res.sendStatus(405);
    const update = req.body;
    const eventTypes = update && typeof update === 'object'
      ? Object.keys(update).filter((key) => key !== 'update_id')
      : [];
    if (!Number.isInteger(update?.update_id) || eventTypes.length === 0) {
      console.warn('[telegram] ignored invalid webhook payload');
      return res.sendStatus(204);
    }
    console.log(`[telegram] webhook accepted update=${update.update_id} event=${eventTypes[0]}`);
    return next();
  });

  setupExpressApp(app);

  // Install the callback before registering the webhook so the HTTP service
  // remains reachable even if Telegram is temporarily unavailable.
  app.use(bot.webhookCallback(config.webhook.path, {
    secretToken: config.webhook.secret || undefined,
  }));

  await new Promise((resolve, reject) => {
    httpServer = app.listen(config.webhook.port, '0.0.0.0', resolve);
    httpServer.once('error', reject);
  });
  console.log(`[startup] HTTP server listening on 0.0.0.0:${config.webhook.port}`);
  console.log(`[startup] Webhook endpoint: ${url}`);
  console.log('[startup] Registering webhook with Telegram...');

  try {
    const me = await bot.telegram.getMe();
    await bot.telegram.setWebhook(url, {
      secret_token: config.webhook.secret || undefined,
      drop_pending_updates: false,
    });
    webhookReady = true;
    console.log(`[startup] Telegram webhook registered successfully for @${me.username}`);
  } catch (error) {
    console.error(`[startup] Telegram webhook registration failed: ${error.message}`);
    console.error('[startup] The HTTP server is still running; fix the domain/SSL/configuration and restart.');
  }
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

process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
});

// Arrêt propre
process.once('SIGINT', () => {
  if (httpServer) httpServer.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  if (httpServer) httpServer.close();
  bot.stop('SIGTERM');
});
