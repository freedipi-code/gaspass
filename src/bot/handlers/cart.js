const { Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');

function buildCartView(cart) {
  if (!cart.items.length) {
    return {
      text: '🛒 *Your cart is empty*\n\nGo back to the catalog to browse products.',
      keyboard: Markup.inlineKeyboard([[Markup.button.callback('⬅️ Catalog', 'catalog:page:0:all')]]),
    };
  }

  const lines = cart.items.map((it) => {
    const label = it.variant ? ` (${it.variant.label})` : '';
    const lineTotal = it.unitPrice * it.quantity;
    return `• ${it.quantity}× ${it.product.name}${label} — ${formatPrice(lineTotal)}`;
  });
  
  const total = cartService.computeTotal(cart);
  const text =
    `🛒 *Your Cart*\n\n${lines.join('\n')}\n\n` +
    `*Total: ${formatPrice(total)}*`;

  const rows = cart.items.map((it) => {
    const btnLabel = it.variant 
      ? `${it.product.name.substring(0,10)}... ${it.variant.label}`
      : `${it.product.name.substring(0,15)}...`;
      
    return [
      Markup.button.callback(`➖`, `cart:dec:${it.id}`),
      Markup.button.callback(btnLabel, 'noop'),
      Markup.button.callback(`➕`, `cart:inc:${it.id}`),
    ];
  });
  
  rows.push([Markup.button.callback('🗑️ Empty', 'cart:clear'), Markup.button.callback('✅ Checkout', 'checkout')]);
  rows.push([Markup.button.callback('⬅️ Catalog', 'catalog:page:0:all')]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function showCart(ctx) {
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  const { text, keyboard } = buildCartView(cart);
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo) {
        // Can't edit photo to text directly, need to reply fresh
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
      } else {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
      }
      return;
    } catch (_) {
      // fallback
    }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
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
    await ctx.answerCbQuery('Cart emptied');
    return showCart(ctx);
  });
}

module.exports = { register, showCart };
