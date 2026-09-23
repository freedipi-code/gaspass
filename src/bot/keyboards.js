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

function cartLabel(summary) {
  const count = summary?.count || 0;
  const total = summary?.total || 0;
  return `🛒 View Cart (${count} product${count !== 1 ? 's' : ''}, ${formatPrice(total)})`;
}

function styledCallback(text, callbackData, style) {
  return { ...Markup.button.callback(text, callbackData), ...(style ? { style } : {}) };
}

function styledUrl(text, url, style) {
  return { ...Markup.button.url(text, url), ...(style ? { style } : {}) };
}

function externalLinkButton(text, url, fallbackAction) {
  return url
    ? styledUrl(`${text} ↗`, url)
    : Markup.button.callback(`${text} ↗`, fallbackAction);
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

function productListKeyboard(products, category, cartSummary = { count: 0, total: 0 }) {
  const rows = products.map((product) => [
    Markup.button.callback(
      `📦 ${product.name.toUpperCase()}`,
      `prod:${product.id}`,
    ),
  ]);

  rows.push([Markup.button.callback(cartLabel(cartSummary), 'cart')]);

  const upAction = category?.parentId ? `cat:view:${category.parentId}` : 'categories:root';
  rows.push([
    Markup.button.callback('⬅️ Up/Back', upAction),
    Markup.button.callback('🛍️ Main Categories', 'categories:root'),
  ]);
  rows.push([Markup.button.callback('🏠 Main Menu', 'home')]);

  return Markup.inlineKeyboard(rows);
}

// ── Product detail keyboard ──

function productDetailKeyboard(product, variants, productIndex, totalProducts, categoryFilter, cartHasProduct) {
  const rows = [];

  // Back / Next row
  const navRow = [];
  navRow.push(Markup.button.callback('⬅️ Back', `catalog:back:${categoryFilter || 'all'}`));
  if (productIndex >= 0 && productIndex < totalProducts - 1) {
    navRow.push(Markup.button.callback('Next >', `prodNav:${productIndex + 1}:${categoryFilter || 'all'}`));
  }
  rows.push(navRow);

  // Variant price buttons (2 per row)
  if (variants && variants.length > 0) {
    const variantButtons = variants.map((v) =>
      Markup.button.callback(
        `${v.label} — ${formatPrice(v.price)}`,
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

  rows.push([Markup.button.callback('🛒 View Cart', 'cart')]);
  rows.push([Markup.button.callback('🏠 Main Menu', 'home')]);

  return Markup.inlineKeyboard(rows);
}

// ── Home menu (simplified for storefront) ──

const homeMenu = (cartSummary = { count: 0, total: 0 }) => {
  const reviewsLabel = shop.reviewCount == null
    ? '🌟 Reviews'
    : `🌟 Reviews (${shop.reviewCount})`;

  const rows = [
    [styledCallback('🛍️ Browse Products', 'categories:root', 'primary')],
    [styledCallback('🎫 Support Tickets', 'support', 'success')],
    [
      shop.channelUrl
        ? Markup.button.url('📣 News Feed', shop.channelUrl)
        : Markup.button.callback('📣 News Feed', 'info'),
    ],
    [
      Markup.button.callback(reviewsLabel, 'reviews'),
      Markup.button.callback('📋 My Orders', 'orders'),
    ],
    [
      Markup.button.callback('🔐 PGP Key', 'pgp:key'),
      Markup.button.callback('📦 Track Order', 'orders'),
    ],
    [
      Markup.button.callback('🤔 Help', 'help:menu'),
      Markup.button.callback('🛡️ Security Mark', 'security:mark'),
    ],
    [Markup.button.callback('🎁 My Referrals', 'referrals')],
    [Markup.button.callback(cartLabel(cartSummary), 'cart')],
  ];

  rows.push([
    externalLinkButton(`👥 ${shop.groupLabel}`, shop.groupUrl, 'group'),
  ]);
  rows.push([
    externalLinkButton(`🔄 ${shop.backupBotLabel}`, shop.backupBotUrl, 'backup:bot'),
  ]);

  return Markup.inlineKeyboard(rows);
};

const backHome = () =>
  Markup.inlineKeyboard([[Markup.button.callback('⬅️ Home', 'home')]]);

function mainCategoriesKeyboard(categories, cartSummary = { count: 0, total: 0 }) {
  const rows = categories.map((category) => {
    const subCount = category._count?.children || 0;
    const productCount = category._count?.products || 0;
    const countText = subCount > 0
      ? `(${subCount} subcategories)`
      : `(${productCount} product${productCount !== 1 ? 's' : ''})`;
    return [
      Markup.button.callback(
        `💊 ${category.name.toUpperCase()} ${countText} 💊`,
        `cat:view:${category.id}`,
      ),
    ];
  });

  rows.push([Markup.button.callback(cartLabel(cartSummary), 'cart')]);
  rows.push([Markup.button.callback('🏠 Main Menu', 'home')]);
  return Markup.inlineKeyboard(rows);
}

function subCategoriesKeyboard(category, cartSummary = { count: 0, total: 0 }) {
  const rows = [];
  const children = category.children || [];

  if (children.length) {
    rows.push(...children.map((child) => {
      const productCount = child._count?.products || 0;
      return [
        Markup.button.callback(
          `💊 ${child.name.toUpperCase()} (${productCount} product${productCount !== 1 ? 's' : ''})💊`,
          `catalog:cat:${child.id}`,
        ),
      ];
    }));
  }

  const directCount = category._count?.products || 0;
  if (directCount > 0) {
    rows.push([
      Markup.button.callback(
        `💊 ${category.name.toUpperCase()} (${directCount} product${directCount !== 1 ? 's' : ''})💊`,
        `catalog:cat:${category.id}`,
      ),
    ]);
  }

  rows.push([Markup.button.callback(cartLabel(cartSummary), 'cart')]);
  rows.push([
    Markup.button.callback('⬅️ Main Categories', 'categories:root'),
    Markup.button.callback('🏠 Main Menu', 'home'),
  ]);

  return Markup.inlineKeyboard(rows);
}

module.exports = {
  homeMenu,
  backHome,
  catalogKeyboard,
  productListKeyboard,
  productDetailKeyboard,
  mainCategoriesKeyboard,
  subCategoriesKeyboard,
  starsVisual,
  formatPrice,
  chunk,
};
