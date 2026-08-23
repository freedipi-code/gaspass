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
  return `GBP ${Number(amount).toFixed(2)}`;
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

  // Category filter buttons (2 per row)
  const catButtons = categories.map((c) => {
    const isActive = categoryFilter === String(c.id);
    const label = isActive ? `• ${c.name} •` : c.name;
    return Markup.button.callback(label, `catalog:cat:${c.id}`);
  });
  // Add "All" button
  const allLabel = (!categoryFilter || categoryFilter === 'all') ? '• All •' : 'All';
  catButtons.unshift(Markup.button.callback(allLabel, 'catalog:cat:all'));
  rows.push(...chunk(catButtons, 2));

  return Markup.inlineKeyboard(rows);
}

// ── Product detail keyboard ──

function productDetailKeyboard(product, variants, productIndex, totalProducts, categoryFilter, inCartQuantity = 0) {
  const rows = [];

  // Variant price buttons (stacked vertically, 1 per row)
  if (variants && variants.length > 0) {
    for (const v of variants) {
      rows.push([
        {
          text: `＋ ${v.label} · ${formatPrice(v.price)}`,
          callback_data: `addVar:${product.id}:${v.id}`,
          style: 'success',
        }
      ]);
    }
  } else {
    // Fallback: single "Add to cart" button
    rows.push([
      {
        text: `＋ Add to cart · ${formatPrice(product.price)}`,
        callback_data: `add:${product.id}`,
        style: 'success',
      }
    ]);
  }

  rows.push([
    Markup.button.callback('➕ Choose a quantity', `chooseQty:${product.id}`)
  ]);

  // Wishlist
  rows.push([
    Markup.button.callback('💜 Save To Wishlist', 'wishlist')
  ]);

  // Cart
  if (inCartQuantity > 0) {
    rows.push([
      { text: `🧺 Cart · ${inCartQuantity}`, callback_data: 'cart', style: 'success' },
      { text: '×', callback_data: `cart:removeProduct:${product.id}`, style: 'danger' },
    ]);
  } else {
    rows.push([{ text: '🧺 Cart', callback_data: 'cart', style: 'success' }]);
  }

  // Back / Home buttons (stacked vertically, 1 per row, red color)
  rows.push([{ text: '← Back', callback_data: `catalog:back:${categoryFilter || 'all'}`, style: 'danger' }]);
  rows.push([{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]);

  return Markup.inlineKeyboard(rows);
}

// ── Home menu (simplified for storefront) ──

const homeMenu = () => {
  const rows = [
    [{ text: '🛍️ Browse', callback_data: 'browse', style: 'success' }],
    [Markup.button.callback('⭐ Featured', 'featured')],
    [Markup.button.callback('🧺 Cart', 'cart')],
    [Markup.button.callback('🔍 Search', 'search')],
    [
      Markup.button.callback('👤 My Profile', 'profile'),
      Markup.button.callback('📝 Reviews', 'reviews_home'),
    ],
    [
      Markup.button.callback('🎫 Support', 'support'),
      Markup.button.callback('❓ FAQ', 'faq'),
    ],
    [{ text: '🧅 Tor', callback_data: 'tor', style: 'primary' }],
    [Markup.button.callback('🔐 Set Verification Phrase', 'set_verification')],
  ];

  return Markup.inlineKeyboard(rows);
};

const backHome = () =>
  Markup.inlineKeyboard([
    [{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]
  ]);

module.exports = {
  homeMenu,
  backHome,
  catalogKeyboard,
  productDetailKeyboard,
  starsVisual,
  formatPrice,
  chunk,
};
