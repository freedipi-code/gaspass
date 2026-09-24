const { Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const { cartButton } = require('../keyboards');

function comingSoon(title) {
  return async (ctx) => {
    const cartQuantity = await cartService.getCartQuantity(ctx.state.user.id);
    const text = `${title}\n\n_Coming soon._`;
    const opts = {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[
        Markup.button.callback('🏠 Home', 'home'),
        cartButton(cartQuantity),
      ]]),
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
