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

  // A cart can contain several variants of the same product. Aggregate their
  // quantities for an accurate stock check and one update per product.
  const quantitiesByProduct = new Map();
  for (const item of cart.items) {
    quantitiesByProduct.set(
      item.productId,
      (quantitiesByProduct.get(item.productId) || 0) + item.quantity
    );
  }

  // Stock is managed globally on Product rather than on each variant.
  for (const [productId, quantity] of quantitiesByProduct) {
    const item = cart.items.find((cartItem) => cartItem.productId === productId);
    if (quantity > item.product.stock) {
      throw new Error(`Insufficient stock for ${item.product.name} (Max ${item.product.stock})`);
    }
  }

  const total = cartService.computeTotal(cart) + 10.00;
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        total,
        paymentMethod: orderData.paymentMethod,
        shippingName: orderData.shippingName,
        shippingCountry: orderData.shippingCountry,
        shippingStreet: orderData.shippingStreet,
        shippingApt: orderData.shippingApt || null,
        shippingCity: orderData.shippingCity,
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

    // Décrémente le stock du produit et augmente purchaseCount
    for (const [productId, quantity] of quantitiesByProduct) {
      await tx.product.update({
        where: { id: productId },
        data: { 
          stock: { decrement: quantity },
          purchaseCount: { increment: quantity }
        },
      });
    }

    // Vide le panier
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  }, {
    // The remote PostgreSQL proxy has noticeable latency. Prisma's default
    // five-second interactive transaction timeout is too short for checkout.
    maxWait: 30_000,
    timeout: 60_000,
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

module.exports = { createOrderFromCart, getOrder, markProofReceived };
