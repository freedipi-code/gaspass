const { Markup } = require('telegraf');
const { isMessageNotModifiedError } = require('../../utils/telegram');

function comingSoon(title) {
  return async (ctx) => {
    const text = `${title}\n\n_Coming soon._`;
    const opts = {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('⌂ Home', 'home')]]),
    };
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Coming soon').catch(() => {});
      try { await ctx.editMessageText(text, opts); return; } catch (e) {
        if (isMessageNotModifiedError(e)) return;
      }
    }
    return ctx.reply(text, opts);
  };
}

function register(bot) {
  bot.action('noop', (ctx) => ctx.answerCbQuery().catch(() => {}));
  bot.action('wishlist', comingSoon('⭐ *Wishlist*'));
  bot.action('reviews', comingSoon('🎉 *Reviews*'));
  bot.action('featured', comingSoon('⭐ *Featured Products*'));
  bot.action('search', comingSoon('🔍 *Search*'));
  bot.action('profile', comingSoon('👤 *My Profile*'));
  bot.action('reviews_home', comingSoon('📝 *Store Reviews*'));
  bot.action('faq', comingSoon('❓ *Frequently Asked Questions*'));
  bot.action('tor', comingSoon('🧅 *Tor Link / Mirror*'));
  bot.action('news_feed', comingSoon('📢 *News Feed*'));
}

module.exports = { register };
