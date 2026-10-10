const { Scenes, Markup } = require('telegraf');
const cartService = require('../../services/cart.service');
const shop = require('../../shop.config');

const STEPS = {
  ADDRESS: 'address',
  EMAIL: 'email',
  SHIPPING: 'shipping',
  PAYMENT: 'payment',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function selectedCountry(ctx) {
  return shop.countries.find((country) => country.code === ctx.state.user.countryCode);
}

function addressPrompt(country) {
  return [
    '📍 <b>Provide Your Address</b>',
    '',
    'We encrypt your address for more privacy, so you do not have to worry about it.',
    '',
    '<b>Send the complete address in one message:</b>',
    '',
    'JOHNY DEEP – YOUR NAME',
    '69 MADISON STREET – STREET NAME AND NUMBER',
    'MANCHESTER – CITY',
    'ESSEX – COUNTY',
    'CM50 5PA – POST CODE',
    `${escapeHtml(country.name.toUpperCase())} – COUNTRY`,
    '+42 1234567 – PHONE NUMBER',
    '',
    '⚠️ Please ensure you enter a correct address.',
  ].join('\n');
}

async function renderStep(ctx) {
  const data = ctx.scene.session.checkout;
  let text;
  let rows = [];

  if (data.step === STEPS.ADDRESS) {
    text = addressPrompt(data.country);
    rows = [[Markup.button.callback('❌ Cancel', 'checkout:cancel')]];
  } else if (data.step === STEPS.EMAIL) {
    text = '📧 <b>Enter your e-mail address</b>\n\nIt will be attached to your order confirmation.';
    rows = [[Markup.button.callback('⬅️ Edit address', 'checkout:edit:address')]];
  } else if (data.step === STEPS.SHIPPING) {
    text = '🚚 <b>Please select your shipping method:</b>';
    rows = [[
      Markup.button.callback(
        `${data.country.shippingLabel} — ${shop.currency}${data.country.shippingFee.toFixed(2)}`,
        'checkout:setshipping',
      ),
    ]];
  } else if (data.step === STEPS.PAYMENT) {
    text = '💰 <b>Please select a payment method:</b>';
    rows = [
      [Markup.button.callback('₿ Bitcoin (BTC)', 'checkout:setpay:BTC')],
      [Markup.button.callback('Ł Litecoin (LTC)', 'checkout:setpay:LTC')],
    ];
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(rows),
  });
}

const checkout = new Scenes.BaseScene('checkout');

checkout.enter(async (ctx) => {
  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  if (!cart.items.length) {
    await ctx.reply('🛒 Your cart is empty.');
    return ctx.scene.leave();
  }

  const country = selectedCountry(ctx);
  if (!country) {
    await ctx.reply('Please choose your delivery country first with /start.');
    return ctx.scene.leave();
  }

  ctx.scene.session.checkout = {
    step: STEPS.ADDRESS,
    country,
    countryCode: country.code,
    shippingCountry: country.name,
    fiatCurrency: country.currency,
  };
  return renderStep(ctx);
});

checkout.on('text', async (ctx) => {
  const data = ctx.scene.session.checkout;
  const value = ctx.message.text.trim();
  if (!data || value.startsWith('/')) return;

  if (data.step === STEPS.ADDRESS) {
    if (value.length < 12 || !value.includes('\n')) {
      return ctx.reply('Please send the complete delivery address in one multi-line message.');
    }
    data.shippingAddress = value.slice(0, 1800);
    data.shippingName = value.split('\n').find(Boolean)?.trim().slice(0, 120) || 'Customer';
    data.step = STEPS.EMAIL;
  } else if (data.step === STEPS.EMAIL) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return ctx.reply('Please enter a valid e-mail address.');
    }
    data.email = value.toLowerCase().slice(0, 254);
    data.step = STEPS.SHIPPING;
  } else {
    return;
  }

  return renderStep(ctx);
});

checkout.action('checkout:edit:address', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.scene.session.checkout.step = STEPS.ADDRESS;
  return renderStep(ctx);
});

checkout.action('checkout:setshipping', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.scene.session.checkout;
  data.shippingMethod = data.country.shippingLabel;
  data.shippingFee = data.country.shippingFee;
  data.step = STEPS.PAYMENT;
  return renderStep(ctx);
});

checkout.action(/^checkout:setpay:(BTC|LTC)$/, async (ctx) => {
  const data = ctx.scene.session.checkout;
  data.paymentMethod = ctx.match[1];
  ctx.session.checkout = { ...data };
  const { completeCheckout } = require('../handlers/payment');
  const order = await completeCheckout(ctx);
  if (order) return ctx.scene.leave();
  data.step = STEPS.PAYMENT;
  return undefined;
});

checkout.command('cancel', async (ctx) => {
  await ctx.reply('❌ Order cancelled.');
  return ctx.scene.leave();
});

checkout.action('checkout:cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled').catch(() => {});
  await ctx.reply('❌ Order cancelled.');
  return ctx.scene.leave();
});

module.exports = checkout;
