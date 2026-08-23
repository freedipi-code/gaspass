const { Scenes, Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');
const { replyWithBrandImage } = require('../brand-message');

// -- Checkout State Machine --
const STEPS = {
  NAME: 'name',
  STREET: 'street',
  APT: 'apt',
  CITY: 'city',
  POSTCODE: 'postcode',
  COUNTRY: 'country',
  REVIEW_SHIPPING: 'review_shipping',
  PAYMENT_METHOD: 'payment_method',
  REFUND: 'refund',
  SUMMARY: 'summary',
};

// Format the shipping address block as blockquote
function buildShippingBlock(data) {
  const lines = [
    data.shippingName || '',
    data.shippingStreet || '',
    (data.shippingApt && data.shippingApt !== 'n/a') ? data.shippingApt : '',
    data.shippingCity || '',
    data.shippingZip || '',
    data.shippingCountry || ''
  ].filter(Boolean);
  
  return lines.map(line => `> ${line}`).join('\n');
}

// Build the review keyboard matching Image 1
function buildReviewKeyboard() {
  return [
    [
      Markup.button.callback('< Cancel', 'checkout:cancel'),
      Markup.button.callback('Restart', 'checkout:restart'),
      Markup.button.callback('✅ Okay', 'checkout:step:payment_method')
    ],
    [
      Markup.button.callback('Name', 'checkout:edit:name'),
      Markup.button.callback('Street Address', 'checkout:edit:street')
    ],
    [
      Markup.button.callback('Ap.No. / Po box', 'checkout:edit:apt'),
      Markup.button.callback('City', 'checkout:edit:city')
    ],
    [
      Markup.button.callback('Postcode', 'checkout:edit:postcode'),
      Markup.button.callback('Country', 'checkout:edit:country')
    ]
  ];
}

async function renderStep(ctx) {
  const data = ctx.scene.session.checkout;
  let text = '';
  let keyboard = [];

  switch (data.step) {
    case STEPS.NAME:
      text = `📦 *Shipping Details*\n\n💬 Send recipient full Name:`;
      keyboard = [[Markup.button.callback('< Cancel', 'checkout:cancel')]];
      break;

    case STEPS.STREET:
      text = `📦 *Shipping Details*\n\n💬 Send Street Address:`;
      keyboard = [[Markup.button.callback('< Cancel', 'checkout:cancel')]];
      break;

    case STEPS.APT:
      text = `📦 *Shipping Details*\n\n💬 Send Apartment number or PO Box (or click Skip):`;
      keyboard = [
        [Markup.button.callback('Skip', 'checkout:skip_apt')],
        [Markup.button.callback('< Cancel', 'checkout:cancel')]
      ];
      break;

    case STEPS.CITY:
      text = `📦 *Shipping Details*\n\n💬 Send City:`;
      keyboard = [[Markup.button.callback('< Cancel', 'checkout:cancel')]];
      break;

    case STEPS.POSTCODE:
      text = `📦 *Shipping Details*\n\n💬 Send Postcode:`;
      keyboard = [[Markup.button.callback('< Cancel', 'checkout:cancel')]];
      break;

    case STEPS.COUNTRY:
      text = `📦 *Shipping Details*\n\n💬 Send Country:`;
      keyboard = [[Markup.button.callback('< Cancel', 'checkout:cancel')]];
      break;

    case STEPS.REVIEW_SHIPPING:
      text = `📦 *Shipping Details*\n\n` +
             `${buildShippingBlock(data)}\n\n` +
             `✅ *Review your shipping details.*\n` +
             `If everything is correct, press "Okay".`;
      keyboard = buildReviewKeyboard();
      break;

    case STEPS.PAYMENT_METHOD:
      text = `💳 *Payment Method*\n\n💬 Select your currency:`;
      keyboard = [
        [Markup.button.callback('Bitcoin (BTC)', 'checkout:setpay:BTC')],
        [Markup.button.callback('Monero (XMR)', 'checkout:setpay:XMR')],
        [Markup.button.callback('< Back to Shipping', 'checkout:step:review_shipping')]
      ];
      break;

    case STEPS.REFUND:
      const name = data.paymentMethod === 'BTC' ? 'Bitcoin' : 'Monero';
      text = `💳 *Payment Method*\nCurrency:\n*${name}*\nRefund address:\n...\n\n✏️ SEND ME YOUR ${data.paymentMethod} REFUND ADDRESS:`;
      keyboard = [[Markup.button.callback('< Payment Method', 'checkout:step:payment_method')]];
      break;

    case STEPS.SUMMARY:
      const cart = await cartService.getCartWithItems(ctx.state.user.id);
      const total = cartService.computeTotal(cart);
      const shippingFee = 10.00;
      const cartTotal = total + shippingFee;
      
      const productIds = ctx.session?.catalogProducts || [];
      
      // Group items by product
      const productGroups = {};
      for (const it of cart.items) {
        if (!productGroups[it.productId]) {
          productGroups[it.productId] = {
            product: it.product,
            items: []
          };
        }
        productGroups[it.productId].items.push(it);
      }
      
      const itemsLines = [];
      for (const pId in productGroups) {
        const group = productGroups[pId];
        const p = group.product;
        const pIndex = productIds.indexOf(p.id);
        const link = pIndex >= 0 ? `/p${pIndex}` : `/p_${p.id}`;
        
        itemsLines.push(`*${p.name.toUpperCase()}*`);
        itemsLines.push(`${link}`);
        itemsLines.push(`(by ${shop.vendorName})`);
        
        for (const it of group.items) {
          const label = it.variant ? `(${it.variant.label})` : '1x';
          itemsLines.push(`${label} x${it.quantity} = ${formatPrice(it.unitPrice * it.quantity)}`);
        }
        itemsLines.push('');
      }

      const itemsText = itemsLines.join('\n');
      const addressBlock = buildShippingBlock(data);

      text = `🛒 *My Cart*\n\n${itemsText}` +
             `Shipping:\n${shop.vendorName}—${formatPrice(shippingFee)}\n\n` +
             `*Cart Total: ${formatPrice(cartTotal)}*\n\n` +
             `📦 *Shipping Details:*\n${addressBlock}`;
             
      if (data.paymentMethod && data.refundAddress) {
        const payName = data.paymentMethod === 'BTC' ? 'Bitcoin' : 'Monero';
        text += `\n\n💳 *Payment Method:*\n${data.paymentMethod} - ${payName}\nRefund address:\n\`${data.refundAddress}\``;
      }

      // Configure summary keyboard buttons matching Image 2
      const placeOrSelectBtn = (data.paymentMethod && data.refundAddress)
        ? Markup.button.callback('✅ Place Order >', 'checkout:place_order')
        : Markup.button.callback('Select Payment Method', 'checkout:step:payment_method');

      keyboard = [
        [Markup.button.callback('⇌ Back', 'checkout:step:review_shipping')],
        [Markup.button.callback('Add Order Notes', 'checkout:noop'), placeOrSelectBtn],
        [Markup.button.callback('Empty Cart', 'cart:clear'), Markup.button.callback('Edit Shipping Details', 'checkout:step:review_shipping')],
        [Markup.button.callback('Apply Vouchers', 'checkout:noop')]
      ];
      break;
  }

  const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };
  await replyWithBrandImage(ctx, text, opts);
}

