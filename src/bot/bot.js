const { Telegraf, session, Scenes } = require('telegraf');
const config = require('../config');
const userService = require('../services/user.service');

const catalogHandler = require('./handlers/catalog');
const startHandler = require('./handlers/start');
const categoriesHandler = require('./handlers/categories');
const productsHandler = require('./handlers/products');
const cartHandler = require('./handlers/cart');
const ordersHandler = require('./handlers/orders');
const infoHandler = require('./handlers/info');
const supportHandler = require('./handlers/support');
const stubsHandler = require('./handlers/stubs');
const checkoutScene = require('./scenes/checkout');
const paymentHandler = require('./handlers/payment');
const securityMarkHandler = require('./handlers/security-mark');
const securityMarkService = require('../services/security-mark.service');

const bot = new Telegraf(config.botToken);

// Middleware: get-or-create the Prisma User from telegramId
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  ctx.state.user = await userService.getOrCreateTelegramUser(ctx.from);
  return next();
});

// Sessions + scenes (for the multi-step checkout)
const stage = new Scenes.Stage([checkoutScene]);
bot.use(session());

// A user must finish the security-mark setup before any storefront route is
// available. Security callbacks and the phrase message itself pass through.
bot.use(async (ctx, next) => {
  if (!ctx.from || securityMarkService.getSecurityMark(ctx.state.user)) return next();

  const action = ctx.callbackQuery?.data || '';
  const isSecurityAction = action.startsWith('security:');
  const isPhraseEntry = Boolean(
    ['phrase', 'preview'].includes(ctx.session?.securityMark?.step) &&
    ctx.message?.text &&
    !ctx.message.text.startsWith('/')
  );
  if (isSecurityAction || isPhraseEntry) return next();

  return securityMarkHandler.beginSetup(ctx, { edit: Boolean(ctx.callbackQuery) });
});

bot.use(stage.middleware());

// Handler registration order matters for catch-all listeners (text/photo/document):
// - security mark: intercepts ONLY while a secret phrase is being entered
// - support: intercepts ONLY when ctx.session.awaitingSupport is true, else next()
// - payment: intercepts ONLY when ctx.session.awaitingProofFor is set, else next()
// All button/command handlers below register before these catch-alls.
catalogHandler.register(bot);
securityMarkHandler.register(bot);
startHandler.register(bot);
categoriesHandler.register(bot);
productsHandler.register(bot);
cartHandler.register(bot);
ordersHandler.register(bot);
infoHandler.register(bot);
stubsHandler.register(bot);
supportHandler.register(bot);
paymentHandler.register(bot);

bot.catch((err, ctx) => {
  console.error(`Telegraf error on ${ctx.updateType}:`, err);
  ctx.reply('⚠️ An error occurred. Please try again in a moment.').catch(() => {});
});

module.exports = bot;
