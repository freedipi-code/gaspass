require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

const config = {
  botToken: required('BOT_TOKEN'),
  adminId: required('ADMIN_ID'),
  mode: process.env.BOT_MODE || 'polling', // 'polling' | 'webhook'
  webhook: {
    domain: process.env.WEBHOOK_DOMAIN || '',
    path: process.env.WEBHOOK_PATH || '/api/telegram/webhook',
    secret: process.env.WEBHOOK_SECRET || '',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  wallets: {
    btc: process.env.BTC_WALLET || '',
    ltc: process.env.LTC_WALLET || '',
  },
  autoMessage: {
    hour: 9,
    minute: 0,
    timeZone: process.env.AUTO_MESSAGE_TIMEZONE || 'Africa/Douala',
    checkIntervalMs: 30 * 1000,
    sendDelayMs: 50,
  },
};

module.exports = config;
