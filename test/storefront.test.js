const test = require('node:test');
const assert = require('node:assert/strict');

const { productDetailKeyboard } = require('../src/bot/keyboards');
const { buildProductCaption } = require('../src/bot/handlers/products');
const { buildCartView } = require('../src/bot/handlers/cart');
const checkoutScene = require('../src/bot/scenes/checkout');

test('product detail mirrors the selected and in-cart states', () => {
  const product = { id: 7, name: 'Sample Product', price: 34.99 };
  const variants = [
    { id: 11, label: '1 Pack', price: 34.99 },
    { id: 12, label: '2 Pack', price: 59.99 },
  ];

  const caption = buildProductCaption(
    { ...product, description: 'SAMPLE DESCRIPTION' },
    0,
    1,
    2
  );
  assert.match(caption, /Sample Product.*\(1\/1\)/);
  assert.match(caption, /In cart: 2/);

  const rows = productDetailKeyboard(product, variants, 0, 1, '3', 2)
    .reply_markup.inline_keyboard;
  assert.equal(rows[0][0].text, '＋ 1 Pack · GBP 34.99');
  assert.equal(rows[4][0].text, '🧺 Cart · 2');
  assert.equal(rows[4][1].callback_data, 'cart:removeProduct:7');
});

test('cart view includes variant, quantity controls, removal and total', () => {
  const cart = {
    items: [{
      id: 21,
      productId: 7,
      product: { name: 'Sample Product' },
      variant: { label: '2 Pack' },
      unitPrice: 59.99,
      quantity: 1,
    }],
  };

  const { text, keyboard } = buildCartView(cart);
  const rows = keyboard.reply_markup.inline_keyboard;
  assert.match(text, /Your Cart/);
  assert.match(text, /2 Pack × 1 — GBP 59\.99/);
  assert.equal(rows[1][1].callback_data, 'cart:dec:21');
  assert.equal(rows[1][3].callback_data, 'cart:inc:21');
  assert.equal(rows[1][4].callback_data, 'cart:remove:21');
});

test('shipping methods use the requested prices', () => {
  assert.deepEqual(checkoutScene.SHIPPING_METHODS.non_postage, {
    name: '⚠️ ONLY FOR NON POSTAGE ITEMS ⚠️',
    price: 10.00,
  });
  assert.deepEqual(checkoutScene.SHIPPING_METHODS.international, {
    name: '✈️ INTERNATIONAL SHIPPING ✈️',
    price: 39.99,
  });
});
