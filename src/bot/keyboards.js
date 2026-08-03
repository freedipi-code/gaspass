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

function catalogKeyboard(page, totalPages, categoryFilter, subcategories, activeSubcategoryId) {
  const rows = [];

  // Navigation row matching Image 4 design: [ ⇐ Back ] [ > ] [ 2 >> ]
  const navRow = [];
  
  // Back button (goes back to home/parent)
  navRow.push(Markup.button.callback('⇐ Back', 'home'));

  if (totalPages > 1) {
    if (page === 0) {
      navRow.push(Markup.button.callback('>', `catalog:page:${page + 1}:${categoryFilter || 'all'}`));
      navRow.push(Markup.button.callback(`${totalPages} >>`, `catalog:page:${totalPages - 1}:${categoryFilter || 'all'}`));
    } else if (page === totalPages - 1) {
      // replace back button or add it
      navRow.unshift(Markup.button.callback('<< 1', `catalog:page:0:${categoryFilter || 'all'}`));
      navRow.push(Markup.button.callback('<', `catalog:page:${page - 1}:${categoryFilter || 'all'}`));
    } else {
      // Middle page
      navRow.push(Markup.button.callback('<', `catalog:page:${page - 1}:${categoryFilter || 'all'}`));
      navRow.push(Markup.button.callback('>', `catalog:page:${page + 1}:${categoryFilter || 'all'}`));
    }
  }

  rows.push(navRow);

  // Subcategory filters below the navigation row (2 per row)
  if (subcategories && subcategories.length > 0) {
    const subcatButtons = subcategories.map((c) => {
      const isActive = String(c.id) === String(activeSubcategoryId);
      let label = c.name;
      // Shorten common terms to fit nicely
      label = label
        .replace(/Replica/gi, 'Rep')
        .replace(/Disposables/gi, 'Disposables')
        .replace(/Disposable/gi, 'Dispo')
        .replace(/Cartridges/gi, 'Carts')
        .replace(/Premium/gi, 'Prem');
      const activeLabel = isActive ? `✅ ${label}` : label;
      return Markup.button.callback(activeLabel, `catalog:cat:${c.id}`);
    });
    rows.push(...chunk(subcatButtons, 2));
  }

  return Markup.inlineKeyboard(rows);
}

// ── Product detail keyboard ──

function productDetailKeyboard(product, variants, productIndex, totalProducts, categoryFilter, cartHasProduct) {
  const rows = [];

  // Back / Previous / Next row matching Image 5: [ ⇐ Back ] [ < Previous ] [ Next > ]
  const navRow = [];
  navRow.push(Markup.button.callback('⇐ Back', `catalog:back:${categoryFilter || 'all'}`));
  if (productIndex > 0) {
    navRow.push(Markup.button.callback('< Previous', `prodNav:${productIndex - 1}:${categoryFilter || 'all'}`));
  }
  if (productIndex < totalProducts - 1) {
    navRow.push(Markup.button.callback('Next >', `prodNav:${productIndex + 1}:${categoryFilter || 'all'}`));
  }
  rows.push(navRow);

  // Variant price buttons (2 per row)
  if (variants && variants.length > 0) {
    const variantButtons = variants.map((v) =>
      Markup.button.callback(
        `(${v.label})—${formatPrice(v.price)}`,
        `addVar:${product.id}:${v.id}`
      )
    );
    rows.push(...chunk(variantButtons, 1)); // We can put them 1 per row for pricing tiers as seen in Image 5
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
