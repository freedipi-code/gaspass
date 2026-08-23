const { Scenes, Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');

const STEPS = {
  PAYMENT_METHOD: 'PAYMENT_METHOD',
  SHIPPING_METHOD: 'SHIPPING_METHOD',
  COUPON: 'COUPON',
  DELIVERY: 'DELIVERY',
  REVIEW: 'REVIEW',
  NOTES: 'NOTES',
};

async function renderStep(ctx) {
  const data = ctx.scene.session.checkout;
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  const subtotal = cartService.computeTotal(cart);
  const shippingPrice = data.shippingMethod ? data.shippingMethod.price : 0;
  const total = subtotal + shippingPrice;

  let text = '';
  let keyboard = [];
  const banner = shop.pageImage;

  switch (data.step) {
    case STEPS.PAYMENT_METHOD:
      text = `Checkout\n\nChoose which asset you want to pay with.`;
      keyboard = [
        [{ text: '₿ BTC', callback_data: 'checkout:pay:BTC', style: 'primary' }],
        [{ text: 'Ł LTC', callback_data: 'checkout:pay:LTC', style: 'primary' }],
        [{ text: '← Back', callback_data: 'cart', style: 'danger' }],
        [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }],
      ];
      break;

    case STEPS.SHIPPING_METHOD:
      text = `Checkout\n\nChoose a shipping method.`;
      keyboard = [
        [{ text: '📦 24 NDD 1PM · GBP 11.00', callback_data: 'checkout:ship:11.00:24 NDD 1PM' }],
        [{ text: '📦 24NDD · GBP 5.00', callback_data: 'checkout:ship:5.00:24NDD' }],
        [{ text: '← Back', callback_data: 'checkout:step:PAYMENT_METHOD', style: 'danger' }],
        [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }],
      ];
      break;

    case STEPS.COUPON:
      text = `Checkout\n\nSubtotal: ${formatPrice(subtotal)}\nShipping: ${formatPrice(shippingPrice)}\nTotal: ${formatPrice(total)}\n\nSend a discount code in one message, or tap Skip if you do not have one.`;
      keyboard = [
        [{ text: 'Skip', callback_data: 'checkout:coupon:skip' }],
        [{ text: '← Back', callback_data: 'checkout:step:SHIPPING_METHOD', style: 'danger' }],
        [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }],
      ];
      break;

    case STEPS.DELIVERY:
      text = `Checkout\n\nSubtotal: ${formatPrice(subtotal)}\nShipping: ${formatPrice(shippingPrice)}\nTotal: ${formatPrice(total)}\n\nSend the delivery details in one message. This text will be encrypted before the order is created.\n\nYou can paste delivery details, PGP ciphertext, or a temp.pm-style link. Photos, videos, and files will not move checkout on.`;
      keyboard = [
        [{ text: '← Back', callback_data: 'checkout:step:COUPON', style: 'danger' }],
        [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }],
      ];
      break;

    case STEPS.NOTES:
      text = `Checkout\n\nPlease send any order notes in one message (or type /cancel to abort):`;
      keyboard = [
        [{ text: '← Back', callback_data: 'checkout:step:REVIEW', style: 'danger' }],
        [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }],
      ];
      break;

    case STEPS.REVIEW:
      const itemsText = cart.items.map(it => {
        const label = it.variant ? ` · ${it.variant.label}` : '';
        return `• ${it.product.name}${label} x${it.quantity} = ${formatPrice(it.unitPrice * it.quantity)}`;
      }).join('\n');

      text = `Checkout\n\nReview the order details below before you continue.\n\n` +
             `Order Items\n${itemsText}\n\n` +
             `Subtotal: ${formatPrice(subtotal)}\n` +
             `Shipping: ${formatPrice(shippingPrice)}\n` +
             `Total: ${formatPrice(total)}\n\n` +
             `Payment Asset: ${data.paymentMethod}\n\n` +
             `Delivery Details\n${data.deliveryDetails}\n\n` +
             `Order Notes\n${data.orderNotes || 'No order notes added.'}\n\n` +
             `Your delivery details will be encrypted before the order is created.`;

      keyboard = [
        [Markup.button.callback('📦 Edit Delivery', 'checkout:edit_delivery')],
        [Markup.button.callback('📝 Add Notes', 'checkout:add_notes')],
        [Markup.button.callback('📮 Change Shipping', 'checkout:change_shipping')],
        [{ text: '✅ Continue', callback_data: 'checkout:place_order', style: 'success' }],
        [{ text: '← Back', callback_data: 'checkout:step:DELIVERY', style: 'danger' }],
      ];
      break;
  }

  // Use sendOrEditHelper format
  const photoSrc = resolveImage(banner);
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  };

  // Check if we can edit caption/text
  if (ctx.callbackQuery) {
    try {
      if (ctx.callbackQuery.message?.photo && photoSrc) {
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: text, parse_mode: 'Markdown' },
          opts
        );
        rememberTelegramPhoto(banner, edited);
      } else {
        await ctx.deleteMessage().catch(() => {});
        if (photoSrc) {
          const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
          rememberTelegramPhoto(banner, sent);
        }
        else await ctx.reply(text, opts);
      }
      return;
    } catch (e) {
      if (isMessageNotModifiedError(e)) return;
    }
  }

  if (photoSrc) {
    const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
    rememberTelegramPhoto(banner, sent);
  } else {
    await ctx.reply(text, opts);
  }
}

