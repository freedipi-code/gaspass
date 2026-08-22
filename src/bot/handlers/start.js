const shop = require('../../shop.config');
const { homeMenu } = require('../keyboards');
const cartService = require('../../services/cart.service');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');

const HELP_TEXT = [
  '*Available commands*',
  '',
  '/start — Show the storefront main menu',
  '/menu — Same as /start',
  '/cart — View your cart',
  '/orders — View your past orders',
  '/info — Information (shipping, payment, returns)',
  '/support — Contact support',
  '/help — Show this list',
].join('\n');

function buildWelcomeText() {
  return [
    '<b>✅ Shop is Online!</b>',
    '',
    `⭐ ${shop.averageReview} Average Review`,
    `⚡ ${shop.averageTicketResponse} Average Ticket Response`,
    '',
    `Welcome to ${shop.name}!`,
    '',
    shop.welcomeText,
    '',
    shop.channelUrl
      ? `${shop.footerText} | <a href="${shop.channelUrl}">${shop.channelLabel}</a>`
      : shop.footerText,
  ].join('\n');
}

async function showHome(ctx) {
  const text = buildWelcomeText(ctx);
  const summary = await cartService.getSummary(ctx.state.user.id);
  const keyboard = homeMenu(summary);
  const photoSrc = resolveImage(shop.welcomeImage);
  const opts = {
    parse_mode: 'HTML',
    ...keyboard
  };

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (photoSrc) {
        if (ctx.callbackQuery.message?.photo) {
          const edited = await ctx.editMessageMedia(
            { type: 'photo', media: photoSrc, caption: text, parse_mode: 'HTML' },
            opts
          );
          rememberTelegramPhoto(shop.welcomeImage, edited);
        } else {
          await ctx.deleteMessage().catch(() => {});
          const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
          rememberTelegramPhoto(shop.welcomeImage, sent);
        }
      } else if (ctx.callbackQuery.message?.photo) {
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(text, opts);
      } else {
        await ctx.editMessageText(text, opts);
      }
      return;
    } catch (e) {
      if (isMessageNotModifiedError(e)) return;
    }
  }

  if (photoSrc) {
    const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
    rememberTelegramPhoto(shop.welcomeImage, sent);
  } else {
    await ctx.reply(text, opts);
  }
}

async function handleSetVerification(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingVerificationPhrase = true;
  await ctx.reply('🔐 *Set Verification Phrase*\n\nPlease send your verification phrase (maximum 50 characters) in your next message. This will be shown on your home screen to verify this bot\'s authenticity.', { parse_mode: 'Markdown' });
}

async function showHelp(ctx) {
  const opts = { parse_mode: 'Markdown' };
  if (!ctx.callbackQuery) return ctx.reply(HELP_TEXT, opts);

  await ctx.answerCbQuery().catch(() => {});
  if (ctx.callbackQuery.message?.photo) {
    await ctx.deleteMessage().catch(() => {});
    return ctx.reply(HELP_TEXT, opts);
  }
  try {
    return await ctx.editMessageText(HELP_TEXT, opts);
  } catch (error) {
    if (isMessageNotModifiedError(error)) return;
    return ctx.reply(HELP_TEXT, opts);
  }
}

function register(bot) {
  bot.start(showHome);
  bot.command('menu', showHome);
  bot.action('home', showHome);
  
  bot.action('set_verification', handleSetVerification);
  
  bot.command('help', showHelp);
  bot.action('help', showHelp);

  // Capture verification phrase text input
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.awaitingVerificationPhrase) {
      ctx.session.awaitingVerificationPhrase = false;
      ctx.session.verificationPhrase = ctx.message.text.substring(0, 50);
      await ctx.reply(`✅ Verification phrase updated successfully.`);
      return showHome(ctx);
    }
    return next();
  });
}

module.exports = { register, showHome };
