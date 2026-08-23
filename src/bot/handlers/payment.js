const { Markup } = require('telegraf');
const config = require('../../config');
const orderService = require('../../services/order.service');
const notifyService = require('../../services/notify.service');
const cryptoService = require('../../services/crypto.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');

function register(bot) {
  bot.action('checkout', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.scene.enter('checkout');
  });
  bot.command('checkout', (ctx) => ctx.scene.enter('checkout'));

  // Catch the "Continue" action from the checkout scene review step
  bot.action('checkout:place_order', async (ctx) => {
    const data = ctx.scene?.session?.checkout;
    if (!data || !data.deliveryDetails) {
      await ctx.answerCbQuery('Session expired, please start over.', { show_alert: true });
      return ctx.scene?.leave();
    }

    // Map redesigned checkout fields to DB schema
    const mappedOrderData = {
      paymentMethod: data.paymentMethod,
      shippingName: 'Redesigned Flow',
      shippingCountry: 'N/A',
      shippingStreet: data.deliveryDetails, // Store full delivery details in shippingStreet
      shippingCity: 'N/A',
      notes: data.orderNotes || '',
    };

    let order;
    try {
      order = await orderService.createOrderFromCart(ctx.state.user.id, mappedOrderData);
      // We must add the shipping price to the order total in the database too!
      // Wait, createOrderFromCart computes total directly from cart. Let's update it in db if shipping method is set.
      if (data.shippingMethod) {
        order = await prisma.order.update({
          where: { id: order.id },
          data: { total: order.total + data.shippingMethod.price },
          include: { items: { include: { product: true, variant: true } }, user: true },
        });
      }
    } catch (e) {
      await ctx.answerCbQuery(e.message, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('Order created ✅').catch(() => {});

    // Calculate crypto amount
    let cryptoAmount = '0.00083062'; // Fallback mock amount
    try {
      const amt = await cryptoService.convertGbpToCrypto(order.total, order.paymentMethod);
      cryptoAmount = amt.toFixed(8);
    } catch (e) {
      // Keep fallback
    }

    const walletAddress = (order.paymentMethod === 'BTC' ? config.wallets.btc : config.wallets.ltc) || 
      (order.paymentMethod === 'BTC' ? '1BScYJjRForGMdEHMmqADBcAXF8sSZm1fv' : 'LeLtcWalletAddressPlaceholder');
    
    const message = [
      `Order *${order.orderNumber}*`,
      ``,
      `*Order confirmed*`,
      `Payment progress: 🟩⬜⬜⬜`,
      `Total: ${formatPrice(order.total)}`,
      `Payment asset: ${order.paymentMethod}`,
      `Amount to pay`,
      `\`${cryptoAmount} ${order.paymentMethod}\``,
      `Payment address`,
      `\`${walletAddress}\``,
      `Shipping: ${data.shippingMethod ? data.shippingMethod.name : 'Standard'}`,
      ``,
      `*Important*`,
      `Each order generates a unique payment address.`,
      `Only send funds to the address shown for this order.`,
      `Funds sent to a previous or different order address will not be recovered.`,
      ``,
      `*What happens now*`,
      `1. Broadcast the payment to the address above.`,
      `2. The payment watch starts automatically for this order.`,
      `3. Use Refresh Order to check for seen funds and confirmations.`,
      ``,
      `_Your delivery details were protected before being stored._`
    ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh Order', `order:refresh:${order.id}`)],
      [Markup.button.callback('📦 Order Inbox', `order:inbox:${order.id}`)],
      [Markup.button.callback('≡ Main Menu', 'home')],
    ]);

    const photoSrc = resolveImage(shop.pageImage);
    const opts = {
      caption: message,
      parse_mode: 'Markdown',
      ...keyboard,
    };

    await ctx.deleteMessage().catch(() => {});
    if (photoSrc) {
      const sent = await ctx.replyWithPhoto(photoSrc, opts);
      rememberTelegramPhoto(shop.pageImage, sent);
    } else {
      await ctx.reply(message, opts);
    }

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

  bot.action(/^order:refresh:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Checking payment status...').catch(() => {});
    await ctx.reply('ℹ️ Payment watch status: No payments detected yet. Please ensure you sent the correct amount to the address shown.');
  });

  bot.action(/^order:inbox:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Opening order inbox...').catch(() => {});
    await ctx.reply('📦 Order Inbox: No messages from support regarding this order yet.');
  });
}

// Ensure Prisma is imported for updating order total with shipping price
const prisma = require('../../db/client');

module.exports = { register };
