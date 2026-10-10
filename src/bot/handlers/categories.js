const prisma = require('../../db/client');
const { Markup } = require('telegraf');
const shop = require('../../shop.config');
const cartService = require('../../services/cart.service');
const { showCatalog } = require('./catalog');

const CATEGORIES_PER_PAGE = 5;

function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / CATEGORIES_PER_PAGE));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  return {
    page: safePage,
    totalPages,
    items: items.slice(safePage * CATEGORIES_PER_PAGE, (safePage + 1) * CATEGORIES_PER_PAGE),
  };
}

function categoryRows(categories, actionPrefix) {
  const buttons = categories.map((category) => Markup.button.callback(
    `🟢 ${category.name.length > 26 ? `${category.name.slice(0, 23)}...` : category.name}`,
    `${actionPrefix}:${category.id}:0`,
  ));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  return rows;
}

async function renderCategoryMessage(ctx, text, keyboard) {
  const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(keyboard) };
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (ctx.callbackQuery.message?.photo) {
        await ctx.deleteMessage().catch(() => {});
        return ctx.reply(text, opts);
      }
      return await ctx.editMessageText(text, opts);
    } catch (_) {}
  }
  return ctx.reply(text, opts);
}

async function getCartSummary(userId) {
  const cart = await cartService.getCartWithItems(userId);
  return {
    count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    total: cartService.computeTotal(cart),
  };
}

async function showRootCategories(ctx, requestedPage = 0) {
  const [categories] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { children: true, products: true } },
      },
    }),
  ]);

  const page = paginate(categories, requestedPage);
  const rows = categoryRows(page.items, 'cat:view');
  if (page.totalPages > 1) {
    const nav = [];
    if (page.page > 0) nav.push(Markup.button.callback('◀️ Prev', `categories:root:${page.page - 1}`));
    if (page.page < page.totalPages - 1) nav.push(Markup.button.callback('Next ▶️', `categories:root:${page.page + 1}`));
    rows.push(nav);
  }
  rows.push([Markup.button.callback('⬅️ Back', 'home')]);
  return renderCategoryMessage(ctx, shop.categoriesTitle || '<b>Products</b>\nSelect a category or product:', rows);
}

async function showCategory(ctx, requestedPage) {
  const categoryId = Number(ctx.match[1]);
  const pageNumber = requestedPage ?? Number(ctx.match[2] || 0);
  const [category] = await Promise.all([
    prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        children: {
          orderBy: { id: 'asc' },
          include: { _count: { select: { products: true, children: true } } },
        },
        _count: { select: { children: true, products: true } },
      },
    }),
  ]);

  if (!category) {
    await ctx.answerCbQuery('Category not found').catch(() => {});
    return;
  }

  if (!category.children.length && category._count.products > 0) {
    return showCatalog(ctx, 0, String(category.id));
  }
  const page = paginate(category.children, pageNumber);
  const rows = categoryRows(page.items, 'cat:view');
  if (category._count.products > 0) {
    rows.push([Markup.button.callback(`View ${category.name} products`, `catalog:cat:${category.id}:0`)]);
  }
  if (page.totalPages > 1) {
    const nav = [];
    if (page.page > 0) nav.push(Markup.button.callback('◀️ Prev', `cat:view:${category.id}:${page.page - 1}`));
    if (page.page < page.totalPages - 1) nav.push(Markup.button.callback('Next ▶️', `cat:view:${category.id}:${page.page + 1}`));
    rows.push(nav);
  }
  rows.push([Markup.button.callback('⬅️ Back', category.parentId ? `cat:view:${category.parentId}:0` : 'categories:root')]);
  return renderCategoryMessage(ctx, '<b>Products</b>\nSelect a category or product:', rows);
}

function register(bot) {
  bot.action('categories:root', showRootCategories);
  bot.action(/^categories:root:(\d+)$/, (ctx) => showRootCategories(ctx, Number(ctx.match[1])));
  bot.command('categories', showRootCategories);
  bot.command('products', showRootCategories);
  bot.action(/^cat:view:(\d+)(?::(\d+))?$/, showCategory);

  bot.action(/^cat:root:(.+)$/, async (ctx) => {
    return showRootCategories(ctx);
  });
  bot.action(/^cat:(\d+)$/, async (ctx) => {
    const catId = ctx.match[1];
    ctx.match[1] = catId;
    return showCategory(ctx);
  });
}

module.exports = { register, showRootCategories, showCategory };
