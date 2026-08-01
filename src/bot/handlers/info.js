const { Markup } = require('telegraf');
const shop = require('../../shop.config');

async function showInfo(ctx) {
  const text = `ℹ️ *Information*\n\n${shop.information}`;
  const opts = {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Catalog', 'catalog:page:0:all')]]),
  };
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo) {
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(text, opts);
      } else {
        await ctx.editMessageText(text, opts);
      }
      return;
    } catch (_) {}
  }
  return ctx.reply(text, opts);
}

function register(bot) {
  bot.action('info', showInfo);
  bot.command('info', showInfo);
  bot.command('about_shop', showInfo);
  bot.hears('/about_shop', showInfo);
  
  // Custom storefront deep link commands
  bot.hears('/about_qtetra', showInfo);
  bot.command('about_qtetra', showInfo);

  const pgpHandler = async (ctx) => {
    const pgpText = [
      `🔐 *PGP Public Key*`,
      ``,
      `\`\`\``,
      `-----BEGIN PGP PUBLIC KEY BLOCK-----`,
      `Version: Key-ID 0x4D3F2C1B`,
      ``,
      `mQENBF7Z... [QUEEN TETRA SHOP PGP KEY]`,
      `xsFNBF5v...`,
      `-----END PGP PUBLIC KEY BLOCK-----`,
      `\`\`\``
    ].join('\n');
    return ctx.reply(pgpText, { parse_mode: 'Markdown' });
  };

  bot.hears('/pgp_qtetra', pgpHandler);
  bot.command('pgp_qtetra', pgpHandler);
}

module.exports = { register };
