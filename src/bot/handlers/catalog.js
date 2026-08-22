const { Markup } = require('telegraf');
const prisma = require('../../db/client');
const cartService = require('../../services/cart.service');
const { cartLabel, chunk, formatProductCount } = require('../keyboards');
const { isMessageNotModifiedError } = require('../../utils/telegram');

const PRODUCTS_PER_PAGE = 8;
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function cached(key, loader) {
  const saved = cache.get(key);
  if (saved && saved.expiresAt > Date.now()) return saved.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function sendOrEditText(ctx, text, keyboard) {
  const options = { parse_mode: 'HTML', ...keyboard };
  if (!ctx.callbackQuery) return ctx.reply(text, options);

  await ctx.answerCbQuery().catch(() => {});
  try {
    if (ctx.callbackQuery.message?.photo) {
      await ctx.deleteMessage().catch(() => {});
      return await ctx.reply(text, options);
    }
    return await ctx.editMessageText(text, options);
  } catch (error) {
    if (isMessageNotModifiedError(error)) return;
    console.error('Catalog rendering failed:', error.message);
    return ctx.reply(text, options);
  }
}

async function getCategoryData() {
  return cached('category-data', async () => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: { where: { active: true } } } } },
      orderBy: { id: 'asc' },
    });
    const childrenByParent = new Map();
    for (const category of categories) {
      const key = category.parentId || 0;
      childrenByParent.set(key, [...(childrenByParent.get(key) || []), category]);
    }
    return {
      categories,
      categoryById: new Map(categories.map((category) => [category.id, category])),
      childrenByParent,
    };
  });
}

function descendantIds(categoryId, childrenByParent) {
  const ids = [Number(categoryId)];
  for (let index = 0; index < ids.length; index += 1) {
    const children = childrenByParent.get(ids[index]) || [];
    ids.push(...children.map((child) => child.id));
  }
  return ids;
}

function recursiveProductCount(category, categoryById, childrenByParent) {
  return descendantIds(category.id, childrenByParent).reduce(
    (total, id) => total + (categoryById.get(id)?._count?.products || 0),
    0,
  );
}

async function showBrowseRoot(ctx) {
  const { categoryById, childrenByParent } = await getCategoryData();
  const roots = childrenByParent.get(0) || [];
  const summary = await cartService.getSummary(ctx.state.user.id);
  const buttons = roots.map((category) => {
    const count = recursiveProductCount(category, categoryById, childrenByParent);
    return Markup.button.callback(
      `${category.name} (${formatProductCount(count)})`,
      `cat:${category.id}:page:0`,
    );
  });

  const rows = chunk(buttons, 1);
  rows.push([Markup.button.callback(cartLabel(summary), 'cart')]);
  rows.push([{ text: '🏠 Main Menu', callback_data: 'home', style: 'primary' }]);

  const text = '<b>📦 Main Categories</b>\n\n<b>Choose a category:</b>';
  return sendOrEditText(ctx, text, Markup.inlineKeyboard(rows));
}

async function showCategoryProducts(ctx, categoryId, requestedPage = 0) {
  const { categories, childrenByParent } = await getCategoryData();
  const category = categories.find((item) => item.id === Number(categoryId));
  if (!category) return showBrowseRoot(ctx);

  const ids = descendantIds(category.id, childrenByParent);
  const products = await cached(`products:${ids.join(',')}`, () => prisma.product.findMany({
    where: { categoryId: { in: ids }, active: true },
    orderBy: { id: 'asc' },
  }));

  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE));
  const page = Math.max(0, Math.min(Number(requestedPage) || 0, totalPages - 1));
  const visibleProducts = products.slice(page * PRODUCTS_PER_PAGE, (page + 1) * PRODUCTS_PER_PAGE);
  const summary = await cartService.getSummary(ctx.state.user.id);

  ctx.session = ctx.session || {};
  ctx.session.catalogProducts = products.map((product) => product.id);
  ctx.session.catalogCategory = String(category.id);
  ctx.session.catalogPage = page;

  const rows = visibleProducts.map((product) => [
    Markup.button.callback(product.name, `prod:${product.id}`),
  ]);

  if (!visibleProducts.length) rows.push([Markup.button.callback('No products available', 'noop')]);
  if (totalPages > 1) {
    rows.push([
      ...(page > 0 ? [Markup.button.callback('‹ Previous', `cat:${category.id}:page:${page - 1}`)] : []),
      Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'),
      ...(page < totalPages - 1 ? [Markup.button.callback('Next ›', `cat:${category.id}:page:${page + 1}`)] : []),
    ]);
  }

  rows.push([Markup.button.callback(cartLabel(summary), 'cart')]);
  rows.push([
    Markup.button.callback('⬅️ Up/Back', category.parentId ? `cat:${category.parentId}:page:0` : 'browse'),
    Markup.button.callback('🛍️ Main Categories', 'browse'),
  ]);
  rows.push([{ text: '🏠 Main Menu', callback_data: 'home', style: 'primary' }]);

  const text = [
    `<b>📦 Products in ${escapeHtml(category.name)}</b>`,
    '',
    '<b>Navigation Path:</b>',
    '• Categories',
    `└── ${escapeHtml(category.name)} ⬅️`,
    '',
    '<b>Available Products:</b>',
  ].join('\n');

  return sendOrEditText(ctx, text, Markup.inlineKeyboard(rows));
}

function register(bot) {
  bot.action('browse', showBrowseRoot);
  bot.command('shop', showBrowseRoot);
  bot.action('shop', showBrowseRoot);
  bot.action(/^cat:root:(\d+)$/, (ctx) => showCategoryProducts(ctx, ctx.match[1], 0));
  bot.action(/^cat:(\d+):page:(\d+)$/, (ctx) => showCategoryProducts(ctx, ctx.match[1], ctx.match[2]));
  bot.action(/^cat:(\d+)$/, (ctx) => showCategoryProducts(ctx, ctx.match[1], 0));
  bot.action(/^catalog:back:(.+)$/, (ctx) => {
    const categoryId = ctx.match[1] === 'all' ? ctx.session?.catalogCategory : ctx.match[1];
    if (!categoryId) return showBrowseRoot(ctx);
    return showCategoryProducts(ctx, categoryId, ctx.session?.catalogPage || 0);
  });
}

module.exports = { register, showBrowseRoot, showCategoryProducts };
