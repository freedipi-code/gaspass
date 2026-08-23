const shop = require('../shop.config');
const { resolveImage } = require('../utils/image');

const TELEGRAM_CAPTION_LIMIT = 1024;

// Display the shop logo on non-product screens. When navigating back from a
// product, replace its media as well as its caption so the product image does
// not leak into catalog, cart, information, or support views.
async function replyWithBrandImage(ctx, text, opts = {}) {
  const photoSrc = resolveImage(shop.welcomeImage);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
  }

  if (!photoSrc) {
    if (ctx.callbackQuery && !ctx.callbackQuery.message?.photo) {
      try {
        return await ctx.editMessageText(text, opts);
      } catch (_) {}
    }
    return ctx.reply(text, opts);
  }

  const captionFits = text.length <= TELEGRAM_CAPTION_LIMIT;

  try {
    if (ctx.callbackQuery?.message?.photo && captionFits) {
      const media = {
        type: 'photo',
        media: photoSrc,
        caption: text,
      };
      if (opts.parse_mode) media.parse_mode = opts.parse_mode;
      return await ctx.editMessageMedia(media, opts);
    }

    if (ctx.callbackQuery) {
      await ctx.deleteMessage().catch(() => {});
    }

    if (captionFits) {
      return await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
    }

    await ctx.replyWithPhoto(photoSrc);
    return ctx.reply(text, opts);
  } catch (error) {
    console.error('Failed to display branded message:', error.message);
    return ctx.reply(text, opts);
  }
}

module.exports = { replyWithBrandImage };
