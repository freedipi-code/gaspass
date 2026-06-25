const { Markup } = require('telegraf');

function comingSoon(title) {
  return async (ctx) => {
    const text = `${title}\n\n_Coming soon._`;
    const opts = {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Home', 'home')]]),
    };
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Coming soon').catch(() => {});
      try { await ctx.editMessageText(text, opts); return; } catch (_) {}
    }
    return ctx.reply(text, opts);
  };
}

function register(bot) {
  bot.action('wishlist', comingSoon('⭐ *Wishlist*'));
  bot.action('reviews', comingSoon('🎉 *Reviews*'));
}

module.exports = { register };
