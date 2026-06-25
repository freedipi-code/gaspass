const { Telegraf, session, Scenes } = require('telegraf');
const config = require('../config');
const prisma = require('../db/client');

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

const bot = new Telegraf(config.botToken);

// Middleware: get-or-create the Prisma User from telegramId
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  const tgId = String(ctx.from.id);
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: tgId,
        username: ctx.from.username || null,
        fullName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || null,
      },
    });
  }
  ctx.state.user = user;
  return next();
});

// Sessions + scenes (for the multi-step checkout)
const stage = new Scenes.Stage([checkoutScene]);
bot.use(session());
bot.use(stage.middleware());

// Handler registration order matters for catch-all listeners (text/photo/document):
// - support: intercepts ONLY when ctx.session.awaitingSupport is true, else next()
// - payment: intercepts ONLY when ctx.session.awaitingProofFor is set, else next()
// All button/command handlers below register before these catch-alls.
catalogHandler.register(bot);
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
