const { Markup } = require('telegraf');
const { replyWithBrandImage } = require('../brand-message');

function comingSoon(title) {
  return async (ctx) => {
    const text = `${title}\n\n_Coming soon._`;
    const opts = {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Home', 'home')]]),
    };
    return replyWithBrandImage(ctx, text, opts);
  };
}

function register(bot) {
  bot.action('wishlist', comingSoon('⭐ *Wishlist*'));
  bot.action('reviews', comingSoon('🎉 *Reviews*'));
}

module.exports = { register };
