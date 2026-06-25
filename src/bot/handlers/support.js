const { Markup } = require('telegraf');
const config = require('../../config');

// Simple support flow:
// 1. User clicks "Support" → bot asks them to send their question/issue.
// 2. Next message from user (text/photo/doc) is forwarded to admin with their @username.
// 3. Admin can reply by *replying* to the forwarded message — the bot relays it back.
//
// Session keys:
//   awaitingSupport      = true            → next user message is the support request
//   adminReplyMap[<msgId>] = <userTgId>    → which user to relay an admin reply to

async function startSupport(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingSupport = true;
  const text =
    '🎫 *Support*\n\n' +
    'Send your message (text, screenshot, etc.) and it will be forwarded to our team.\n' +
    'You\'ll receive their reply right here in this chat.\n\n' +
    'Type /cancel to abort.';
  const opts = {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Home', 'home')]]),
  };
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try { await ctx.editMessageText(text, opts); return; } catch (_) {}
  }
  return ctx.reply(text, opts);
}

function register(bot) {
  // In-memory map (resets on bot restart — fine for MVP; can move to DB later)
  const adminReplyMap = new Map();
  bot.context.adminReplyMap = adminReplyMap;

  bot.action('support', startSupport);
  bot.command('support', startSupport);

  bot.command('cancel', (ctx) => {
    if (ctx.session?.awaitingSupport) {
      ctx.session.awaitingSupport = false;
      return ctx.reply('Support cancelled.');
    }
  });

  // Capture support request from user (must come BEFORE proof handler in registration order
  // — see bot.js, support is registered before payment).
  const handleUserSupport = async (ctx, next) => {
    if (!ctx.session?.awaitingSupport) return next();
    if (ctx.message?.text?.startsWith('/')) return next();

    ctx.session.awaitingSupport = false;

    const u = ctx.from;
    const handle = u.username ? `@${u.username}` : `id:${u.id}`;
    const header = `🎫 *New support request*\nFrom: ${handle}\nName: ${[u.first_name, u.last_name].filter(Boolean).join(' ')}`;

    try {
      const sent = await bot.telegram.sendMessage(config.adminId, header, { parse_mode: 'Markdown' });
      const forwarded = await ctx.forwardMessage(config.adminId);
      // Remember which user this forwarded message refers to so admin can reply to it
      adminReplyMap.set(forwarded.message_id, String(u.id));
      adminReplyMap.set(sent.message_id, String(u.id));
      await ctx.reply('✅ Your message has been sent. We\'ll reply here shortly.');
    } catch (e) {
      console.error('Support forward failed:', e.message);
      await ctx.reply('⚠️ Could not reach support. Please try again later.');
    }
  };

  bot.on(['text', 'photo', 'document'], handleUserSupport);

  // Admin replies: if admin replies to a forwarded support message in their MP with the bot,
  // relay the reply text/photo back to the original user.
  bot.on('message', async (ctx, next) => {
    if (String(ctx.from?.id) !== String(config.adminId)) return next();
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return next();
    const userId = adminReplyMap.get(replyTo.message_id);
    if (!userId) return next();

    try {
      if (ctx.message.text) {
        await bot.telegram.sendMessage(userId, `💬 *Support reply:*\n\n${ctx.message.text}`, {
          parse_mode: 'Markdown',
        });
      } else {
        // copy non-text content (photo, doc, etc.)
        await bot.telegram.copyMessage(userId, ctx.chat.id, ctx.message.message_id);
      }
      await ctx.reply('✅ Sent to user.');
    } catch (e) {
      await ctx.reply(`⚠️ Relay failed: ${e.message}`);
    }
  });
}

module.exports = { register };
