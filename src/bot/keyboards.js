const { Markup } = require('telegraf');
const shop = require('../shop.config');

// ── Helpers ──

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function starsVisual(rating) {
  const full = Math.floor(rating / 2);
  const half = (rating % 2) >= 1 ? 1 : 0;
  const empty = 5 - full - half;
  return '⭐'.repeat(full) + (half ? '⭐' : '') + '☆'.repeat(empty);
}

function formatPrice(amount) {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  if (cents === 0) {
    return `${shop.currency}${dollars}⁰⁰`;
  }
  const centsStr = String(cents).padStart(2, '0');
  return `${shop.currency}${dollars}.${centsStr}`;
}

// ── Catalog keyboard (for /start storefront) ──

function catalogKeyboard(page, totalPages, categories, categoryFilter) {
  const rows = [];

  // Navigation row
  if (totalPages > 1) {
    const navRow = [];
    
    // Previous button
    if (page > 0) {
      navRow.push(Markup.button.callback('◀️', `catalog:page:${page - 1}:${categoryFilter || 'all'}`));
    } else {
      navRow.push(Markup.button.callback('⏹', `catalog:page:${page}:${categoryFilter || 'all'}`));
    }
    
    // Current page indicator
    navRow.push(Markup.button.callback(`📄 Page ${page + 1} / ${totalPages}`, `catalog:page:${page}:${categoryFilter || 'all'}`));
    
    // Next button
    if (page < totalPages - 1) {
      navRow.push(Markup.button.callback('▶️', `catalog:page:${page + 1}:${categoryFilter || 'all'}`));
    } else {
      navRow.push(Markup.button.callback('⏹', `catalog:page:${page}:${categoryFilter || 'all'}`));
    }
    
    rows.push(navRow);
  }

  // Back to home button
  rows.push([Markup.button.callback('⇌ Back', 'home')]);

  // Category filter buttons (2 per row)
  const catButtons = categories.map((c) => {
    const isActive = categoryFilter === String(c.id);
    const label = isActive ? `✅ ${c.name}` : c.name;
    return Markup.button.callback(label, `catalog:cat:${c.id}`);
  });
  // Add "All" button
  const allLabel = (!categoryFilter || categoryFilter === 'all') ? '✅ All' : 'All';
  catButtons.unshift(Markup.button.callback(allLabel, 'catalog:cat:all'));
  rows.push(...chunk(catButtons, 2));

  return Markup.inlineKeyboard(rows);
}

// ── Product detail keyboard ──

function productDetailKeyboard(product, variants, productIndex, totalProducts, categoryFilter, cartHasProduct) {
  const rows = [];

  // Back / Next row
  const navRow = [];
  navRow.push(Markup.button.callback('⇐ Back', `catalog:back:${categoryFilter || 'all'}`));
  if (productIndex < totalProducts - 1) {
    navRow.push(Markup.button.callback('Next >', `prodNav:${productIndex + 1}:${categoryFilter || 'all'}`));
  }
  rows.push(navRow);

  // Variant price buttons (2 per row)
  if (variants && variants.length > 0) {
    const variantButtons = variants.map((v) =>
      Markup.button.callback(
        `${v.label}—${formatPrice(v.price)}`,
        `addVar:${product.id}:${v.id}`
      )
    );
    rows.push(...chunk(variantButtons, 2));
  } else {
    // Fallback: single "Add to cart" button
    rows.push([
      Markup.button.callback(
        `Add to cart — ${formatPrice(product.price)}`,
        `add:${product.id}`
      ),
    ]);
  }

  // Reviews button
  const reviewCount = product._count?.reviews || product.reviewCount || 0;
  rows.push([
    Markup.button.callback(
      `${reviewCount} review${reviewCount !== 1 ? 's' : ''}`,
      `reviews:${product.id}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ── Home menu (simplified for storefront) ──

const homeMenu = () => {
  const rows = [
    [
      Markup.button.callback('🛍️ Browse Shop', 'shop'),
      Markup.button.callback('🛒 View Cart', 'cart'),
    ],
    [
      Markup.button.callback('📜 Orders', 'orders'),
      Markup.button.callback('ℹ️ Information', 'info'),
    ],
    [Markup.button.callback('🎫 Support', 'support')],
  ];

  if (shop.channelUrl) {
    rows.push([Markup.button.url('📢 ' + shop.channelLabel, shop.channelUrl)]);
  }

  return Markup.inlineKeyboard(rows);
};

const backHome = () =>
  Markup.inlineKeyboard([[Markup.button.callback('⬅️ Home', 'home')]]);

module.exports = {
  homeMenu,
  backHome,
  catalogKeyboard,
  productDetailKeyboard,
  starsVisual,
  formatPrice,
  chunk,
};
