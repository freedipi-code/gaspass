const { Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildCartView(cart) {
  if (!cart.items.length) {
    return {
      text: '🛒 <b>Your cart is empty</b>\n\nGo back to Products to browse the catalogue.',
      keyboard: Markup.inlineKeyboard([[Markup.button.callback('🎁 Products', 'categories:root')]]),
    };
  }

  const lines = cart.items.map((it) => {
    const lineTotal = it.unitPrice * it.quantity;
    return `• ${escapeHtml(it.product.name)} — ${it.quantity}×${escapeHtml(formatPrice(it.unitPrice))} = ${escapeHtml(formatPrice(lineTotal))}`;
  });
  
  const total = cartService.computeTotal(cart);
  const text =
    `🛒 <b>You have ${cart.items.length} item${cart.items.length === 1 ? '' : 's'} in your basket:</b>\n\n${lines.join('\n\n')}\n\n` +
    `<b>Subtotal:</b> ${escapeHtml(formatPrice(total))}\n<b>Total:</b> ${escapeHtml(formatPrice(total))}`;

  const rows = [];
  for (const it of cart.items) {
    const name = it.product.name.length > 24 ? `${it.product.name.slice(0, 21)}...` : it.product.name;
    rows.push([
      Markup.button.callback(`❌ Remove ${name} (${it.quantity})`, `cart:remove:${it.id}`),
    ]);
    rows.push([
      Markup.button.callback('−', `cart:dec:${it.id}`),
      Markup.button.callback(`${it.quantity} pcs`, 'noop'),
      Markup.button.callback('+', `cart:inc:${it.id}`),
    ]);
  }
  
  rows.push([Markup.button.callback('💳 Checkout', 'checkout')]);
  rows.push([Markup.button.callback('🎁 Add more products', 'categories:root')]);
  rows.push([Markup.button.callback('🗑️ Clear cart', 'cart:clear')]);
  rows.push([Markup.button.callback('🤖 Menu', 'home')]);

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
        await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
      } else {
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
      }
      return;
    } catch (_) {
      // fallback
    }
  }
  await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
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

  bot.action(/^cart:remove:(\d+)$/, async (ctx) => {
    const cartItemId = Number(ctx.match[1]);
    const cart = await cartService.getCartWithItems(ctx.state.user.id);
    const item = cart.items.find((cartItem) => cartItem.id === cartItemId);
    if (!item) return ctx.answerCbQuery('Item not found', { show_alert: true });
    ctx.session = ctx.session || {};
    ctx.session.pendingCartRemoval = { cartItemId, max: item.quantity };
    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply(`🗑️ You have ${item.quantity} of “${item.product.name}” in your cart.\nHow many would you like to remove?`);
  });

  bot.on('text', async (ctx, next) => {
    const pending = ctx.session?.pendingCartRemoval;
    if (!pending) return next();
    if (ctx.message.text.startsWith('/')) return next();
    const quantity = Number(ctx.message.text.trim());
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > pending.max) {
      return ctx.reply(`Enter a whole number from 1 to ${pending.max}.`);
    }
    try {
      await cartService.removeQuantity(ctx.state.user.id, pending.cartItemId, quantity);
      delete ctx.session.pendingCartRemoval;
      await ctx.reply(`✅ ${quantity} item${quantity === 1 ? '' : 's'} removed.`);
      return showCart(ctx);
    } catch (error) {
      return ctx.reply(error.message || 'Could not update the cart.');
    }
  });

  bot.action('cart:clear', async (ctx) => {
    await cartService.clear(ctx.state.user.id);
    await ctx.answerCbQuery('Cart emptied');
    return showCart(ctx);
  });
}

module.exports = { register, showCart };
