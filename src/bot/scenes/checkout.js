const { Scenes, Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');
const { formatPrice } = require('../keyboards');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// -- Checkout State Machine --
const STEPS = {
  NAME: 'name',
  COUNTRY: 'country',
  STREET: 'street',
  CITY: 'city',
  APT: 'apt', // Only accessible via edit
  PAYMENT_METHOD: 'payment_method',
  REFUND: 'refund',
  SUMMARY: 'summary',
};

// Helpers to format the step prompts
function buildShippingHeader() {
  return `📦 <b>Shipping Details</b>\n`;
}

function buildShippingRecap(data) {
  let recap = buildShippingHeader();
  if (data.shippingName) recap += `Recipient Full Name:\n<b>${escapeHtml(data.shippingName)}</b>\n`;
  if (data.shippingCountry) recap += `Country:\n<b>${escapeHtml(data.shippingCountry)}</b>\n`;
  if (data.shippingStreet) recap += `Street Address:\n<b>${escapeHtml(data.shippingStreet)}</b>\n`;
  if (data.shippingApt) recap += `Apartment number or PO Box:\n<i>${escapeHtml(data.shippingApt)}</i>\n`;
  if (data.shippingCity) recap += `City:\n<b>${escapeHtml(data.shippingCity)}</b>\n`;
  return recap;
}

function buildEditButtons(data) {
  const btns = [];
  btns.push([
    Markup.button.callback('< Cancel', 'checkout:cancel'),
    Markup.button.callback('Restart', 'checkout:edit:name'),
  ]);
  
  const row2 = [];
  if (data.shippingName) row2.push(Markup.button.callback('Name', 'checkout:edit:name'));
  if (data.shippingCountry) row2.push(Markup.button.callback('Country', 'checkout:edit:country'));
  if (row2.length) btns.push(row2);
  
  const row3 = [];
  if (data.shippingStreet) row3.push(Markup.button.callback('Street Address', 'checkout:edit:street'));
  if (data.shippingApt) row3.push(Markup.button.callback('Ap.No. / Po box', 'checkout:edit:apt'));
  if (row3.length) btns.push(row3);
  
  const row4 = [];
  if (data.shippingCity) row4.push(Markup.button.callback('City', 'checkout:edit:city'));
  if (row4.length) btns.push(row4);
  
  return btns;
}

async function renderStep(ctx) {
  const data = ctx.scene.session.checkout;
  let text = '';
  let keyboard = [];

  switch (data.step) {
    case STEPS.NAME:
      text = buildShippingHeader() + `\n💬 Type in the recipient's First and Last Name only (example: John Smtih) and hit "send." (Or enter the Business Name).`;
      keyboard = [
        [Markup.button.callback('< Cancel', 'checkout:cancel')],
        [Markup.button.callback('Encrypt my shipping details', 'checkout:noop')]
      ];
      break;

    case STEPS.COUNTRY:
      text = buildShippingRecap(data) + `\n💬 Send me Country:`;
      keyboard = buildEditButtons(data);
      break;

    case STEPS.STREET:
      text = buildShippingRecap(data) + `\n💬 Now send me the Street Address. For example: 2549 Main Street.`;
      keyboard = buildEditButtons(data);
      break;
      
    case STEPS.APT:
      text = buildShippingRecap(data) + `\n💬 Send me Apartment number or PO Box:`;
      keyboard = buildEditButtons(data);
      break;

    case STEPS.CITY:
      text = buildShippingRecap(data) + `\n💬 Send me City/Zip code:`;
      keyboard = buildEditButtons(data);
      break;

    case STEPS.PAYMENT_METHOD:
      text = `💳 <b>Payment Method</b>\n\n💬 Select your currency:`;
      keyboard = [
        [Markup.button.callback('Bitcoin (BTC)', 'checkout:setpay:BTC')],
        [Markup.button.callback('Litecoin (LTC)', 'checkout:setpay:LTC')],
        [Markup.button.callback('< Back to Shipping', 'checkout:edit:city')]
      ];
      break;

    case STEPS.REFUND:
      text = `💳 <b>Payment Method</b>\nCurrency:\n<b>${data.paymentMethod === 'BTC' ? 'Bitcoin' : 'Litecoin'}</b>\nRefund address:\n...\n\n✏️ SEND ME YOUR ${escapeHtml(data.paymentMethod)} REFUND ADDRESS:`;
      keyboard = [
        [Markup.button.callback('< Payment Method', 'checkout:step:payment_method')]
      ];
      break;

    case STEPS.SUMMARY:
      const cart = await cartService.getCartWithItems(ctx.state.user.id);
      const total = cartService.computeTotal(cart);
      
      const productIds = ctx.session?.catalogProducts || [];
      
      let itemsText = cart.items.map(it => {
        let pIndex = productIds.indexOf(it.productId);
        let link = pIndex >= 0 ? `/p${pIndex}` : `/p_${it.productId}`;
        const label = it.variant ? it.variant.label : '1 item';
        return `<b>${escapeHtml(it.product.name)}</b>\n${escapeHtml(link)}\n(by ${escapeHtml(shop.vendorName)})\n${escapeHtml(label)} x${it.quantity} = ${escapeHtml(formatPrice(it.unitPrice * it.quantity))}`;
      }).join('\n\n');

      let shippingText = `Shipping:\n${escapeHtml(shop.vendorName)}—$0.00`;

      text = `🛒 <b>My Cart</b>\n\n${itemsText}\n\n${shippingText}\n\n<b>Cart Total: ${escapeHtml(formatPrice(total))}</b>\n\n` +
             `📦 <b>Shipping Details:</b>\n${escapeHtml(data.shippingName)}\n${escapeHtml(data.shippingStreet)}\n` +
             (data.shippingApt !== 'n/a' ? `${escapeHtml(data.shippingApt)}\n` : '') +
             `${escapeHtml(data.shippingCity)}\n${escapeHtml(data.shippingCountry)}\n\n` +
             `💳 <b>Payment Method:</b>\n${escapeHtml(data.paymentMethod)} - ${data.paymentMethod === 'BTC' ? 'Bitcoin' : 'Litecoin'}\nRefund address:\n<code>${escapeHtml(data.refundAddress)}</code>`;
             
      keyboard = [
        [Markup.button.callback('⇐ Back', 'checkout:step:refund'), Markup.button.callback('✅ Place Order >', 'checkout:place_order')],
        [Markup.button.callback('Add Order Notes', 'checkout:noop'), Markup.button.callback('Edit Payment Method', 'checkout:step:payment_method')],
        [Markup.button.callback('Empty Cart', 'cart:clear'), Markup.button.callback('Edit Shipping Details', 'checkout:edit:name')],
        [Markup.button.callback('Apply Vouchers', 'checkout:noop')]
      ];
      break;
  }

  const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } };
  
  // We always send a new message for a new prompt as it looks better for conversational flow,
  // except when editing.
  await ctx.reply(text, opts);
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
    await ctx.reply('Commands are ignored during checkout. Type /cancel to cancel.');
    return;
  }

  switch (data.step) {
    case STEPS.NAME:
      data.shippingName = text;
      data.step = STEPS.COUNTRY;
      break;
    case STEPS.COUNTRY:
      data.shippingCountry = text;
      data.step = STEPS.STREET;
      break;
    case STEPS.STREET:
      data.shippingStreet = text;
      data.shippingApt = data.shippingApt || 'n/a'; // Default
      data.step = STEPS.CITY;
      break;
    case STEPS.APT:
      data.shippingApt = text;
      data.step = STEPS.CITY;
      break;
    case STEPS.CITY:
      data.shippingCity = text;
      data.step = STEPS.PAYMENT_METHOD;
      break;
    case STEPS.REFUND:
      data.refundAddress = text;
      data.step = STEPS.SUMMARY;
      break;
    default:
      return; // Ignore text if not in a text-input step
  }
  
  ctx.scene.session.checkout = data;
  await renderStep(ctx);
});

// Edit specific fields
checkout.action(/^checkout:edit:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const field = ctx.match[1];
  const data = ctx.scene.session.checkout;
  data.step = field;
  await renderStep(ctx);
});

// Navigate to specific steps
checkout.action(/^checkout:step:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.step = ctx.match[1];
  await renderStep(ctx);
});

// Set payment method
checkout.action(/^checkout:setpay:(BTC|LTC)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.paymentMethod = ctx.match[1];
  data.step = STEPS.REFUND;
  await renderStep(ctx);
});

// Cancel
checkout.command('cancel', async (ctx) => {
  await ctx.reply('❌ Order cancelled.');
  return ctx.scene.leave();
});

checkout.action('checkout:cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled').catch(() => {});
  await ctx.reply('❌ Order cancelled.');
  return ctx.scene.leave();
});

checkout.action('checkout:noop', async (ctx) => {
  await ctx.answerCbQuery('PGP Encryption coming soon!').catch(() => {});
});

checkout.action('cart:clear', async (ctx) => {
  await cartService.clear(ctx.state.user.id);
  await ctx.answerCbQuery('Cart emptied').catch(() => {});
  await ctx.reply('🛒 Your cart has been emptied.');
  return ctx.scene.leave();
});

module.exports = checkout;
