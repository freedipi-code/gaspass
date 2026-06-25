const prisma = require('../../db/client');
const shop = require('../../shop.config');
const { resolveImage } = require('../../utils/image');
const { catalogKeyboard, starsVisual } = require('../keyboards');

const PRODUCTS_PER_PAGE = shop.productsPerPage || 5;

// Generate a short product link command like /p1, /p2 etc.
function productLink(index) {
  return `/p${index}`;
}

// Build the storefront catalog text for a given page of products
function buildCatalogText(products, page, totalPages, pageOffset) {
  const lines = [];

  // Welcome text only on first page
  if (page === 0) {
    lines.push(shop.welcomeText);
    lines.push('');
  }

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
    }
    if (badges.length) lines.push(badges.join(' '));

    // Product link
    lines.push(productLink(globalIndex));
    lines.push('');
  }

  // About link at the bottom of the last page
  if (page === totalPages - 1) {
    lines.push(`About: /info`);
  }

  return lines.join('\n');
}

// Fetch categories for the filter buttons
async function getRootCategories() {
  return prisma.category.findMany({
    orderBy: { id: 'asc' },
  });
}

// Fetch products with optional category filter
async function getFilteredProducts(categoryFilter) {
  const where = { active: true };
  if (categoryFilter && categoryFilter !== 'all') {
    where.categoryId = Number(categoryFilter);
  }
  return prisma.product.findMany({
    where,
    orderBy: [{ purchaseCount: 'desc' }, { rating: 'desc' }],
    include: { category: true },
  });
}

// Show the catalog page
async function showCatalog(ctx, page = 0, categoryFilter = 'all') {
  const allProducts = await getFilteredProducts(categoryFilter);
  const categories = await getRootCategories();

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffset = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = allProducts.slice(pageOffset, pageOffset + PRODUCTS_PER_PAGE);

  const text = buildCatalogText(pageProducts, safePage, totalPages, pageOffset);
  const keyboard = catalogKeyboard(safePage, totalPages, categories, categoryFilter);

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

  // First time: send welcome image + catalog text
  const photoSrc = resolveImage(shop.welcomeImage);
  if (photoSrc && page === 0) {
    try {
      await ctx.replyWithPhoto(photoSrc, {
        caption: text,
        ...opts,
      });
      return;
    } catch (_) {
      // Fallback to text-only
    }
  }
  await ctx.reply(text, opts);
}

// Handle /pN commands (product links from catalog)
function parseProductCommand(text) {
  const match = text.match(/^\/p(\d+)$/);
  return match ? Number(match[1]) : null;
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

module.exports = { register, showCatalog, getFilteredProducts, getRootCategories };
