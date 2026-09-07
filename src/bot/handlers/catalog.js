const prisma = require('../../db/client');
const shop = require('../../shop.config');
const { resolveImage } = require('../../utils/image');
const { catalogKeyboard } = require('../keyboards');

const PRODUCTS_PER_PAGE = shop.productsPerPage || 5;
const TELEGRAM_PHOTO_CAPTION_LIMIT = 1024;

// Generate a short product link command like /p1, /p2 etc.
function productLink(index) {
  return `/p${index}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value = '') {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function visibleTextLength(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot);/g, 'x')
    .length;
}

function truncate(value = '', maxLength = 0) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function truncateMultiline(value = '', maxLength = 0) {
  const text = String(value)
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
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
function buildCatalogText(products, page, totalPages, pageOffset, descriptionLimit = 72) {
  const lines = [];

  if (products.length === 0) {
    return '<b>No products available in this category.</b>';
  }

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const globalIndex = pageOffset + i;

    lines.push(`<b>${escapeHtml(truncate(p.name, 80))}</b>`);

    if (p.description && descriptionLimit > 0) {
      lines.push(`<i>${escapeHtml(truncate(p.description, descriptionLimit))}</i>`);
    }

    if (p.purchaseCount > 0) {
      lines.push(`(${p.purchaseCount} purchase${p.purchaseCount === 1 ? '' : 's'})`);
    } else if (p.isNew) {
      lines.push('(New)');
    }

    lines.push(productLink(globalIndex));
    lines.push('');
  }

  return lines.join('\n');
}

// Fetch categories for the filter buttons
async function getCategories() {
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
    orderBy: { id: 'asc' },
    include: { category: true },
  });
}

function buildHomeIntro() {
  const hasDetailedBranding = shop.telegramUsername || shop.signalUsername || shop.marketUrl || shop.mediaUrl;
  if (!hasDetailedBranding) {
    return [
      `<u><b>${escapeHtml(truncate(shop.name, 80))}</b></u>`,
      escapeHtml(truncateMultiline(shop.welcomeText, 500)),
    ].filter(Boolean).join('\n');
  }

  const lines = [`<u><b>${escapeHtml(shop.name)}</b></u>`];
  if (shop.telegramUsername) lines.push(`<b>Telegram:</b> @${escapeHtml(shop.telegramUsername)}`);
  if (shop.signalUsername) lines.push(`<b>Signal:</b> ${escapeHtml(shop.signalUsername)}`);
  if (shop.marketUrl) {
    const url = escapeHtmlAttribute(shop.marketUrl);
    lines.push(`<b>SI Market Link:</b> <a href="${url}">${escapeHtml(shop.marketUrl)}</a>`);
  }
  if (shop.mediaUrl) {
    const url = escapeHtmlAttribute(shop.mediaUrl);
    lines.push('<b>Media Website:</b>');
    lines.push(`<a href="${url}">${escapeHtml(shop.mediaLabel || shop.mediaUrl)}</a>`);
  }
  if (shop.licenseLine) lines.push('', `<i>${escapeHtml(shop.licenseLine)}</i>`);
  if (shop.bulkDiscountText) {
    const bulkText = escapeHtml(shop.bulkDiscountText)
      .replace(
        'Forward your cart to the CS account to acquire the bulk discount voucher',
        '<i>Forward your cart to the CS account to acquire the bulk discount voucher</i>'
      )
      .replace(
        '(5+ Unit orders please reach out to the CS account for current bulk shipping methods)',
        '<i>(5+ Unit orders please reach out to the CS account for current bulk shipping methods)</i>'
      );
    lines.push('', `<b>BULK DISCOUNTS:</b> ${bulkText}`);
  }
  lines.push('********************************');
  return lines.join('\n');
}

function buildHomeCaption(products, pageOffset) {
  const intro = buildHomeIntro();
  const footer = [
    '********************************',
    '<b>Shipping Policy, Refunds:</b> /info',
    '<b>PGP:</b> /pgp_qtetra',
  ].join('\n');

  // Keep the complete branded introduction. Only product descriptions are
  // shortened when needed to respect Telegram's photo-caption limit.
  for (const descriptionLimit of [64, 48, 32, 16, 0]) {
    const productText = buildCatalogText(products, 0, 1, pageOffset, descriptionLimit);
    const caption = [intro, productText, footer].filter(Boolean).join('\n\n');
    if (visibleTextLength(caption) <= TELEGRAM_PHOTO_CAPTION_LIMIT) return caption;
  }

  return [
    intro,
    buildCatalogText(products, 0, 1, pageOffset, 0),
    footer,
  ].join('\n\n');
}

function buildPageCaption(products, page, totalPages, pageOffset) {
  for (const descriptionLimit of [72, 48, 24, 0]) {
    const caption = buildCatalogText(products, page, totalPages, pageOffset, descriptionLimit);
    if (visibleTextLength(caption) <= TELEGRAM_PHOTO_CAPTION_LIMIT) return caption;
  }
  return buildCatalogText(products, page, totalPages, pageOffset, 0);
}

// Show welcome / home page matching Image 1 & 2
async function showHome(ctx) {
  const [allProducts, categories] = await Promise.all([
    getFilteredProducts('all'),
    getCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const pageProducts = allProducts.slice(0, PRODUCTS_PER_PAGE);
  const caption = buildHomeCaption(pageProducts, 0);
  const keyboard = catalogKeyboard(0, totalPages, 'all', categories, null);
  const photoSrc = resolveImage(shop.welcomeImage);
  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...keyboard,
  };

  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = allProducts.map((product) => product.id);
  ctx.session.catalogCategory = 'all';
  ctx.session.catalogPage = 0;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo && photoSrc) {
        await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption, parse_mode: 'HTML' },
          keyboard
        );
      } else if (ctx.callbackQuery.message?.photo) {
        await ctx.editMessageCaption(caption, opts);
      } else {
        await ctx.editMessageText(caption, opts);
      }
      return;
    } catch (_) {
      // The source message may no longer be editable; send a fresh home view.
    }
  }

  if (photoSrc) {
    try {
      await ctx.replyWithPhoto(photoSrc, {
        caption,
        ...opts,
      });
      return;
    } catch (e) {
      console.error('Failed to send welcome photo with caption:', e.message);
      console.error('Caption length:', caption.length);
    }
  }

  await ctx.reply(caption, opts);
}

// Show the catalog page
async function showCatalog(ctx, page = 0, categoryFilter = 'all') {
  const [allProducts, categories] = await Promise.all([
    getFilteredProducts(categoryFilter),
    getCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffset = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = allProducts.slice(pageOffset, pageOffset + PRODUCTS_PER_PAGE);

  const text = buildPageCaption(pageProducts, safePage, totalPages, pageOffset);
  const keyboard = catalogKeyboard(safePage, totalPages, categoryFilter, categories, categoryFilter);
  const photoSrc = resolveImage(shop.welcomeImage);

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

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo && photoSrc) {
        // A product detail may have replaced the media. Restore the welcome
        // image whenever the user returns to catalog/category pages.
        await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: text, parse_mode: 'HTML' },
          keyboard
        );
      } else if (ctx.callbackQuery.message?.photo) {
        await ctx.editMessageCaption(text, opts);
      } else {
        await ctx.editMessageText(text, opts);
      }
      return;
    } catch (_) {
      // Fallback: send new message
    }
  }

  if (photoSrc) {
    try {
      await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
      return;
    } catch (e) {
      console.error('Failed to send catalog with welcome photo:', e.message);
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

module.exports = { register, showHome, showCatalog, getFilteredProducts, getCategories };
