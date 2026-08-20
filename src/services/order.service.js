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

  // Skip stock check since we removed stock from variant for now
  // We just assume stock is infinite or managed globally
  // Wait, stock is on the Product. Let's check Product stock.
  for (const it of cart.items) {
    if (it.quantity > it.product.stock) {
      throw new Error(`Insufficient stock for ${it.product.name} (Max ${it.product.stock})`);
    }
  }

  const total = cartService.computeTotal(cart);
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
    for (const it of cart.items) {
      await tx.product.update({
        where: { id: it.productId },
        data: { 
          stock: { decrement: it.quantity },
          purchaseCount: { increment: it.quantity }
        },
      });
    }

    // Vide le panier
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
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
