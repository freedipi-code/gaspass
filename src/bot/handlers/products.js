const prisma = require('../../db/client');
const cartService = require('../../services/cart.service');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');
const { renderPage } = require('../../utils/page');
const { formatPrice, productDetailKeyboard } = require('../keyboards');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildProductCaption(product, variants, selectedVariant) {
  const pricing = variants.length
    ? variants.map((variant) => `• ${escapeHtml(variant.label)}: ${formatPrice(variant.price)}`)
    : [`• 1 unit: ${formatPrice(product.price)}`];
  const selectionLabel = selectedVariant?.label || '1 unit';
  const selectionPrice = selectedVariant?.price ?? product.price;
  const descriptionLimit = Math.max(
    120,
    Math.min(520, 820 - product.name.length - pricing.join('\n').length),
  );

  return [
    `<b>${escapeHtml(product.name)}</b>`,
    '',
    `<b>📦 Stock:</b> ${product.stock > 0 ? '🟢' : '🔴'}`,
    '',
    '<b>📝 Description:</b>',
    escapeHtml(truncate(product.description || 'No description available.', descriptionLimit)),
    '',
    '<b>🏷️ Bulk Pricing:</b>',
    ...pricing,
    '',
    `<b>🛒 Current Selection:</b> ${escapeHtml(selectionLabel)} = ${formatPrice(selectionPrice)}`,
  ].join('\n');
}

async function renderProduct(ctx, productId, notice = '') {
  const product = await prisma.product.findUnique({
    where: { id: Number(productId) },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!product || !product.active) {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Product unavailable').catch(() => {});
    else await ctx.reply('Product unavailable');
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.selectedVariants = ctx.session.selectedVariants || {};
  let selectedVariantId = Number(ctx.session.selectedVariants[product.id]);
  if (!product.variants.some((variant) => variant.id === selectedVariantId)) {
    selectedVariantId = product.variants[0]?.id || null;
    if (selectedVariantId) ctx.session.selectedVariants[product.id] = selectedVariantId;
  }

  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const summary = await cartService.getSummary(ctx.state.user.id);
  const caption = buildProductCaption(product, product.variants, selectedVariant);
  const keyboard = productDetailKeyboard(
    product,
    product.variants,
    selectedVariantId,
    summary,
    ctx.session.catalogCategory,
  );
  const options = { parse_mode: 'HTML', ...keyboard };
  const photoSrc = resolveImage(product.image);

  if (ctx.callbackQuery) await ctx.answerCbQuery(notice).catch(() => {});

  try {
    if (photoSrc) {
      if (ctx.callbackQuery?.message?.photo) {
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption, parse_mode: 'HTML' },
          options,
        );
        rememberTelegramPhoto(product.image, edited);
        return;
      }
      if (ctx.callbackQuery) await ctx.deleteMessage().catch(() => {});
      const sent = await ctx.replyWithPhoto(photoSrc, { caption, ...options });
      rememberTelegramPhoto(product.image, sent);
      return;
    }

    if (ctx.callbackQuery?.message?.photo) {
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply(caption, options);
    } else if (ctx.callbackQuery) {
      await ctx.editMessageText(caption, options);
    } else {
      await ctx.reply(caption, options);
    }
  } catch (error) {
    if (isMessageNotModifiedError(error)) return;
    console.error('Product rendering failed:', error.message);
    await ctx.reply(caption, options).catch(() => {});
  }
}

async function showProductDetail(ctx) {
  return renderProduct(ctx, ctx.match[1]);
}

async function selectVariant(ctx) {
  const productId = Number(ctx.match[1]);
  const variantId = Number(ctx.match[2]);
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) return ctx.answerCbQuery('Option unavailable', { show_alert: true });

  ctx.session = ctx.session || {};
  ctx.session.selectedVariants = ctx.session.selectedVariants || {};
  ctx.session.selectedVariants[productId] = variantId;
  return renderProduct(ctx, productId);
}

async function addSelectedToCart(ctx) {
  const productId = Number(ctx.match[1]);
  const variantId = Number(ctx.session?.selectedVariants?.[productId]);
  if (!variantId) return ctx.answerCbQuery('Select an option first', { show_alert: true });

  try {
    await cartService.addVariantItem(ctx.state.user.id, productId, variantId, 1);
    return renderProduct(ctx, productId, '✅ Added to cart');
  } catch (error) {
    return ctx.answerCbQuery(error.message || 'Could not add', { show_alert: true });
  }
}

async function addToCart(ctx) {
  const productId = Number(ctx.match[1]);
  try {
    await cartService.addItem(ctx.state.user.id, productId, 1);
    return renderProduct(ctx, productId, '✅ Added to cart');
  } catch (error) {
    return ctx.answerCbQuery(error.message || 'Could not add', { show_alert: true });
  }
}

function register(bot) {
  bot.action(/^prod:(\d+)$/, showProductDetail);
  bot.action(/^selectVar:(\d+):(\d+)$/, selectVariant);
  bot.action(/^addSelected:(\d+)$/, addSelectedToCart);
  bot.action(/^add:(\d+)$/, addToCart);
  bot.action(/^reviews:(\d+)$/, (ctx) => ctx.answerCbQuery('Reviews feature coming soon!'));
  bot.hears('/vendor', (ctx) => renderPage(ctx, 'Vendor info coming soon.'));
}

module.exports = { register, showProductDetail };
