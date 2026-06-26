const { PrismaClient: PostgresPrismaClient } = require('@prisma/client');
const { PrismaClient: SqlitePrismaClient } = require('../generated/sqlite-client');

const pg = new PostgresPrismaClient();

// IMPORTANT:
// Cette URL doit pointer vers ton fichier SQLite local.
const sqlite = new SqlitePrismaClient({
  datasources: {
    db: {
      url: 'file:../prisma/dev.db',
    },
  },
});

async function main() {
  console.log('📥 Lecture de la base SQLite...');

  const [
    categories,
    products,
    variants,
    users,
    carts,
    cartItems,
    orders,
    orderItems,
    reviews,
  ] = await Promise.all([
    sqlite.category.findMany(),
    sqlite.product.findMany(),
    sqlite.productVariant.findMany(),
    sqlite.user.findMany(),
    sqlite.cart.findMany(),
    sqlite.cartItem.findMany(),
    sqlite.order.findMany(),
    sqlite.orderItem.findMany(),
    sqlite.review.findMany(),
  ]);

  console.log(`Catégories : ${categories.length}`);
  console.log(`Produits : ${products.length}`);
  console.log(`Variantes : ${variants.length}`);
  console.log(`Utilisateurs : ${users.length}`);
  console.log(`Commandes : ${orders.length}`);

  console.log('📤 Copie vers PostgreSQL...');

  // Ordre important à cause des relations.
  for (const category of categories) {
    await pg.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const product of products) {
    await pg.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }

  for (const variant of variants) {
    await pg.productVariant.upsert({
      where: { id: variant.id },
      update: variant,
      create: variant,
    });
  }

  for (const user of users) {
    await pg.user.upsert({
      where: { telegramId: user.telegramId },
      update: {
        username: user.username,
        fullName: user.fullName,
      },
      create: user,
    });
  }

  for (const cart of carts) {
    await pg.cart.upsert({
      where: { userId: cart.userId },
      update: {
        updatedAt: cart.updatedAt,
      },
      create: cart,
    });
  }

  for (const cartItem of cartItems) {
    await pg.cartItem.upsert({
      where: { id: cartItem.id },
      update: cartItem,
      create: cartItem,
    });
  }

  for (const order of orders) {
    await pg.order.upsert({
      where: { orderNumber: order.orderNumber },
      update: {
        total: order.total,
        paymentMethod: order.paymentMethod,
        status: order.status,
        shippingName: order.shippingName,
        shippingCountry: order.shippingCountry,
        shippingStreet: order.shippingStreet,
        shippingApt: order.shippingApt,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingZip: order.shippingZip,
        notes: order.notes,
        refundAddress: order.refundAddress,
        proofMessage: order.proofMessage,
      },
      create: order,
    });
  }

  for (const orderItem of orderItems) {
    await pg.orderItem.upsert({
      where: { id: orderItem.id },
      update: orderItem,
      create: orderItem,
    });
  }

  for (const review of reviews) {
    await pg.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    });
  }

  console.log('✅ Migration terminée avec succès.');
}

main()
  .catch((error) => {
    console.error('❌ Erreur pendant la migration :', error);
    process.exit(1);
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });

