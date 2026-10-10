const prisma = require('../db/client');

async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });
  return cart;
}

async function getCartWithItems(userId) {
  const cart = await getOrCreateCart(userId);
  return prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: { include: { product: true, variant: true } } },
  });
}

async function pricingForQuantity(product, quantity) {
  const variants = product.variants || await prisma.productVariant.findMany({
    where: { productId: product.id, active: true },
    orderBy: { quantity: 'desc' },
  });
  const tier = variants.find((variant) => quantity >= variant.quantity);
  return {
    variantId: tier?.id || null,
    unitPrice: tier?.price ?? product.price,
  };
}

// Add a product with a specific variant
async function addVariantItem(userId, productId, variantId, qty = 1) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } },
  });
  if (!product || !product.active) throw new Error('Product unavailable');
  
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId, active: true } });
  if (!variant) throw new Error('Pricing tier unavailable');

  const cart = await getOrCreateCart(userId);
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } });
  
  const newQty = (existing?.quantity || 0) + qty;
  if (newQty > product.stock) throw new Error(`Only ${product.stock} units available`);
  const pricing = await pricingForQuantity(product, newQty);

  if (!existing) {
    return prisma.cartItem.create({
      data: {
      cartId: cart.id, 
      productId, 
      variantId: pricing.variantId,
      quantity: qty,
      unitPrice: pricing.unitPrice,
      },
    });
  }
  return prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity: newQty, ...pricing },
  });
}

// Legacy add item (for products without variants)
async function addItem(userId, productId, qty = 1) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } },
  });
  if (!product || !product.active) throw new Error('Product unavailable');

  const cart = await getOrCreateCart(userId);
  
  // Use a dummy variantId of 0 or find existing without variant
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } });
  
  const newQty = (existing?.quantity || 0) + qty;
  if (newQty > product.stock) throw new Error(`Only ${product.stock} units available`);
  const pricing = await pricingForQuantity(product, newQty);

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQty, ...pricing },
    });
  } else {
    return prisma.cartItem.create({
      data: { 
        cartId: cart.id, 
        productId, 
        variantId: pricing.variantId,
        quantity: qty,
        unitPrice: pricing.unitPrice,
      },
    });
  }
}

async function decrementItem(userId, cartItemId) {
  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
    include: { product: { include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } } } },
  });
  if (!item) return null;
  
  if (item.quantity <= 1) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return null;
  }
  const quantity = item.quantity - 1;
  const pricing = await pricingForQuantity(item.product, quantity);
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity, ...pricing },
  });
}

async function incrementItem(userId, cartItemId) {
  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId: cart.id },
    include: { product: { include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } } } },
  });
  if (!item) return null;
  if (item.quantity >= item.product.stock) throw new Error(`Only ${item.product.stock} units available`);
  
  const quantity = item.quantity + 1;
  const pricing = await pricingForQuantity(item.product, quantity);
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity, ...pricing },
  });
}

async function removeQuantity(userId, cartItemId, quantity) {
  const cart = await getOrCreateCart(userId);
  const item = await prisma.cartItem.findFirst({ where: { id: cartItemId, cartId: cart.id } });
  if (!item) throw new Error('Cart item not found');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
    throw new Error(`Enter a quantity from 1 to ${item.quantity}`);
  }
  if (quantity === item.quantity) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return null;
  }
  const newQuantity = item.quantity - quantity;
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: { variants: { where: { active: true }, orderBy: { quantity: 'desc' } } },
  });
  const pricing = await pricingForQuantity(product, newQuantity);
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: newQuantity, ...pricing },
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

module.exports = {
  getOrCreateCart,
  getCartWithItems,
  addVariantItem,
  addItem,
  decrementItem,
  incrementItem,
  removeQuantity,
  clear,
  computeTotal,
};
