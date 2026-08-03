const shop = require('../../shop.config');
const { showHome } = require('./catalog');

const HELP_TEXT = [
  '*Available commands*',
  '',
  '/start — Show the storefront catalog',
  '/menu — Same as /start',
  '/cart — View your cart',
  '/orders — View your past orders',
  '/info — Information (shipping, payment, returns)',
  '/support — Contact support',
  '/help — Show this list',
].join('\n');

async function showHelp(ctx) {
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' });
}

function register(bot) {
  // Le point d'entrée redirige vers la page d'accueil
  bot.start((ctx) => showHome(ctx));
  bot.command('menu', (ctx) => showHome(ctx));
  
  // Rétrocompatibilité : l'ancien /shop redirige aussi vers l'accueil
  bot.command('shop', (ctx) => showHome(ctx));
  bot.action('shop', (ctx) => showHome(ctx));
  
  // Home button action redirige vers l'accueil
  bot.action('home', (ctx) => showHome(ctx));
  
  bot.command('help', (ctx) => showHelp(ctx));
}

module.exports = { register };
