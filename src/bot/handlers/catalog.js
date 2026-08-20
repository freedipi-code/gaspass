const prisma = require('../../db/client');
const shop = require('../../shop.config');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');
const { formatPrice, chunk } = require('../keyboards');
const { Markup } = require('telegraf');

const PRODUCTS_PER_PAGE = 8;
const CATALOG_CACHE_TTL_MS = 30 * 1000;
const catalogCache = new Map();

async function cached(key, loader) {
  const item = catalogCache.get(key);
  if (item && item.expiresAt > Date.now()) return item.value;

  const value = await loader();
  catalogCache.set(key, { value, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS });
  return value;
}

// Helper to send or edit a banner message
async function sendOrEditWithBanner(ctx, photoPath, text, keyboard) {
  const photoSrc = resolveImage(photoPath);
  const opts = {
    parse_mode: 'Markdown',
    ...keyboard,
  };

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo && photoSrc) {
        // Edit media caption
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: text, parse_mode: 'Markdown' },
          opts
        );
        rememberTelegramPhoto(photoPath, edited);
      } else {
        // Delete and send fresh to show photo correctly
        await ctx.deleteMessage().catch(() => {});
        if (photoSrc) {
          const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
          rememberTelegramPhoto(photoPath, sent);
        } else {
          await ctx.reply(text, opts);
        }
      }
      return;
    } catch (e) {
      if (isMessageNotModifiedError(e)) return;
      console.error('Error editing banner message:', e.message);
    }
  }

  if (photoSrc) {
    const sent = await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
    rememberTelegramPhoto(photoPath, sent);
  } else {
    await ctx.reply(text, opts);
  }
}

// 1. Browse Root Categories (Image 2)
async function showBrowseRoot(ctx) {
  const roots = await cached('roots', () =>
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { id: 'asc' },
    })
  );

  const text = 'Choose a category';

  // Build root category buttons
  const buttons = roots.map((c) => Markup.button.callback(c.name, `cat:root:${c.id}`));
  
  // Footer buttons
  const rows = chunk(buttons, 1);
  rows.push([Markup.button.callback('🧺 Cart', 'cart')]);
  rows.push([{ text: '← Back', callback_data: 'home', style: 'danger' }]);
  rows.push([{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]);

  await sendOrEditWithBanner(ctx, 'images/browse_banner.png', text, Markup.inlineKeyboard(rows));
}

// 2. Browse Subcategories/Sections (Image 3)
async function showCategorySections(ctx, rootId) {
  const root = await cached(`root:${rootId}`, () =>
    prisma.category.findUnique({
      where: { id: Number(rootId) },
    })
  );
  if (!root) return showBrowseRoot(ctx);

  const subcategories = await cached(`sections:${rootId}`, () =>
    prisma.category.findMany({
      where: { parentId: Number(rootId) },
      include: {
        _count: {
          select: { products: { where: { active: true } } }
        }
      },
      orderBy: { id: 'asc' },
    })
  );

  const text = `*${root.name}*\nChoose a section`;

  // Build subcategory buttons with product count
  const buttons = subcategories.map((c) => {
    const count = c._count?.products || 0;
    return Markup.button.callback(`${c.name} (${count})`, `cat:${c.id}:page:0`);
  });

  const rows = chunk(buttons, 1);
  rows.push([Markup.button.callback('🧺 Cart', 'cart')]);
  rows.push([{ text: '← Back', callback_data: 'browse', style: 'danger' }]);
  rows.push([{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]);

  await sendOrEditWithBanner(ctx, 'images/category_banner.png', text, Markup.inlineKeyboard(rows));
}

// 3. Browse Products List in Subcategory (Image 4)
async function showSubcategoryProducts(ctx, subcatId, page = 0) {
  const subcat = await cached(`subcat:${subcatId}`, () =>
    prisma.category.findUnique({
      where: { id: Number(subcatId) },
      include: { parent: true },
    })
  );
  if (!subcat) return showBrowseRoot(ctx);

  const allProducts = await cached(`products:${subcatId}`, () =>
    prisma.product.findMany({
      where: { categoryId: Number(subcatId), active: true },
      orderBy: { id: 'asc' },
    })
  );

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffset = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = allProducts.slice(pageOffset, pageOffset + PRODUCTS_PER_PAGE);

  // Save state for product detail back button
  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = allProducts.map((p) => p.id);
  ctx.session.catalogCategory = String(subcatId);
  ctx.session.catalogPage = safePage;

  const text = `*${subcat.name}*`;

  // Build product list buttons
  const buttons = pageProducts.map((p) =>
    Markup.button.callback(`🛒 ${p.name} · ${formatPrice(p.price)}`, `prod:${p.id}`)
  );

  const rows = chunk(buttons, 1);

  // Pagination row
  if (totalPages > 1) {
    const navRow = [];
    if (safePage > 0) {
      navRow.push(Markup.button.callback('‹ Prev', `cat:${subcatId}:page:${safePage - 1}`));
    }
    navRow.push(Markup.button.callback(`${safePage + 1}/${totalPages}`, 'noop'));
    if (safePage < totalPages - 1) {
      navRow.push(Markup.button.callback('Next ›', `cat:${subcatId}:page:${safePage + 1}`));
    }
    rows.push(navRow);
  }

  // Footer buttons
  rows.push([Markup.button.callback('🧺 Cart', 'cart')]);
  
  const backCallback = subcat.parentId ? `cat:root:${subcat.parentId}` : 'browse';
  rows.push([{ text: '← Back', callback_data: backCallback, style: 'danger' }]);
  rows.push([{ text: '⌂ Home', callback_data: 'home', style: 'danger' }]);

  await sendOrEditWithBanner(ctx, 'images/subcategory_banner.png', text, Markup.inlineKeyboard(rows));
}

function register(bot) {
  // Main browse action
  bot.action('browse', showBrowseRoot);
  bot.command('shop', showBrowseRoot);
  bot.action('shop', showBrowseRoot);

  // Categories root click
  bot.action(/^cat:root:(\d+)$/, async (ctx) => {
    const rootId = ctx.match[1];
    return showCategorySections(ctx, rootId);
  });

  // Subcategory click / pagination
  bot.action(/^cat:(\d+):page:(\d+)$/, async (ctx) => {
    const subcatId = ctx.match[1];
    const page = Number(ctx.match[2]);
    return showSubcategoryProducts(ctx, subcatId, page);
  });

  bot.action(/^cat:(\d+)$/, async (ctx) => {
    const subcatId = ctx.match[1];
    return showSubcategoryProducts(ctx, subcatId, 0);
  });

  // Back redirect from product detail page
  bot.action(/^catalog:back:(.+)$/, async (ctx) => {
    const catVal = ctx.match[1];
    const page = ctx.session?.catalogPage || 0;
    if (catVal === 'all') {
      return showBrowseRoot(ctx);
    }
    return showSubcategoryProducts(ctx, catVal, page);
  });
}

module.exports = {
  register,
  showBrowseRoot,
  showCategorySections,
  showSubcategoryProducts,
};
