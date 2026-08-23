const prisma = require('../../db/client');
const shop = require('../../shop.config');
const { catalogKeyboard } = require('../keyboards');
const { replyWithBrandImage } = require('../brand-message');

const PRODUCTS_PER_PAGE = shop.productsPerPage || 5;

// Logical groupings of flat DB categories into menu groups
const CATEGORY_GROUPS = {
  cannabis_tiers: {
    emoji: '🌲',
    label: 'CANNABIS TIERS (FLOWER)',
    categories: ["93 High Octane", "91 Supreme", "Budget", "Value", "Premium", "Exotic", "Packaged 8ths", "Mix n Match", "Bulk", "Samplers"]
  },
  concentrates: {
    emoji: '🍯',
    label: 'CONCENTRATES',
    categories: ["Concentrates", "Rosin"]
  },
  vapes: {
    emoji: '🥤',
    label: 'VAPES',
    categories: ["Cartridges", "Disposables"]
  },
  edibles: {
    emoji: '🍬',
    label: 'EDIBLES',
    categories: ["Edibles"]
  },
  prerolls: {
    emoji: '🥶',
    label: 'PREROLLS',
    categories: ["PreRolls"]
  },
};

// Find which group a category name belongs to
function findGroupForCategory(categoryName) {
  for (const [slug, group] of Object.entries(CATEGORY_GROUPS)) {
    if (group.categories.some(n => n.toLowerCase() === categoryName.toLowerCase())) {
      return slug;
    }
  }
  return null;
}

// Get the DB categories that belong to a group slug
async function getGroupCategories(groupSlug) {
  const group = CATEGORY_GROUPS[groupSlug];
  if (!group) return [];
  return prisma.category.findMany({
    where: { name: { in: group.categories } },
    orderBy: { id: 'asc' }
  });
}

// Generate a short product link command like /p1, /p2 etc.
function productLink(index) {
  return `/p${index}`;
}

