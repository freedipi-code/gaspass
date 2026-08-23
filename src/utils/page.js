const shop = require('../shop.config');
const { resolveImage, rememberTelegramPhoto } = require('./image');
const { isMessageNotModifiedError } = require('./telegram');

async function renderPage(ctx, text, options = {}, image = shop.pageImage) {
  const photoSrc = resolveImage(image);

  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  try {
    if (photoSrc) {
      if (ctx.callbackQuery?.message?.photo) {
        const edited = await ctx.editMessageMedia(
          {
            type: 'photo',
            media: photoSrc,
            caption: text,
            parse_mode: options.parse_mode,
          },
          options,
        );
        rememberTelegramPhoto(image, edited);
        return edited;
      }

      if (ctx.callbackQuery) await ctx.deleteMessage().catch(() => {});
      const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...options });
      rememberTelegramPhoto(image, sent);
      return sent;
    }

    if (ctx.callbackQuery?.message?.photo) {
      await ctx.deleteMessage().catch(() => {});
      return ctx.reply(text, options);
    }
    if (ctx.callbackQuery) return ctx.editMessageText(text, options);
    return ctx.reply(text, options);
  } catch (error) {
    if (isMessageNotModifiedError(error)) return undefined;
    console.error('Page rendering failed:', error.message);
    return ctx.reply(text, options).catch(() => undefined);
  }
}

module.exports = { renderPage };
