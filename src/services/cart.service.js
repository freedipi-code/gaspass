const prisma = require('../db/client');

async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });
  return cart;
}

async function getCartWithItems(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true, variant: true } } },
  });
  if (cart) return cart;

  return prisma.cart.create({
    data: { userId },
    include: { items: { include: { product: true, variant: true } } },
  });
}

// Add a product with a specific variant
async function addVariantItem(userId, productId, variantId, qty = 1) {
  const [product, variant] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.productVariant.findUnique({ where: { id: variantId } }),
  ]);
  if (!product || !product.active) throw new Error('Product unavailable');
  if (!variant) throw new Error('Variant unavailable');

  const cart = await getOrCreateCart(userId);

  return prisma.cartItem.upsert({
    where: { cartId_productId_variantId: { cartId: cart.id, productId, variantId } },
    create: { 
      cartId: cart.id, 
      productId, 
      variantId, 
      quantity: qty,
      unitPrice: variant.price
    },
    update: { quantity: { increment: qty } },
  });
}

// Legacy add item (for products without variants)
async function addItem(userId, productId, qty = 1) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) throw new Error('Product unavailable');

  const cart = await getOrCreateCart(userId);
  
  // Use a dummy variantId of 0 or find existing without variant
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: null },
  });
  
  const newQty = (existing?.quantity || 0) + qty;

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  } else {
    return prisma.cartItem.create({
      data: { 
        cartId: cart.id, 
        productId, 
        quantity: qty,
        unitPrice: product.price
      },
    });
  }
}

async function decrementItem(userId, cartItemId) {
  const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!item) return null;
  
  if (item.quantity <= 1) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return null;
  }
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: item.quantity - 1 },
  });
}

async function incrementItem(userId, cartItemId) {
  const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!item) return null;
  
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: item.quantity + 1 },
  });
}

async function clear(userId) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return cart;
}

function computeTotal(cart) {
  return cart.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
}

async function getSummary(userId) {
  const cart = await getCartWithItems(userId);
  return {
    quantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    total: computeTotal(cart),
  };
}

module.exports = {
  getOrCreateCart,
  getCartWithItems,
  addVariantItem,
  addItem,
  decrementItem,
  incrementItem,
  clear,
  computeTotal,
  getSummary,
};