// Generate category slug from name
function categorySlug(categoryName) {
  const mappings = {
    '3g replica disposables': '3g_rep_disposable',
    '2g replica disposables': '2g_rep_disposable',
    '1g replica disposables': '1g_rep_disposable',
    'authentic disposables': 'authentic_dispo',
    'carts': 'carts',
    'cartridges': 'carts',
    'edibles': 'edibles',
    'clearance rack': 'clearance_rack',
  };
  const lower = categoryName.toLowerCase().trim();
  if (mappings[lower]) return mappings[lower];
  
  return lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Helpers for category visual styling and deep link hashes
function getCategoryHeader(categoryFilter) {
  const headers = {
    'cannabis_tiers': '🌲 DIFFERENT TYPES OF FLOWER\n🌲',
    'concentrates': '🍯 DIFFERENT TYPES OF CONCENTRATES\n🍯',
    'vapes': '🥤 DIFFERENT TYPES OF VAPES\n🥤',
    'edibles': '🍬 DIFFERENT TYPES OF EDIBLES\n🍬',
    'prerolls': '🥶 DIFFERENT TYPES OF PREROLLS\n🥶',
    'other_product': '🧙 DIFFERENT TYPES OF PRODUCTS\n🧙',
    'new_products': '🙏 NEW PRODUCTS 🙏',
    'all': '🛍️ PRODUCT CATALOG 🛍️'
  };
  const cleanFilter = String(categoryFilter).toLowerCase().trim();
  if (headers[cleanFilter]) return headers[cleanFilter];

  const displayName = cleanFilter
    .replace(/_/g, ' ')
    .toUpperCase();
  const emoji = getCategoryEmoji(cleanFilter);
  return `${emoji} DIFFERENT TYPES OF ${displayName}\n${emoji}`;
}

function getCategoryHash(slug) {
  const mappings = {
    'cannabis_tiers': 'c5t1',
    'concentrates': 'c2y8',
    'vapes': 'xsr6',
    'edibles': 'ed7b',
    'prerolls': 'pr4w',
    'other_product': 'ot9p',
    'new_products': 'new1',
  };
  return mappings[slug] || slug;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build the storefront catalog text for a given page of products.
// `headerText` lets the first page use the shop's welcome sentence while
// keeping exactly the same product list and links as the regular catalog.
function buildCatalogText(products, page, totalPages, pageOffset, categoryFilter, headerText = null) {
  const lines = [];

  // Prepend the category header
  lines.push(headerText ? escapeHtml(headerText) : getCategoryHeader(categoryFilter));
  lines.push('');

  // Product listings
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const globalIndex = pageOffset + i;

    // Escape name for HTML
    const nameSafe = escapeHtml(p.name.toUpperCase());

    lines.push(`<b>${nameSafe}</b>`);

    // Short description in italic, truncated
    if (p.description) {
      const desc = p.description.length > 60
        ? p.description.substring(0, 60) + '...'
        : p.description;
      const descSafe = escapeHtml(desc);
      lines.push(`<i>${descSafe}</i>`);
    }

    // Rating / purchases line (plain text, no bold/italic around star rating)
    const ratingVal = p.rating > 0 ? p.rating : 9.8;
    const purchasesVal = p.purchaseCount > 0 ? p.purchaseCount : 750;
    
    // Format rating value: if integer, show without decimal, else with toFixed(1)
    const ratingStr = ratingVal % 1 === 0 ? String(ratingVal) : ratingVal.toFixed(1);
    
    lines.push(`⭐ ${ratingStr} (${purchasesVal} purchases)`);

    // Product link with category hash suffix
    const hash = getCategoryHash(categoryFilter);
    lines.push(`/p${globalIndex}_${hash}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildCompactCatalogText(products, pageOffset, categoryFilter, headerText) {
  const lines = [escapeHtml(headerText), ''];
  const hash = getCategoryHash(categoryFilter);

  products.forEach((product, index) => {
    const shortName = product.name.length > 100
      ? `${product.name.substring(0, 100)}...`
      : product.name;
    lines.push(`<b>${escapeHtml(shortName.toUpperCase())}</b>`);
    lines.push(`/p${pageOffset + index}_${hash}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Fetch categories for the filter buttons
async function getRootCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { id: 'asc' },
  });
}

// Fetch products with optional category filter (including its subcategories)
async function getFilteredProducts(categoryFilter) {
  const where = { active: true };
  
  if (categoryFilter && categoryFilter !== 'all') {
    if (categoryFilter === 'new_products') {
      where.isNew = true;
    } else {
      let categoryNames = [];
      if (categoryFilter === 'cannabis_tiers') {
        categoryNames = ["93 High Octane", "91 Supreme", "Budget", "Value", "Premium", "Exotic", "Packaged 8ths", "Mix n Match", "Bulk", "Samplers"];
      } else if (categoryFilter === 'concentrates') {
        categoryNames = ["Concentrates", "Rosin"];
      } else if (categoryFilter === 'vapes') {
        categoryNames = ["Cartridges", "Disposables"];
      } else if (categoryFilter === 'edibles') {
        categoryNames = ["Edibles"];
      } else if (categoryFilter === 'prerolls') {
        categoryNames = ["PreRolls"];
      } else if (categoryFilter === 'other_product') {
        const allKnown = [
          "93 High Octane", "91 Supreme", "Budget", "Value", "Premium", "Exotic", "Packaged 8ths", "Mix n Match", "Bulk", "Samplers",
          "Concentrates", "Rosin",
          "Cartridges", "Disposables",
          "Edibles",
          "PreRolls"
        ];
        const otherCats = await prisma.category.findMany({
          where: {
            NOT: {
              name: { in: allKnown }
            }
          },
          select: { id: true }
        });
        where.categoryId = { in: otherCats.map(c => c.id) };
      } else if (!isNaN(categoryFilter)) {
        // Fallback for numeric IDs
        const catId = Number(categoryFilter);
        const subcats = await prisma.category.findMany({
          where: { parentId: catId },
          select: { id: true }
        });
        if (subcats.length > 0) {
          where.categoryId = { in: [catId, ...subcats.map(s => s.id)] };
        } else {
          where.categoryId = catId;
        }
      } else {
        // Find category whose name matches or whose generated slug matches
        const allCats = await prisma.category.findMany();
        const matchedCat = allCats.find(c => 
          c.name.toLowerCase() === categoryFilter.toLowerCase() || 
          categorySlug(c.name) === categoryFilter.toLowerCase()
        );
        if (matchedCat) {
          const subcats = await prisma.category.findMany({
            where: { parentId: matchedCat.id },
            select: { id: true }
          });
          where.categoryId = { in: [matchedCat.id, ...subcats.map(s => s.id)] };
        } else {
          where.categoryId = -1; // returns empty list
        }
      }
      
      if (categoryNames.length > 0) {
        const cats = await prisma.category.findMany({
          where: {
            name: { in: categoryNames }
          },
          select: { id: true }
        });
        where.categoryId = { in: cats.map(c => c.id) };
      }
    }
  }
  
  return prisma.product.findMany({
    where,
    orderBy: [{ purchaseCount: 'desc' }, { rating: 'desc' }],
    include: { category: true },
  });
}

function getCategoryEmoji(name) {
  const lower = name.toLowerCase();
  if (lower.includes('flower') || lower.includes('cannabis') || lower.includes('weed') || lower.includes('riz')) return '🌾';
  if (lower.includes('concentrate') || lower.includes('rosin') || lower.includes('wax') || lower.includes('hash')) return '🍯';
  if (lower.includes('vape') || lower.includes('cartridge') || lower.includes('disposable') || lower.includes('cart')) return '🥤';
  if (lower.includes('edible') || lower.includes('gummy') || lower.includes('candy')) return '🍬';
  if (lower.includes('preroll') || lower.includes('joint')) return '🥶';
  return '📦';
}

// Show the welcome image and immediately list the first products below it.
async function showHome(ctx) {
  const allProducts = await getFilteredProducts('all');
  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const pageProducts = allProducts.slice(0, PRODUCTS_PER_PAGE);
  let caption = pageProducts.length > 0
    ? buildCatalogText(pageProducts, 0, totalPages, 0, 'all', shop.welcomeText)
    : `${escapeHtml(shop.welcomeText)}\n\nNo products available right now.`;

  // Telegram limits photo captions to 1,024 characters. Keep every product
  // link visible and fall back to a compact list instead of cutting HTML.
  if (caption.length > 1024) {
    caption = buildCompactCatalogText(pageProducts, 0, 'all', shop.welcomeText);
  }

  const keyboard = catalogKeyboard(0, totalPages, 'all', [], null);

  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = allProducts.map((product) => product.id);
  ctx.session.catalogCategory = 'all';
  ctx.session.catalogPage = 0;

  await replyWithBrandImage(ctx, caption, { parse_mode: 'HTML', ...keyboard });
}

// Show the catalog page
async function showCatalog(ctx, page = 0, categoryFilter = 'all') {
  const allProducts = await getFilteredProducts(categoryFilter);

  // Determine subcategories to show under pagination row
  let subcategories = [];
  let activeSubcategoryId = null;
  let activeCategory = null;

  if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'new_products') {
    if (CATEGORY_GROUPS[categoryFilter]) {
      subcategories = await getGroupCategories(categoryFilter);
    } else {
      let targetCat = null;
      if (!isNaN(categoryFilter)) {
        targetCat = await prisma.category.findUnique({
          where: { id: Number(categoryFilter) }
        });
      } else {
        const allCats = await prisma.category.findMany();
        targetCat = allCats.find(c => 
          c.name.toLowerCase() === categoryFilter.toLowerCase() || 
          categorySlug(c.name) === categoryFilter.toLowerCase()
        );
      }

      if (targetCat) {
        activeSubcategoryId = targetCat.id;
        if (targetCat.parentId) {
          subcategories = await prisma.category.findMany({
            where: { parentId: targetCat.parentId },
            orderBy: { id: 'asc' }
          });
        } else {
          subcategories = await prisma.category.findMany({
            where: { parentId: targetCat.id },
            orderBy: { id: 'asc' }
          });
          if (subcategories.length === 0) {
            const groupSlug = findGroupForCategory(targetCat.name);
            if (groupSlug) {
              subcategories = await getGroupCategories(groupSlug);
            }
          }
        }
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffset = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = allProducts.slice(pageOffset, pageOffset + PRODUCTS_PER_PAGE);

  const text = buildCatalogText(pageProducts, safePage, totalPages, pageOffset, categoryFilter);
  const keyboard = catalogKeyboard(safePage, totalPages, categoryFilter, subcategories, activeSubcategoryId);

  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...keyboard,
  };

  // Store catalog state in session for product navigation
  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = allProducts.map((p) => p.id);
  ctx.session.catalogCategory = categoryFilter;
  ctx.session.catalogPage = safePage;

  await replyWithBrandImage(ctx, text, opts);
}

function register(bot) {
  // Catalog page navigation
  bot.action(/^catalog:page:(\d+):(.+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const catFilter = ctx.match[2];
    return showCatalog(ctx, page, catFilter);
  });

  // Category filter
  bot.action(/^catalog:cat:(.+)$/, async (ctx) => {
    const catFilter = ctx.match[1];
    return showCatalog(ctx, 0, catFilter);
  });

  // Back to catalog from product detail
  bot.action(/^catalog:back:(.+)$/, async (ctx) => {
    const catFilter = ctx.match[1];
    const page = ctx.session?.catalogPage || 0;
    return showCatalog(ctx, page, catFilter);
  });

  // Specific Cart Sale product link
  bot.hears('/p_02d9aHVwMp8nDYTYYMzXgE', async (ctx) => {
    const products = await getFilteredProducts('vapes');
    if (!products || products.length === 0) {
      return ctx.reply('Product not found.');
    }
    const product = products[0]; // Seeded flash sale cartridge

    ctx.session = ctx.session || {};
    ctx.session.catalogProducts = products.map(p => p.id);
    ctx.session.catalogCategory = 'vapes';
    ctx.session.catalogPage = 0;

    ctx.match = ['', String(product.id)];
    ctx.state.productIndex = 0;
    ctx.state.fromCatalog = true;
    const productsHandler = require('./products');
    return productsHandler.showProductDetail(ctx);
  });

  // Category deep links command handlers
  bot.hears(/^\/v_(?:pp|qtetra)_(.+)$/, async (ctx) => {
    const slug = ctx.match[1].toLowerCase().trim();

    // Check special links first
    if (slug === 'create_custom_order') {
      return replyWithBrandImage(ctx, '📝 *Custom Order*\n\nTo place a custom order, please message support or use /support.', { parse_mode: 'Markdown' });
    }
    if (slug === 'clearance_rack' || slug === 'clear_rack') {
      const cats = await prisma.category.findMany();
      const clearanceCat = cats.find(c => c.name.toLowerCase().includes('clearance') || categorySlug(c.name).includes('clearance'));
      if (clearanceCat) {
        return showCatalog(ctx, 0, String(clearanceCat.id));
      }
      return replyWithBrandImage(ctx, '🏷️ *Clearance Rack*\n\nNo clearance products available right now. Check back later!', { parse_mode: 'Markdown' });
    }
    if (slug === 'refunds') {
      return replyWithBrandImage(ctx, `↩️ *Refund Policy*\n\n${shop.information}`, { parse_mode: 'Markdown' });
    }
    if (slug === 'shipping') {
      return replyWithBrandImage(ctx, `📦 *Shipping FAQs*\n\n${shop.information}`, { parse_mode: 'Markdown' });
    }
    if (slug === 'new_products') {
      return showCatalog(ctx, 0, 'new_products');
    }
    if (slug === 'review_bonus') {
      const reviewBonusText = [
        `❤️ *REVIEW BOUNS: 5g CONCY for free!* ❤️`,
        ``,
        `To claim your free 5g Concentrates review bonus:`,
        `1. Write a review for any of our products after purchase.`,
        `2. Take a screenshot of the review.`,
        `3. Send it to support via the /support command or Support button.`,
        ``,
        `Thanks for spreading the word! 🌟`
      ].join('\n');
      return replyWithBrandImage(ctx, reviewBonusText, { parse_mode: 'Markdown' });
    }

    // Otherwise find category by slug/name
    return showCatalog(ctx, 0, slug);
  });

  // /pN command handler (deep link to product from catalog text)
  bot.hears(/^\/p(\d+)(?:_(.+))?$/, async (ctx) => {
    const index = Number(ctx.match[1]);
    const hash = ctx.match[2];

    let categoryFilter = 'all';
    if (hash) {
      const hashMappings = {
        'c5t1': 'cannabis_tiers',
        'c2y8': 'concentrates',
        'xsr6': 'vapes',
        'ed7b': 'edibles',
        'pr4w': 'prerolls',
        'ot9p': 'other_product',
        'new1': 'new_products',
      };
      categoryFilter = hashMappings[hash] || hash;
    } else {
      categoryFilter = ctx.session?.catalogCategory || 'all';
    }

    const products = await getFilteredProducts(categoryFilter);
    if (!products || index >= products.length) {
      return ctx.reply('Product not found. Send /start to see the catalog.');
    }
    const product = products[index];

    ctx.session = ctx.session || {};
    ctx.session.catalogProducts = products.map(p => p.id);
    ctx.session.catalogCategory = categoryFilter;
    ctx.session.catalogPage = Math.floor(index / PRODUCTS_PER_PAGE);

    // Delegate to product detail handler
    ctx.match = ['', String(product.id)];
    ctx.state.productIndex = index;
    ctx.state.fromCatalog = true;
    const productsHandler = require('./products');
    return productsHandler.showProductDetail(ctx);
  });
}

module.exports = { register, showHome, showCatalog, getFilteredProducts, getRootCategories };
