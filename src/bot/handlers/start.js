const shop = require('../../shop.config');
const cartService = require('../../services/cart.service');
const { homeMenu } = require('../keyboards');
const prisma = require('../../db/client');
const { Markup } = require('telegraf');
const userService = require('../../services/user.service');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function homeText() {
  const lines = [
    '✅ <b>Shop is Online!</b>',
    '',
    escapeHtml(shop.welcomeText),
  ];

  if (shop.footerText) {
    lines.push('');
    if (shop.footerLink) {
      lines.push(`<a href="${escapeHtml(shop.footerLink)}">${escapeHtml(shop.footerText)}</a>`);
    } else {
      lines.push(escapeHtml(shop.footerText));
    }
  }
  return lines.join('\n');
}

const HELP_TEXT = [
  '*Available commands*',
  '',
  '/start — Show the storefront menu',
  '/menu — Same as /start',
  '/categories — Browse product categories',
  '/cart — View your cart',
  '/orders — View your past orders',
  '/info — Information (shipping, payment, returns)',
  '/support — Contact support',
  '/help — Show this list',
].join('\n');

async function showHelp(ctx) {
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' });
}

async function getHomeStats(userId) {
  const cart = await cartService.getCartWithItems(userId);
  return {
    cartSummary: {
      count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      total: cartService.computeTotal(cart),
    },
  };
}

async function showHome(ctx) {
  if (!ctx.state.user.countryCode) return showWelcome(ctx);
  const { cartSummary } = await getHomeStats(ctx.state.user.id);
  const country = shop.countries.find((item) => item.code === ctx.state.user.countryCode);
  const menuText = `${shop.mainMenuTitle}\n${country ? `\n${country.flag} ${country.name}` : ''}`;
  const menuOpts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...homeMenu(cartSummary),
  };

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo) {
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(menuText, menuOpts);
      } else {
        await ctx.editMessageText(menuText, menuOpts);
      }
      return;
    } catch (_) {
      // Fall back to sending a fresh message below.
    }
  }

  // The presentation and its keyboard deliberately stay in one Telegram block.
  await ctx.reply(menuText, menuOpts);
}

function countryKeyboard() {
  const buttons = shop.countries.map((country) =>
    Markup.button.callback(`${country.flag} Enter the store`, `country:set:${country.code}`));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return Markup.inlineKeyboard(rows);
}

async function showWelcome(ctx) {
  const text = homeText();
  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...countryKeyboard(),
  };

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (_) {}
  }
  await ctx.reply(text, opts);
}

function register(bot) {
  bot.start((ctx) => showWelcome(ctx));
  bot.command('menu', (ctx) => ctx.state.user.countryCode ? showHome(ctx) : showWelcome(ctx));

  bot.action(/^country:set:([A-Z]{2})$/, async (ctx) => {
    const countryCode = ctx.match[1];
    if (!shop.countries.some((country) => country.code === countryCode)) {
      return ctx.answerCbQuery('Country unavailable', { show_alert: true });
    }
    ctx.state.user = await prisma.user.update({
      where: { id: ctx.state.user.id },
      data: { countryCode },
    });
    userService.rememberUser(ctx.state.user);
    await ctx.answerCbQuery().catch(() => {});
    return showHome(ctx);
  });
  
  bot.command('shop', (ctx) => showHome(ctx));
  bot.action('shop', (ctx) => showHome(ctx));
  
  bot.action('home', (ctx) => showHome(ctx));
  bot.action('settings', (ctx) => showWelcome(ctx));
  bot.action('help:menu', (ctx) => showHelp(ctx));
  
  bot.command('help', (ctx) => showHelp(ctx));
}

module.exports = { register, showHome, showWelcome };
