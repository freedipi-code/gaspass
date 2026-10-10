const prisma = require('../../db/client');
const cartService = require('../../services/cart.service');
const { resolveImage } = require('../../utils/image');
const { productDetailKeyboard } = require('../keyboards');

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Product Detail View ──

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function buildProductCaption(product) {
  const description = truncate(product.description || 'No description available.', 650);

  const lines = [
    `<b>${escapeHtml(product.name)}</b>`,
    '',
    escapeHtml(description),
    '',
    `<b>Price:</b> ${escapeHtml(require('../keyboards').formatPrice(product.price))}`,
    `<b>Stock:</b> ${product.stock}`,
  ];

  if (product.variants?.length) {
    lines.push('');
    lines.push('Select a quantity tier below. Prices shown are per unit:');
  }

  return lines.join('\n');
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
    include: { variants: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
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

  const caption = buildProductCaption(product);
  const keyboard = productDetailKeyboard(product, product.variants, pIndex, totalProducts, catFilter);

  const opts = {
    parse_mode: 'HTML',
    ...keyboard,
  };

  const photoSrc = resolveImage(product.image);

  try {
    if (photoSrc) {
      if (ctx.callbackQuery?.message?.photo) {
        await ctx.editMessageMedia(
          { type: 'photo', media: photoSrc, caption, parse_mode: 'HTML' },
          keyboard
        );
      } else {
        if (ctx.callbackQuery?.message) await ctx.deleteMessage().catch(() => {});
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
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId, active: true } });
    if (!variant) throw new Error('Pricing tier unavailable');
    await cartService.addVariantItem(ctx.state.user.id, productId, variantId, variant.quantity);
    await ctx.answerCbQuery(`✅ ${variant.quantity} added`);
    const { showCart } = require('./cart');
    await showCart(ctx);
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

async function requestCustomQuantity(ctx) {
  const productId = Number(ctx.match[1]);
  const product = await prisma.product.findFirst({ where: { id: productId, active: true } });
  if (!product) return ctx.answerCbQuery('Product unavailable', { show_alert: true });
  ctx.session = ctx.session || {};
  ctx.session.customQuantityProductId = productId;
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply(`✏️ How many units of “${product.name}” would you like to add?`);
}

async function handleCustomQuantity(ctx, next) {
  const productId = ctx.session?.customQuantityProductId;
  if (!productId) return next();
  if (ctx.message.text.startsWith('/')) return next();

  const quantity = Number(ctx.message.text.trim());
  if (!Number.isInteger(quantity) || quantity < 1) {
    return ctx.reply('Please enter a whole number greater than zero.');
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } },
  });
  if (!product) {
    delete ctx.session.customQuantityProductId;
    return ctx.reply('Product unavailable.');
  }

  const tier = product.variants.find((variant) => quantity >= variant.quantity);
  try {
    if (tier) await cartService.addVariantItem(ctx.state.user.id, product.id, tier.id, quantity);
    else await cartService.addItem(ctx.state.user.id, product.id, quantity);
    delete ctx.session.customQuantityProductId;
    await ctx.reply(`✅ ${quantity} unit${quantity === 1 ? '' : 's'} added at ${require('../keyboards').formatPrice(tier?.price ?? product.price)} per unit.`);
    const { showCart } = require('./cart');
    return showCart(ctx);
  } catch (error) {
    return ctx.reply(error.message || 'Could not add this quantity.');
  }
}

function register(bot) {
  bot.action(/^prod:(\d+)$/, showProductDetail);
  bot.action(/^prodNav:(\d+):(.+)$/, showProductDetail);
  
  bot.action(/^addVar:(\d+):(\d+)$/, addVariantToCart);
  bot.action(/^add:(\d+)$/, addToCart);
  bot.action(/^customQty:(\d+)$/, requestCustomQuantity);
  bot.on('text', handleCustomQuantity);
  
  bot.hears('/vendor', (ctx) => ctx.reply('Vendor info coming soon.'));
}

module.exports = { register, showProductDetail };
