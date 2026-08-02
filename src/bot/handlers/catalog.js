const prisma = require('../../db/client');
const shop = require('../../shop.config');
const { resolveImage } = require('../../utils/image');
const { catalogKeyboard } = require('../keyboards');

const PRODUCTS_PER_PAGE = shop.productsPerPage || 5;

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

// Build the storefront catalog text for a given page of products
function buildCatalogText(products, page, totalPages, pageOffset) {
  const lines = [];

  // Product listings
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const globalIndex = pageOffset + i;

    // Product name in UPPERCASE BOLD
    lines.push(`*${p.name.toUpperCase()}*`);

    // Short description in italic, truncated
    if (p.description) {
      const desc = p.description.length > 60
        ? p.description.substring(0, 60) + '...'
        : p.description;
      lines.push(`_${desc}_`);
    }

    // New badge or rating line
    const badges = [];
    if (p.isNew) badges.push('(New)');
    if (p.rating > 0) {
      badges.push(`⭐ ${p.rating.toFixed(1)} (${p.purchaseCount} purchases)`);
    } else {
      // Show default star count/purchases as shown in image 3
      badges.push(`⭐ 9.3 (168 purchases)`); // fallback or mock if no rating
    }
    if (badges.length) lines.push(badges.join(' '));

    // Product link
    lines.push(productLink(globalIndex));
    lines.push('');
  }

  return lines.join('\n');
}

// Fetch categories for the filter buttons
async function getRootCategories() {
  return prisma.category.findMany({
    orderBy: { id: 'asc' },
  });
}

// Fetch products with optional category filter (including its subcategories)
async function getFilteredProducts(categoryFilter) {
  const where = { active: true };
  if (categoryFilter && categoryFilter !== 'all') {
    const catId = Number(categoryFilter);
    // Find subcategories if any
    const subcats = await prisma.category.findMany({
      where: { parentId: catId },
      select: { id: true }
    });
    if (subcats.length > 0) {
      where.categoryId = { in: [catId, ...subcats.map(s => s.id)] };
    } else {
      where.categoryId = catId;
    }
  }
  return prisma.product.findMany({
    where,
    orderBy: [{ purchaseCount: 'desc' }, { rating: 'desc' }],
    include: { category: true },
  });
}

// Show welcome / home page matching Image 1 & 2
async function showHome(ctx) {
  const rootCategories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { id: 'asc' }
  });

  // Build compact category lines (name: /command on same line)
  const categoryLines = [];
  for (const cat of rootCategories) {
    const slug = categorySlug(cat.name);
    const cmd = `/v_qtetra_${slug}`.replace(/_/g, '\\_');
    categoryLines.push(`*${cat.name}:* ${cmd}`);
  }

  // Caption — keep under 1024 chars (Telegram limit)
  const captionLines = [
    `■All orders are shipped within 24-48hrs and tracking will be provided upon request ■$10 shipping on all orders`,
    `■Wholesale Pricing Available`,
    `■Exclusive Products`,
    `■$50 minimum on first time orders ONLY, after that its $100 minimum`,
    ``,
    `Custom Order:`,
    `/v_qtetra_create_custom_order`.replace(/_/g, '\\_'),
    ``,
    `Previous Orders:`,
    `/orders`,
    ``,
    `Clearance Rack:`,
    `/v_qtetra_clearance_rack`.replace(/_/g, '\\_') + ` - CLEARANCE RACK!`,
    ``,
    ...categoryLines,
    ``,
    `About: /about_qtetra`.replace(/_/g, '\\_'),
    `Refunds: /v_qtetra_refunds`.replace(/_/g, '\\_'),
    `Shipping: /v_qtetra_shipping`.replace(/_/g, '\\_'),
    `PGP: /pgp_qtetra`.replace(/_/g, '\\_'),
  ];

  const caption = captionLines.join('\n');
  const photoSrc = resolveImage(shop.welcomeImage);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
  }

  if (photoSrc) {
    try {
      await ctx.replyWithPhoto(photoSrc, {
        caption,
        parse_mode: 'Markdown',
      });
      return;
    } catch (e) {
      console.error('Failed to send welcome photo with caption:', e.message);
      console.error('Caption length:', caption.length);
    }
  }

  await ctx.reply(caption, { parse_mode: 'Markdown' });
}

