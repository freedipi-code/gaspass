const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Reset (dev only)
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // --- Root Categories ---
  const flowers = await prisma.category.create({ data: { name: 'FLOWERS' } });
  const extracts = await prisma.category.create({ data: { name: 'EXTRACTS' } });
  const hash = await prisma.category.create({ data: { name: 'HASH' } });
  const edibles = await prisma.category.create({ data: { name: 'EDIBLES' } });
  const vapes = await prisma.category.create({ data: { name: 'VAPES/CARTS' } });
  const accessories = await prisma.category.create({ data: { name: 'ACCESSORIES' } });

  // --- Sub-categories under FLOWERS ---
  const ukTopshelf = await prisma.category.create({ data: { name: 'UK Topshelf 🇬🇧 🇬🇧', parentId: flowers.id } });
  const usaExotics = await prisma.category.create({ data: { name: 'USA Exotics 🇺🇸 🇺🇸', parentId: flowers.id } });
  const dawgsHazes = await prisma.category.create({ data: { name: 'Dawgs / Hazes', parentId: flowers.id } });
  const piknmix4 = await prisma.category.create({ data: { name: 'PikNMix 4 x Strains', parentId: flowers.id } });
  const piknmix8 = await prisma.category.create({ data: { name: 'PikNMix 8 x Strains', parentId: flowers.id } });
  const brandedFlowers = await prisma.category.create({ data: { name: 'Branded Flowers', parentId: flowers.id } });
  const usaMids = await prisma.category.create({ data: { name: 'USA Mids 🇺🇸', parentId: flowers.id } });

  // --- Products in UK Topshelf ---
  const productsData = [
    {
      name: 'Zour Diesel',
      description: 'Zour Diesel is a hybrid strain from a cross of Zkittlez x Sour Diesel with two multi-award winning parent strains that each offer unique flavors and uplifting, happy effects. Zour Diesel offers the best of citrus, sweet, and gas worlds, with a focused euphoria that also tackles body aches.',
      stock: 100,
      categoryId: ukTopshelf.id,
      image: 'images/1.jpeg',
      rating: 9.5,
      purchaseCount: 15,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
        { label: '7 G', price: 50.00, sortOrder: 2 },
        { label: '14 G', price: 90.00, sortOrder: 3 },
        { label: '28 G', price: 170.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Rainbow Beltz',
      description: 'Rainbow Beltz is an indica-dominant hybrid strain. Offers sweet, fruity candy flavors and deeply relaxing effects.',
      stock: 100,
      categoryId: ukTopshelf.id,
      image: 'images/2.jpeg',
      rating: 9.2,
      purchaseCount: 10,
      isNew: true,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
        { label: '7 G', price: 50.00, sortOrder: 2 },
      ],
    },
    {
      name: 'Blue Cheese',
      description: 'Classic UK strain known for its heavy body stone and distinct cheesy, sweet berry aroma.',
      stock: 50,
      categoryId: ukTopshelf.id,
      image: 'images/3.jpeg',
      rating: 9.0,
      purchaseCount: 8,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
    {
      name: 'Divine Jelly',
      description: 'Exquisite strain with a sweet jelly and gassy flavor profile. Provides a balanced, uplifting high.',
      stock: 80,
      categoryId: ukTopshelf.id,
      image: 'images/4.jpeg',
      rating: 9.4,
      purchaseCount: 12,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
    {
      name: 'Tizer',
      description: 'Zesty and energetic strain. Ideal for daytime usage and creative tasks.',
      stock: 60,
      categoryId: ukTopshelf.id,
      image: 'images/5.jpeg',
      rating: 8.8,
      purchaseCount: 4,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
    {
      name: 'Sherbalato',
      description: 'Cross of Sunset Sherbert and Gelato. Sweet, creamy gelato taste with a heavy body buzz.',
      stock: 75,
      categoryId: ukTopshelf.id,
      rating: 9.3,
      purchaseCount: 19,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
    {
      name: 'Rubix',
      description: 'A puzzle of flavors. Complex piney, gassy, and fruity notes. Euphoric and relaxing.',
      stock: 90,
      categoryId: ukTopshelf.id,
      rating: 9.1,
      purchaseCount: 22,
      isNew: false,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
    {
      name: 'Britscotti',
      description: 'UK grown Biscotti. Gassy, doughy, sweet cookie notes. Extremely potent, not for beginners.',
      stock: 40,
      categoryId: ukTopshelf.id,
      rating: 9.6,
      purchaseCount: 30,
      isNew: true,
      variants: [
        { label: '3.5 G', price: 30.00, sortOrder: 1 },
      ],
    },
  ];

  for (const p of productsData) {
    const { variants, ...productData } = p;
    const basePrice = variants[0]?.price || 0;
    const product = await prisma.product.create({
      data: {
        ...productData,
        price: basePrice,
      },
    });
    for (const v of variants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          label: v.label,
          price: v.price,
          sortOrder: v.sortOrder,
        },
      });
    }
  }

  // Add a dummy product for other categories to avoid zero counts
  await prisma.product.create({
    data: {
      name: 'Gelato Exotic',
      price: 50.00,
      stock: 50,
      categoryId: usaExotics.id,
      description: 'USA Exotic',
    }
  });

  const total = await prisma.product.count();
  const cats = await prisma.category.count();
  console.log(`✅ Seed Completed: ${cats} categories, ${total} products created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