const checkout = new Scenes.BaseScene('checkout');

checkout.enter(async (ctx) => {
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  if (!cart.items.length) {
    await ctx.reply('🛒 Your cart is empty.');
    return ctx.scene.leave();
  }
  ctx.scene.session.checkout = { step: STEPS.NAME };
  await renderStep(ctx);
});

checkout.on('text', async (ctx) => {
  const data = ctx.scene.session.checkout || {};
  const text = ctx.message.text.trim();

  if (text.startsWith('/')) {
    if (text.toLowerCase() === '/cancel') {
      await ctx.reply('❌ Order cancelled.');
      return ctx.scene.leave();
    }
    await ctx.reply('Commands are ignored during checkout. Type /cancel to cancel.');
    return;
  }

  const wasEditing = data.isEditing;

  switch (data.step) {
    case STEPS.NAME:
      data.shippingName = text;
      data.step = wasEditing ? STEPS.REVIEW_SHIPPING : STEPS.STREET;
      break;
    case STEPS.STREET:
      data.shippingStreet = text;
      data.step = wasEditing ? STEPS.REVIEW_SHIPPING : STEPS.APT;
      break;
    case STEPS.APT:
      data.shippingApt = text;
      data.step = wasEditing ? STEPS.REVIEW_SHIPPING : STEPS.CITY;
      break;
    case STEPS.CITY:
      data.shippingCity = text;
      data.step = wasEditing ? STEPS.REVIEW_SHIPPING : STEPS.POSTCODE;
      break;
    case STEPS.POSTCODE:
      data.shippingZip = text;
      data.step = wasEditing ? STEPS.REVIEW_SHIPPING : STEPS.COUNTRY;
      break;
    case STEPS.COUNTRY:
      data.shippingCountry = text;
      data.step = STEPS.REVIEW_SHIPPING;
      break;
    case STEPS.REFUND:
      data.refundAddress = text;
      data.step = STEPS.SUMMARY;
      break;
    default:
      return;
  }

  if (wasEditing && data.step === STEPS.REVIEW_SHIPPING) {
    data.isEditing = false;
  }
  
  ctx.scene.session.checkout = data;
  await renderStep(ctx);
});

// Edit specific fields from review keyboard
checkout.action(/^checkout:edit:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const field = ctx.match[1];
  const data = ctx.scene.session.checkout;
  data.step = field;
  data.isEditing = true;
  await renderStep(ctx);
});

// Navigate to specific steps
checkout.action(/^checkout:step:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.step = ctx.match[1];
  await renderStep(ctx);
});

// Skip APT field
checkout.action('checkout:skip_apt', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.shippingApt = 'n/a';
  data.step = data.isEditing ? STEPS.REVIEW_SHIPPING : STEPS.CITY;
  data.isEditing = false;
  await renderStep(ctx);
});

// Set payment method (BTC or XMR)
checkout.action(/^checkout:setpay:(BTC|XMR)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.paymentMethod = ctx.match[1];
  data.step = STEPS.REFUND;
  await renderStep(ctx);
});

// Restart checkout
checkout.action('checkout:restart', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout = { step: STEPS.NAME };
  await renderStep(ctx);
});

// Cancel checkout
checkout.action('checkout:cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled').catch(() => {});
  await ctx.reply('❌ Order cancelled.');
  return ctx.scene.leave();
});

checkout.action('checkout:noop', async (ctx) => {
  await ctx.answerCbQuery('Feature coming soon!').catch(() => {});
});

checkout.action('cart:clear', async (ctx) => {
  await cartService.clear(ctx.state.user.id);
  await ctx.answerCbQuery('Cart emptied').catch(() => {});
  await ctx.reply('🛒 Your cart has been emptied.');
  return ctx.scene.leave();
});

module.exports = checkout;
