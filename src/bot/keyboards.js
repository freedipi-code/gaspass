const { Markup } = require('telegraf');
const shop = require('../shop.config');

function chunk(items, size) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function formatPrice(amount) {
  return `£${Number(amount || 0).toFixed(2)}`;
}

function formatProductCount(count) {
  return `${count} ${count === 1 ? 'product' : 'products'}`;
}

function cartLabel(summary = {}) {
  const quantity = Number(summary.quantity || 0);
  return `🛒 View Cart (${formatProductCount(quantity)}, ${formatPrice(summary.total)})`;
}

function homeMenu(summary) {
  return Markup.inlineKeyboard([
    [{ text: '🛍️ Browse Products', callback_data: 'browse', style: 'primary' }],
    [{ text: '🎫 Support Tickets', callback_data: 'support', style: 'success' }],
    [Markup.button.callback('📢 News Feed', 'news_feed')],
    [
      Markup.button.callback(`🌟 Reviews (${shop.reviewCount})`, 'reviews_home'),
      Markup.button.callback('📋 My Orders', 'orders'),
    ],
    [
      Markup.button.callback('📦 Track Order', 'orders'),
      Markup.button.callback('🤔 Help', 'help'),
    ],
    [Markup.button.callback(cartLabel(summary), 'cart')],
  ]);
}

function productDetailKeyboard(product, variants, selectedVariantId, summary, backCategoryId) {
  const rows = [];
  const variantButtons = (variants || []).map((variant) => {
    const selected = variant.id === selectedVariantId;
    return {
      text: `${selected ? '✓ ' : ''}${variant.label}`,
      callback_data: `selectVar:${product.id}:${variant.id}`,
      ...(selected ? { style: 'primary' } : {}),
    };
  });

  rows.push(...chunk(variantButtons, 3));

  const selected = (variants || []).find((variant) => variant.id === selectedVariantId);
  const price = selected?.price ?? product.price;
  rows.push([{
    text: `✅ Add to Cart - ${formatPrice(price)}`,
    callback_data: selected ? `addSelected:${product.id}` : `add:${product.id}`,
    style: 'success',
  }]);
  rows.push([Markup.button.callback(cartLabel(summary), 'cart')]);
  rows.push([
    Markup.button.callback('⬅️ Back to Category', `catalog:back:${backCategoryId || product.categoryId}`),
    Markup.button.callback('🛍️ Main Categories', 'browse'),
  ]);
  rows.push([{ text: '🏠 Main Menu', callback_data: 'home', style: 'primary' }]);

  return Markup.inlineKeyboard(rows);
}

const backHome = () => Markup.inlineKeyboard([
  [{ text: '🏠 Main Menu', callback_data: 'home', style: 'primary' }],
]);

module.exports = {
  backHome,
  cartLabel,
  chunk,
  formatPrice,
  formatProductCount,
  homeMenu,
  productDetailKeyboard,
};
