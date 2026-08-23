const { Markup } = require('telegraf');
const prisma = require('../../db/client');
const cartService = require('../../services/cart.service');
const { resolveImage, rememberTelegramPhoto } = require('../../utils/image');
const { isMessageNotModifiedError } = require('../../utils/telegram');
const shop = require('../../shop.config');
const { productDetailKeyboard, starsVisual, formatPrice } = require('../keyboards');

// ── Product Detail View ──

function buildProductCaption(product, index, total, inCartQuantity = 0) {
  const idxStr = total > 0 ? ` (${index + 1}/${total})` : '';
  const lines = [
    `≔ _${product.name}_${idxStr}`,
    '',
    product.description || '',
  ];
  if (inCartQuantity > 0) lines.push('', `In cart: ${inCartQuantity}`);
  return lines.join('\n');
}

// Exported so catalog.js can call it directly
async function showProductDetail(ctx, options = {}) {
  // If called from a regex match or directly
  const productId = Number(options.productId || ctx.match[1] || ctx.match[2]);
  
  // Support for product index navigation (Next >)
  let pId = productId;
  let pIndex = ctx.state.productIndex;
  
  const productIds = ctx.session?.catalogProducts || [];
  const catFilter = ctx.session?.catalogCategory || 'all';
  
  // If it's a prodNav action
  if (ctx.match && ctx.match[0].startsWith('prodNav:')) {
    pIndex = Number(ctx.match[1]);
    if (pIndex >= 0 && pIndex < productIds.length) {
      pId = productIds[pIndex];
    } else {
      await ctx.answerCbQuery('End of list').catch(() => {});
      return;
    }
  }

  // Find product index if we have ID but no index
  if (pIndex === undefined && productIds.length) {
    pIndex = productIds.indexOf(pId);
  }
  
  const totalProducts = productIds.length;

  const product = await prisma.product.findUnique({
    where: { id: pId },
    include: { variants: { orderBy: { sortOrder: 'asc' } }, _count: { select: { reviews: true } } },
  });

  if (!product || !product.active) {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Product unavailable').catch(() => {});
    else await ctx.reply('Product unavailable');
    return;
  }

  if (ctx.callbackQuery && !options.callbackAnswered) {
    await ctx.answerCbQuery().catch(() => {});
  }

  const cart = await cartService.getCartWithItems(ctx.state.user.id);
  const inCartQuantity = cart.items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const caption = buildProductCaption(product, pIndex, totalProducts, inCartQuantity);
  const keyboard = productDetailKeyboard(
    product,
    product.variants,
    pIndex,
    totalProducts,
    catFilter,
    inCartQuantity
  );

  const opts = {
    parse_mode: 'Markdown',
    ...keyboard,
  };

  const photoSrc = resolveImage(product.image);

  try {
    if (photoSrc) {
      if (ctx.callbackQuery?.message?.photo) {
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: caption, parse_mode: 'Markdown' },
          opts
        );
        rememberTelegramPhoto(product.image, edited);
      } else {
        const sent = await ctx.replyWithPhoto(photoSrc, { caption, ...opts });
        rememberTelegramPhoto(product.image, sent);
      }
    } else {
      if (ctx.callbackQuery?.message?.photo) {
        // Can't edit a photo to text directly without deleting, just reply
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(caption, opts);
      } else if (ctx.callbackQuery) {
        await ctx.editMessageText(caption, opts);
      } else {
        await ctx.reply(caption, opts);
      }
    }
  } catch (e) {
    if (isMessageNotModifiedError(e)) return;
    console.error('Error showing product:', e.message);
  }
}

async function addVariantToCart(ctx) {
  const productId = Number(ctx.match[1]);
  const variantId = Number(ctx.match[2]);
  
  try {
    await cartService.addVariantItem(ctx.state.user.id, productId, variantId, 1);
    await ctx.answerCbQuery(`✅ Added to cart`);
    
    await showProductDetail(ctx, { productId, callbackAnswered: true });
  } catch (e) {
    await ctx.answerCbQuery(e.message || 'Could not add', { show_alert: true });
  }
}

// Fallback for products without variants
async function addToCart(ctx) {
  const productId = Number(ctx.match[1]);
  try {
    await cartService.addItem(ctx.state.user.id, productId, 1);
    await ctx.answerCbQuery(`✅ Added to cart`);
    
    await showProductDetail(ctx, { productId, callbackAnswered: true });
  } catch (e) {
    await ctx.answerCbQuery(e.message || 'Could not add', { show_alert: true });
  }
}

function register(bot) {
  bot.action(/^prod:(\d+)$/, showProductDetail);
  bot.action(/^prodNav:(\d+):(.+)$/, showProductDetail);
  
  bot.action(/^addVar:(\d+):(\d+)$/, addVariantToCart);
  bot.action(/^add:(\d+)$/, addToCart);

  bot.action(/^chooseQty:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Choose one of the available pack sizes above.', { show_alert: true });
  });

  bot.action(/^cart:removeProduct:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    await cartService.removeProductItems(ctx.state.user.id, productId);
    await ctx.answerCbQuery('Removed from cart');
    return showProductDetail(ctx, { productId, callbackAnswered: true });
  });
  
  // Empty stub for reviews/vendor for now
  bot.action(/^reviews:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Reviews feature coming soon!').catch(() => {});
  });
  bot.hears('/vendor', (ctx) => ctx.reply('Vendor info coming soon.'));
}

module.exports = { register, showProductDetail, buildProductCaption };
