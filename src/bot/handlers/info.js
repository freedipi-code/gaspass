const { Markup } = require('telegraf');
const shop = require('../../shop.config');
const { renderPage } = require('../../utils/page');

async function showInfo(ctx) {
  const text = `ℹ️ *Information*\n\n${shop.information}`;
  const opts = {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Catalog', 'catalog:page:0:all')]]),
  };
  return renderPage(ctx, text, opts);
}

function register(bot) {
  bot.action('info', showInfo);
  bot.command('info', showInfo);
  bot.command('about_shop', showInfo);
  bot.hears('/about_shop', showInfo);
}

module.exports = { register };
