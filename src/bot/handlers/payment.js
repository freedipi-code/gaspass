const { Markup } = require('telegraf');
const config = require('../../config');
const orderService = require('../../services/order.service');
const notifyService = require('../../services/notify.service');
const cryptoService = require('../../services/crypto.service');
const { formatPrice } = require('../keyboards');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function checkoutErrorMessage(error) {
  if (error?.message === 'Cart empty') return 'Your cart is empty. Add a product and try again.';
  if (error?.message?.startsWith('Insufficient stock for ')) return error.message;
  return 'The order could not be created. Please try again in a moment.';
}

async function completeCheckout(ctx) {
  const data = ctx.session?.checkout;
  if (!data?.shippingAddress || !data?.email || !data?.shippingMethod || !data?.paymentMethod) {
    await ctx.answerCbQuery('Checkout session expired', { show_alert: true }).catch(() => {});
    await ctx.reply('Your checkout session expired. Please open your cart and try again.');
    return null;
  }
  if (ctx.session.checkoutProcessing) {
    await ctx.answerCbQuery('Order already being created').catch(() => {});
    return null;
  }

  const walletAddress = data.paymentMethod === 'BTC' ? config.wallets.btc : config.wallets.ltc;
  if (!walletAddress) {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.reply(`${data.paymentMethod} payments are temporarily unavailable. Please choose another payment method.`);
    return null;
  }

  ctx.session.checkoutProcessing = true;
  await ctx.answerCbQuery('Creating order…').catch(() => {});

  try {
    let order = await orderService.createOrderFromCart(ctx.state.user.id, data);
    const amount = await cryptoService.convertFiatToCrypto(
      order.total,
      order.paymentMethod,
      order.fiatCurrency,
    );
    const cryptoAmount = amount.toFixed(8);
    order = await orderService.setCryptoAmount(order.id, cryptoAmount);
    order = await orderService.getOrder(order.id);

    const uriPrefix = order.paymentMethod === 'BTC' ? 'bitcoin:' : 'litecoin:';
    const paymentUri = `${uriPrefix}${walletAddress}?amount=${cryptoAmount}`;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(paymentUri)}&size=600&margin=2`;
    const network = order.paymentMethod === 'BTC' ? 'BTC' : 'LTC';

    const paymentText = [
      `Order reference: <b>${escapeHtml(order.orderNumber)}</b>`,
      '',
      `<b>Pay with ${order.paymentMethod} on ${network} network</b>`,
      '',
      `• Fiat amount: <b>${escapeHtml(formatPrice(order.total))} ${escapeHtml(order.fiatCurrency)}</b>`,
      `• Total to send: <code>${cryptoAmount} ${order.paymentMethod}</code>`,
      '',
      '• Address:',
      `<code>${escapeHtml(walletAddress)}</code>`,
      '',
      '• <b>IMPORTANT:</b> Copy the address exactly and select the correct network when sending.',
    ].join('\n');

    try {
      await ctx.replyWithPhoto(
        { url: qrUrl },
        { caption: paymentText, parse_mode: 'HTML' },
      );
    } catch (qrError) {
      console.error('Payment QR delivery failed:', qrError.message);
      await ctx.reply(paymentText, { parse_mode: 'HTML' });
    }

    const itemLines = order.items.map((item) =>
      `${escapeHtml(item.product.name)} - x${item.quantity}`);
    await ctx.reply([
      'Your order status is now <b>open</b>',
      `🟢 <b>${escapeHtml(order.orderNumber)}</b>`,
      '',
      ...itemLines,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'orders')],
        [Markup.button.callback('🤖 Menu', 'home')],
      ]),
    });

    await notifyService.notifyNewOrder({ telegram: ctx.telegram }, order, ctx);
    ctx.session.awaitingProofFor = order.id;
    delete ctx.session.checkout;
    return order;
  } catch (error) {
    console.error('Checkout order creation failed:', error);
    await ctx.reply(checkoutErrorMessage(error)).catch(() => {});
    return null;
  } finally {
    delete ctx.session.checkoutProcessing;
  }
}

function register(bot) {
  bot.action('checkout', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.scene.enter('checkout');
  });
  bot.command('checkout', (ctx) => ctx.scene.enter('checkout'));

  // Compatibility with checkout messages created before this flow update.
  bot.action('checkout:place_order', completeCheckout);

  bot.on(['photo', 'document'], async (ctx, next) => {
    if (!ctx.session?.awaitingProofFor) return next();
    const orderId = ctx.session.awaitingProofFor;
    const order = await orderService.getOrder(orderId);
    if (!order) return next();
    await orderService.markProofReceived(orderId, 'media');
    await notifyService.forwardProofToAdmin(bot, order, ctx);
    await ctx.reply('✅ Proof received, thank you. The admin will validate your order shortly.');
    ctx.session.awaitingProofFor = null;
  });

  bot.on('text', async (ctx, next) => {
    if (!ctx.session?.awaitingProofFor) return next();
    if (ctx.message.text.startsWith('/')) return next();
    const orderId = ctx.session.awaitingProofFor;
    const order = await orderService.getOrder(orderId);
    if (!order) return next();
    await orderService.markProofReceived(orderId, ctx.message.text.slice(0, 500));
    await notifyService.forwardProofToAdmin(bot, order, ctx);
    await ctx.reply('✅ Proof received, thank you. The admin will validate your order shortly.');
    ctx.session.awaitingProofFor = null;
  });
}

module.exports = { register, completeCheckout };