const checkout = new Scenes.BaseScene('checkout');

checkout.enter(async (ctx) => {
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  if (!cart.items.length) {
    await ctx.reply('🛒 Your cart is empty.');
    return ctx.scene.leave();
  }
  ctx.scene.session.checkout = {
    step: STEPS.PAYMENT_METHOD,
    paymentMethod: 'BTC',
    shippingMethod: null,
    coupon: null,
    deliveryDetails: '',
    orderNotes: 'No order notes added.',
  };
  await renderStep(ctx);
});

// Text input captures
checkout.on('text', async (ctx) => {
  const data = ctx.scene.session.checkout || {};
  const text = ctx.message.text.trim();

  if (text.startsWith('/')) {
    if (text === '/cancel') {
      await ctx.reply('❌ Checkout cancelled.');
      return ctx.scene.leave();
    }
    await ctx.reply('Commands are ignored during checkout. Type /cancel to cancel.');
    return;
  }

  if (data.step === STEPS.COUPON) {
    data.coupon = text;
    data.step = STEPS.DELIVERY;
    await renderStep(ctx);
  } else if (data.step === STEPS.DELIVERY) {
    data.deliveryDetails = text;
    data.step = STEPS.REVIEW;
    await renderStep(ctx);
  } else if (data.step === STEPS.NOTES) {
    data.orderNotes = text;
    data.step = STEPS.REVIEW;
    await renderStep(ctx);
  }
});

// Navigation actions
checkout.action(/^checkout:step:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = ctx.match[1];
  await renderStep(ctx);
});

checkout.action(/^checkout:pay:(BTC|LTC)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.paymentMethod = ctx.match[1];
  ctx.scene.session.checkout.step = STEPS.SHIPPING_METHOD;
  await renderStep(ctx);
});

checkout.action(/^checkout:ship:([\d\.]+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.shippingMethod = {
    price: Number(ctx.match[1]),
    name: ctx.match[2],
  };
  ctx.scene.session.checkout.step = STEPS.COUPON;
  await renderStep(ctx);
});

checkout.action('checkout:coupon:skip', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = STEPS.DELIVERY;
  await renderStep(ctx);
});

checkout.action('checkout:edit_delivery', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = STEPS.DELIVERY;
  await renderStep(ctx);
});

checkout.action('checkout:add_notes', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = STEPS.NOTES;
  await renderStep(ctx);
});

checkout.action('checkout:change_shipping', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = STEPS.SHIPPING_METHOD;
  await renderStep(ctx);
});

module.exports = checkout;
