const { Markup } = require('telegraf');
const config = require('../../config');
const orderService = require('../../services/order.service');
const notifyService = require('../../services/notify.service');
const cryptoService = require('../../services/crypto.service');
const cartService = require('../../services/cart.service');
const { cartButton } = require('../keyboards');

function formatCryptoAmount(amount, paymentMethod) {
  return amount.toFixed(paymentMethod === 'XMR' ? 12 : 8);
}

function buildPaymentUri(paymentMethod, walletAddress, amount) {
  if (paymentMethod === 'XMR') {
    return `monero:${walletAddress}?tx_amount=${amount}`;
  }
  return `bitcoin:${walletAddress}?amount=${amount}`;
}

function register(bot) {
  bot.action('checkout', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.scene.enter('checkout');
  });
  bot.command('checkout', (ctx) => ctx.scene.enter('checkout'));

  // Catch the "Place Order >" action from the checkout scene summary
  bot.action('checkout:place_order', async (ctx) => {
    const data = ctx.scene?.session?.checkout;
    if (!data || !data.shippingName || !data.paymentMethod) {
      await ctx.answerCbQuery('Session expired, please start over.', { show_alert: true });
      return ctx.scene?.leave();
    }

    const paymentMethod = data.paymentMethod;
    const walletAddress = paymentMethod === 'BTC' ? config.wallets.btc : config.wallets.xmr;
    if (!walletAddress) {
      await ctx.answerCbQuery(`${paymentMethod} wallet is not configured.`, { show_alert: true });
      return;
    }

    // Resolve the exchange rate before creating the order. If CoinGecko is
    // unavailable, the cart remains intact and no unusable order is created.
    let cryptoAmount;
    try {
      const cart = await cartService.getCartWithItems(ctx.state.user.id);
      const total = cartService.computeTotal(cart);
      const amount = await cryptoService.convertUsdToCrypto(total, paymentMethod);
      cryptoAmount = formatCryptoAmount(amount, paymentMethod);
    } catch (e) {
      console.error('Crypto price lookup failed:', e.message);
      await ctx.answerCbQuery('Unable to retrieve the current crypto price. Please try again.', {
        show_alert: true,
      });
      return;
    }

    let order;
    try {
      order = await orderService.createOrderFromCart(ctx.state.user.id, data);
    } catch (e) {
      await ctx.answerCbQuery(e.message, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('Order created ✅').catch(() => {});

    // Generate a wallet-compatible BTC or Monero payment URI.
    const paymentUri = buildPaymentUri(order.paymentMethod, walletAddress, cryptoAmount);
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(paymentUri)}&size=400&margin=2`;

    const message = `Order ${order.orderNumber}\n\n*Next step:*\n\nSend\n\`${cryptoAmount} ${order.paymentMethod}\`\nto\n\`${walletAddress}\`\n\nYou have 30 minutes to send the full payment (it can confirm on the blockchain later). Several payments within 30 minutes are OK. If your payment is detected after 30 minutes, it will be automatically refunded.\n\nOrder details: /ord\\_${order.orderNumber}`;

    // Send the QR code with the message
    await ctx.replyWithPhoto(
      { url: qrUrl },
      {
        caption: message,
        parse_mode: 'Markdown',
      }
    );

    // Prompt for proof of payment
    const cartQuantity = await cartService.getCartQuantity(ctx.state.user.id);
    await ctx.reply(
      '📎 After payment, send a *screenshot* or *transaction hash* directly in this chat — it will be forwarded to the admin.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🏠 Home', 'catalog:page:0:all'),
            cartButton(cartQuantity),
          ],
        ]),
      }
    );

    await notifyService.notifyNewOrder(bot, order, ctx);

    ctx.session = ctx.session || {};
    ctx.session.awaitingProofFor = order.id;

    return ctx.scene.leave();
  });

  // Proof handlers
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
  
  // Dummy order details command
  bot.hears(/^\/ord_(.+)$/, async (ctx) => {
    await ctx.reply(`Details for order ${ctx.match[1]} coming soon.`);
  });
}

module.exports = { register, formatCryptoAmount, buildPaymentUri };
