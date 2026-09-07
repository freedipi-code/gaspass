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

function categoryDecoration(categoryName) {
  const name = String(categoryName || 'Category');
  const lower = name.toLowerCase();
  let emoji = '🌸';

  if (/light|indoor/.test(lower)) emoji = '🌸';
  else if (/exotic/.test(lower)) emoji = '🌹';
  else if (/small/.test(lower)) emoji = '🪷';
  else if (/concentrate|extract/.test(lower)) emoji = '🍯';
  else if (/disposable|vape|cart/.test(lower)) emoji = '🖊️';
  else if (/edible/.test(lower)) emoji = '🍫';
  else if (/metrc/.test(lower)) emoji = '⚖️';
  else if (/preroll|pre-roll/.test(lower)) emoji = '🌿';

  return `${name} ${emoji}`;
}

// ── Catalog keyboard (for /start storefront) ──

function catalogKeyboard(page, totalPages, categoryFilter, categories, activeCategoryId) {
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
      navRow.push(Markup.button.callback('<', `catalog:page:${page - 1}:${categoryFilter || 'all'}`));
      navRow.push(Markup.button.callback('1 <<', `catalog:page:0:${categoryFilter || 'all'}`));
    } else {
      // Middle page
      navRow.push(Markup.button.callback('<', `catalog:page:${page - 1}:${categoryFilter || 'all'}`));
      navRow.push(Markup.button.callback('>', `catalog:page:${page + 1}:${categoryFilter || 'all'}`));
    }
  }

  rows.push(navRow);

  // Every category stored in the database is immediately visible, like the
  // reference storefront.
  if (categories && categories.length > 0) {
    const categoryButtons = categories.map((c) => {
      const isActive = String(c.id) === String(activeCategoryId);
      const decoratedLabel = categoryDecoration(c.name);
      const activeLabel = isActive ? `✅ ${decoratedLabel}` : decoratedLabel;
      return Markup.button.callback(activeLabel, `catalog:cat:${c.id}`);
    });

    // Broad buttons like the reference, with only the final pair sharing a row.
    if (categoryButtons.length > 2) {
      rows.push(...categoryButtons.slice(0, -2).map((button) => [button]));
      rows.push(categoryButtons.slice(-2));
    } else {
      rows.push(categoryButtons);
    }
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