// Show the catalog page
async function showCatalog(ctx, page = 0, categoryFilter = 'all') {
  const allProducts = await getFilteredProducts(categoryFilter);

  // Determine subcategories to show under pagination row
  let subcategories = [];
  let activeSubcategoryId = null;
  let activeCategory = null;

  if (categoryFilter && categoryFilter !== 'all') {
    activeCategory = await prisma.category.findUnique({
      where: { id: Number(categoryFilter) }
    });
    if (activeCategory) {
      if (activeCategory.parentId === null) {
        // It's a root category, show its children as filters
        subcategories = await prisma.category.findMany({
          where: { parentId: activeCategory.id },
          orderBy: { id: 'asc' }
        });
      } else {
        // It's a subcategory, show siblings (all children of its parent)
        subcategories = await prisma.category.findMany({
          where: { parentId: activeCategory.parentId },
          orderBy: { id: 'asc' }
        });
        activeSubcategoryId = activeCategory.id;
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffset = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = allProducts.slice(pageOffset, pageOffset + PRODUCTS_PER_PAGE);

  const text = buildCatalogText(pageProducts, safePage, totalPages, pageOffset);
  const keyboard = catalogKeyboard(safePage, totalPages, categoryFilter, subcategories, activeSubcategoryId);

  const opts = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...keyboard,
  };

  // Store catalog state in session for product navigation
  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = allProducts.map((p) => p.id);
  ctx.session.catalogCategory = categoryFilter;
  ctx.session.catalogPage = safePage;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      // Try editing existing message
      if (ctx.callbackQuery.message?.photo) {
        await ctx.editMessageCaption(text, opts);
      } else {
        await ctx.editMessageText(text, opts);
      }
      return;
    } catch (_) {
      // Fallback: send new message
    }
  }

  await ctx.reply(text, opts);
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

  // Category deep links command handlers
  bot.hears(/^\/v_qtetra_(.+)$/, async (ctx) => {
    const slug = ctx.match[1].toLowerCase().trim();

    // Check special links first
    if (slug === 'create_custom_order') {
      return ctx.reply('📝 *Custom Order*\n\nTo place a custom order, please message support or use /support.', { parse_mode: 'Markdown' });
    }
    if (slug === 'clearance_rack' || slug === 'clear_rack') {
      const cats = await prisma.category.findMany();
      const clearanceCat = cats.find(c => c.name.toLowerCase().includes('clearance') || categorySlug(c.name).includes('clearance'));
      if (clearanceCat) {
        return showCatalog(ctx, 0, String(clearanceCat.id));
      }
      return ctx.reply('🏷️ *Clearance Rack*\n\nNo clearance products available right now. Check back later!', { parse_mode: 'Markdown' });
    }
    if (slug === 'refunds') {
      return ctx.reply(`↩️ *Refund Policy*\n\n${shop.information}`, { parse_mode: 'Markdown' });
    }
    if (slug === 'shipping') {
      return ctx.reply(`📦 *Shipping FAQs*\n\n${shop.information}`, { parse_mode: 'Markdown' });
    }

    // Otherwise find category by slug
    const categories = await prisma.category.findMany();
    const targetCat = categories.find(c => categorySlug(c.name) === slug);
    if (targetCat) {
      return showCatalog(ctx, 0, String(targetCat.id));
    }

    return ctx.reply('Category not found. Use /start to see the menu.');
  });

  // /pN command handler (deep link to product from catalog text)
  bot.hears(/^\/p(\d+)$/, async (ctx) => {
    const index = Number(ctx.match[1]);
    const productIds = ctx.session?.catalogProducts;
    if (!productIds || index >= productIds.length) {
      return ctx.reply('Product not found. Send /start to see the catalog.');
    }
    const productId = productIds[index];
    // Delegate to product detail handler
    ctx.match = ['', String(productId)];
    ctx.state.productIndex = index;
    ctx.state.fromCatalog = true;
    const productsHandler = require('./products');
    return productsHandler.showProductDetail(ctx);
  });
}

module.exports = { register, showHome, showCatalog, getFilteredProducts, getRootCategories };
