const { Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice, chunk } = require('../keyboards');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');

function buildCartView(cart) {
  if (!cart.items.length) {
    return {
      text: '🛒 *Your cart is empty*\n\nGo back to the catalog to browse products.',
      keyboard: Markup.inlineKeyboard([[Markup.button.callback('⌂ Home', 'home')]]),
    };
  }

  const lines = cart.items.map((it) => {
    const label = it.variant ? ` · ${it.variant.label}` : '';
    const lineTotal = it.unitPrice * it.quantity;
    return `- ${it.product.name}${label} x${it.quantity} = ${formatPrice(lineTotal)}`;
  });
  
  const total = cartService.computeTotal(cart);
  const text =
    `*Cart*\n\n${lines.join('\n')}\n\n` +
    `*Total: ${formatPrice(total)}*`;

  const rows = [];
  
  // For each cart item, add a label button and a +/- control row
  for (const it of cart.items) {
    const btnLabel = it.variant 
      ? `${it.product.name} · ${it.variant.label}`
      : `${it.product.name}`;
      
    rows.push([Markup.button.callback(btnLabel, 'noop')]);
    rows.push([
      { text: `-`, callback_data: `cart:dec:${it.id}`, style: 'danger' },
      { text: `+`, callback_data: `cart:inc:${it.id}`, style: 'success' },
    ]);
  }
  
  rows.push([{ text: '✅ Checkout', callback_data: 'checkout', style: 'success' }]);
  rows.push([{ text: '🗑️ Clear cart', callback_data: 'cart:clear', style: 'danger' }]);
  rows.push([{ text: '← Back', callback_data: 'browse', style: 'danger' }]);
  rows.push([{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function showCart(ctx) {
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  const { text, keyboard } = buildCartView(cart);
  
  // Cart banner: use the cart_banner image provided by the user.
  const photoSrc = resolveImage('images/cart_banner.png');
  const opts = {
    parse_mode: 'Markdown',
    ...keyboard,
  };

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo && photoSrc) {
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: text, parse_mode: 'Markdown' },
          opts
        );
        rememberTelegramPhoto('images/cart_banner.png', edited);
      } else {
        await ctx.deleteMessage().catch(() => {});
        if (photoSrc) {
          const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
          rememberTelegramPhoto('images/cart_banner.png', sent);
        } else {
          await ctx.reply(text, opts);
        }
      }
      return;
    } catch (e) {
      if (isMessageNotModifiedError(e)) return;
    }
  }

  if (photoSrc) {
    const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
    rememberTelegramPhoto('images/cart_banner.png', sent);
  } else {
    await ctx.reply(text, opts);
  }
}

function register(bot) {
  bot.action('cart', showCart);
  bot.command('cart', showCart);
  bot.command('panier', showCart);

  bot.action(/^cart:inc:(\d+)$/, async (ctx) => {
    const cartItemId = Number(ctx.match[1]);
    try {
      await cartService.incrementItem(ctx.state.user.id, cartItemId);
      await ctx.answerCbQuery('+1');
    } catch (e) {
      await ctx.answerCbQuery(e.message, { show_alert: true });
      return;
    }
    return showCart(ctx);
  });

  bot.action(/^cart:dec:(\d+)$/, async (ctx) => {
    const cartItemId = Number(ctx.match[1]);
    await cartService.decrementItem(ctx.state.user.id, cartItemId);
    await ctx.answerCbQuery('-1');
    return showCart(ctx);
  });

  bot.action('cart:clear', async (ctx) => {
    await cartService.clear(ctx.state.user.id);
    await ctx.answerCbQuery('Cart cleared');
    return showCart(ctx);
  });
}

module.exports = { register, showCart };
