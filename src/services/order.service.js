const prisma = require('../db/client');
const cartService = require('./cart.service');

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
  return `CMD-${ts}${rand}`;
}

async function createOrderFromCart(userId, orderData) {
  const cart = await cartService.getCartWithItems(userId);
  if (!cart.items.length) throw new Error('Cart empty');

  // Several variants can belong to the same product, so stock must be checked
  // against the combined quantity rather than one cart line at a time.
  const quantitiesByProduct = new Map();
  for (const item of cart.items) {
    const current = quantitiesByProduct.get(item.productId) || {
      quantity: 0,
      productName: item.product.name,
    };
    current.quantity += item.quantity;
    quantitiesByProduct.set(item.productId, current);
  }

  const subtotal = cartService.computeTotal(cart);
  const shippingFee = Number(orderData.shippingFee) || 0;
  const total = subtotal + shippingFee;
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        total,
        subtotal,
        shippingFee,
        fiatCurrency: orderData.fiatCurrency || 'GBP',
        email: orderData.email || null,
        shippingMethod: orderData.shippingMethod || null,
        paymentMethod: orderData.paymentMethod,
        shippingName: orderData.shippingName,
        shippingCountry: orderData.shippingCountry,
        shippingStreet: orderData.shippingAddress || orderData.shippingStreet,
        shippingApt: orderData.shippingApt || null,
        shippingCity: orderData.shippingCity || '',
        shippingState: orderData.shippingState || null,
        shippingZip: orderData.shippingZip || null,
        notes: orderData.notes || null,
        refundAddress: orderData.refundAddress || null,
        items: {
          create: cart.items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            price: it.unitPrice,
            label: it.variant?.label || null,
          })),
        },
      },
      include: { items: { include: { product: true, variant: true } }, user: true },
    });

    // The stock condition and decrement happen in the same query, preventing
    // concurrent checkouts from taking stock below zero.
    for (const [productId, item] of quantitiesByProduct) {
      const result = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: item.quantity },
        },
        data: { 
          stock: { decrement: item.quantity },
          purchaseCount: { increment: item.quantity },
        },
      });

      if (result.count !== 1) {
        throw new Error(`Insufficient stock for ${item.productName}`);
      }
    }

    // Vide le panier
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  }, {
    // A hosted database can need more than Prisma's 5-second default when an
    // order contains several products. Both values remain configurable.
    maxWait: Number(process.env.DB_TRANSACTION_MAX_WAIT_MS || 10000),
    timeout: Number(process.env.DB_TRANSACTION_TIMEOUT_MS || 20000),
  });

  return order;
}

async function getOrder(orderId) {
  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: { items: { include: { product: true, variant: true } }, user: true },
  });
}

async function markProofReceived(orderId, proofMessage) {
  return prisma.order.update({
    where: { id: Number(orderId) },
    data: { proofMessage },
  });
}

async function setCryptoAmount(orderId, cryptoAmount) {
  return prisma.order.update({
    where: { id: Number(orderId) },
    data: { cryptoAmount: String(cryptoAmount) },
  });
}

module.exports = { createOrderFromCart, getOrder, markProofReceived, setCryptoAmount };
