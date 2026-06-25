const { Markup } = require('telegraf');
const prisma = require('../../db/client');
const cartService = require('../../services/cart.service');
const { resolveImage } = require('../../utils/image');
const shop = require('../../shop.config');
const { productDetailKeyboard, starsVisual, formatPrice } = require('../keyboards');

// ── Product Detail View ──

function buildProductCaption(product, vendorName, vendorCommand) {
  const ratingStr = product.rating > 0
    ? `${starsVisual(product.rating)} ${product.rating.toFixed(1)}/10`
    : 'No rating yet';
    
  const purchasesStr = `${product.purchaseCount} purchases`;
  const vendorStr = `-- by ${vendorName}\n${vendorCommand}`;

  let desc = product.description || '';
  if (desc) desc += '\n\n';

  return (
    `*${product.name.toUpperCase()}*\n` +
    `${ratingStr}\n` +
    `_${purchasesStr}_\n` +
    `${vendorStr}\n\n` +
    `${desc}` +
    `🛒 This product is ${product.inCart ? `*in*` : `*not in*`} /cart`
  );
}

// Exported so catalog.js can call it directly
async function showProductDetail(ctx) {
  // If called from a regex match or directly
  const productId = Number(ctx.match[1] || ctx.match[2]); 
  
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

  // Check cart status
  const cart = await cartService.getOrCreateCart(ctx.state.user.id);
  const inCartCount = await prisma.cartItem.count({
    where: { cartId: cart.id, productId: pId }
  });
  product.inCart = inCartCount > 0;

  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const caption = buildProductCaption(product, shop.vendorName, shop.vendorCommand);
  const keyboard = productDetailKeyboard(product, product.variants, pIndex, totalProducts, catFilter);

  const opts = {
    parse_mode: 'Markdown',
    ...keyboard,
  };

  const photoSrc = resolveImage(product.image);

  try {
    if (photoSrc) {
      if (ctx.callbackQuery?.message?.photo) {
        await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption: caption, parse_mode: 'Markdown' },
          opts
        );
      } else {
        await ctx.replyWithPhoto(photoSrc, { caption, ...opts });
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
    console.error('Error showing product:', e.message);
  }
}

async function addVariantToCart(ctx) {
  const productId = Number(ctx.match[1]);
  const variantId = Number(ctx.match[2]);
  
  try {
    await cartService.addVariantItem(ctx.state.user.id, productId, variantId, 1);
    await ctx.answerCbQuery(`✅ Added to cart`);
    
    // Refresh product view to update the "This product is in /cart" text
    ctx.match[1] = String(productId); // Setup for showProductDetail
    await showProductDetail(ctx);
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
    
    ctx.match[1] = String(productId);
    await showProductDetail(ctx);
  } catch (e) {
    await ctx.answerCbQuery(e.message || 'Could not add', { show_alert: true });
  }
}

function register(bot) {
  bot.action(/^prod:(\d+)$/, showProductDetail);
  bot.action(/^prodNav:(\d+):(.+)$/, showProductDetail);
  
  bot.action(/^addVar:(\d+):(\d+)$/, addVariantToCart);
  bot.action(/^add:(\d+)$/, addToCart);
  
  // Empty stub for reviews/vendor for now
  bot.action(/^reviews:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Reviews feature coming soon!').catch(() => {});
  });
  bot.hears('/vendor', (ctx) => ctx.reply('Vendor info coming soon.'));
}

module.exports = { register, showProductDetail };
