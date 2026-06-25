const shop = require('../../shop.config');
const { showCatalog } = require('./catalog');

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
  // Le point d'entrée redirige vers le catalogue (page 0, toutes catégories)
  bot.start((ctx) => showCatalog(ctx, 0, 'all'));
  bot.command('menu', (ctx) => showCatalog(ctx, 0, 'all'));
  
  // Rétrocompatibilité : l'ancien /shop redirige aussi vers le catalogue
  bot.command('shop', (ctx) => showCatalog(ctx, 0, 'all'));
  bot.action('shop', (ctx) => showCatalog(ctx, 0, 'all'));
  
  // Home button action redirige vers le catalogue
  bot.action('home', (ctx) => showCatalog(ctx, 0, 'all'));
  
  bot.command('help', (ctx) => showHelp(ctx));
}

module.exports = { register };
