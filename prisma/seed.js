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

  // ── Root category ──
  const riz = await prisma.category.create({ data: { name: 'Riz' } });

  // ── Sub-categories ──
  const basmati = await prisma.category.create({ data: { name: 'Riz Basmati', parentId: riz.id } });
  const jasmin  = await prisma.category.create({ data: { name: 'Riz Jasmin', parentId: riz.id } });
  const parfume = await prisma.category.create({ data: { name: 'Riz Parfumé', parentId: riz.id } });
  const complet = await prisma.category.create({ data: { name: 'Riz Complet', parentId: riz.id } });
  const etuve   = await prisma.category.create({ data: { name: 'Riz Étuvé', parentId: riz.id } });
  const brise   = await prisma.category.create({ data: { name: 'Riz Brisé', parentId: riz.id } });
  const local   = await prisma.category.create({ data: { name: 'Riz Local', parentId: riz.id } });

  // ── Products with variants ──
  const products = [
    // --- Basmati ---
    {
      name: 'Riz Basmati Premium',
      description: 'Riz basmati long grain, parfumé, récolte 2025. Grain extra-fin sélectionné pour une saveur authentique et un arôme délicat.',
      stock: 200,
      categoryId: basmati.id,
      image: 'images/1.jpeg',
      rating: 9.5,
      purchaseCount: 34,
      isNew: false,
      variants: [
        { label: '1 kg', price: 4.50, sortOrder: 1 },
        { label: '5 kg', price: 18.00, sortOrder: 2 },
        { label: '10 kg', price: 32.00, sortOrder: 3 },
        { label: '25 kg', price: 72.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Basmati Gold',
      description: 'Sélection gold, grain extra-long vieilli 2 ans. Texture aérée et légère à la cuisson, parfait pour le biryani et le pilaf.',
      stock: 150,
      categoryId: basmati.id,
      image: 'images/2.jpeg',
      rating: 9.8,
      purchaseCount: 97,
      isNew: false,
      variants: [
        { label: '1 kg', price: 6.00, sortOrder: 1 },
        { label: '5 kg', price: 25.00, sortOrder: 2 },
        { label: '10 kg', price: 45.00, sortOrder: 3 },
        { label: '25 kg', price: 95.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Basmati Royal',
      description: 'Le summum du basmati. Grains de 8mm+, vieilli 3 ans en cave. Réservé aux connaisseurs exigeants.',
      stock: 80,
      categoryId: basmati.id,
      image: 'images/3.jpeg',
      rating: 9.9,
      purchaseCount: 12,
      isNew: true,
      variants: [
        { label: '1 kg', price: 8.00, sortOrder: 1 },
        { label: '5 kg', price: 35.00, sortOrder: 2 },
        { label: '10 kg', price: 60.00, sortOrder: 3 },
      ],
    },

    // --- Jasmin ---
    {
      name: 'Riz Jasmin Thaï Premium',
      description: 'Riz jasmin de Thaïlande, doux et parfumé. Grains tendres et légèrement collants, idéal pour la cuisine asiatique.',
      stock: 180,
      categoryId: jasmin.id,
      image: 'images/4.jpeg',
      rating: 9.2,
      purchaseCount: 56,
      isNew: false,
      variants: [
        { label: '1 kg', price: 4.00, sortOrder: 1 },
        { label: '5 kg', price: 16.00, sortOrder: 2 },
        { label: '10 kg', price: 28.00, sortOrder: 3 },
        { label: '25 kg', price: 60.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Jasmin Cambodge',
      description: 'Jasmin du Cambodge, saveur florale intense. Cultivé en agriculture raisonnée dans les rizières de Battambang.',
      stock: 100,
      categoryId: jasmin.id,
      image: 'images/5.jpeg',
      rating: 8.8,
      purchaseCount: 23,
      isNew: true,
      variants: [
        { label: '1 kg', price: 5.00, sortOrder: 1 },
        { label: '5 kg', price: 20.00, sortOrder: 2 },
        { label: '10 kg', price: 35.00, sortOrder: 3 },
      ],
    },

    // --- Parfumé ---
    {
      name: 'Riz Parfumé Tropical',
      description: 'Riz parfumé sélection tropicale, parfait pour plats épicés et currys. Arôme de pandanus naturel.',
      stock: 160,
      categoryId: parfume.id,
      image: 'images/6.jpeg',
      rating: 8.5,
      purchaseCount: 45,
      isNew: false,
      variants: [
        { label: '1 kg', price: 3.50, sortOrder: 1 },
        { label: '5 kg', price: 14.00, sortOrder: 2 },
        { label: '10 kg', price: 24.00, sortOrder: 3 },
        { label: '25 kg', price: 55.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Parfumé Sénégalais',
      description: 'Riz parfumé du Sénégal, idéal pour le thiéboudienne et les plats de fête. Grain moyen, très savoureux.',
      stock: 120,
      categoryId: parfume.id,
      image: 'images/7.jpeg',
      rating: 9.0,
      purchaseCount: 67,
      isNew: false,
      variants: [
        { label: '5 kg', price: 15.00, sortOrder: 1 },
        { label: '10 kg', price: 26.00, sortOrder: 2 },
        { label: '25 kg', price: 58.00, sortOrder: 3 },
        { label: '50 kg', price: 105.00, sortOrder: 4 },
      ],
    },

    // --- Complet ---
    {
      name: 'Riz Complet Bio',
      description: 'Riz complet biologique, riche en fibres et minéraux. Non blanchi, conserve toute sa valeur nutritionnelle.',
      stock: 90,
      categoryId: complet.id,
      image: 'images/8.jpeg',
      rating: 8.7,
      purchaseCount: 31,
      isNew: false,
      variants: [
        { label: '1 kg', price: 5.00, sortOrder: 1 },
        { label: '5 kg', price: 20.00, sortOrder: 2 },
        { label: '10 kg', price: 36.00, sortOrder: 3 },
      ],
    },
    {
      name: 'Riz Rouge Complet',
      description: 'Riz rouge complet, saveur de noisette prononcée. Riche en antioxydants et en fer. Texture ferme et rustique.',
      stock: 70,
      categoryId: complet.id,
      image: 'images/9.jpeg',
      rating: 9.1,
      purchaseCount: 19,
      isNew: true,
      variants: [
        { label: '1 kg', price: 6.00, sortOrder: 1 },
        { label: '5 kg', price: 25.00, sortOrder: 2 },
        { label: '10 kg', price: 42.00, sortOrder: 3 },
      ],
    },

    // --- Étuvé ---
    {
      name: 'Riz Étuvé Premium',
      description: 'Riz étuvé de qualité supérieure, grains parfaitement détachés à la cuisson. Ne colle jamais, résultat garanti.',
      stock: 200,
      categoryId: etuve.id,
      image: 'images/10.jpeg',
      rating: 8.9,
      purchaseCount: 78,
      isNew: false,
      variants: [
        { label: '1 kg', price: 3.50, sortOrder: 1 },
        { label: '5 kg', price: 13.00, sortOrder: 2 },
        { label: '10 kg', price: 22.00, sortOrder: 3 },
        { label: '25 kg', price: 48.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Étuvé Doré',
      description: 'Riz étuvé doré, enrichi en vitamines B. Cuisson rapide 12 minutes. Idéal pour le quotidien.',
      stock: 180,
      categoryId: etuve.id,
      image: 'images/11.jpeg',
      rating: 8.3,
      purchaseCount: 42,
      isNew: false,
      variants: [
        { label: '1 kg', price: 3.00, sortOrder: 1 },
        { label: '5 kg', price: 12.00, sortOrder: 2 },
        { label: '10 kg', price: 20.00, sortOrder: 3 },
        { label: '25 kg', price: 42.00, sortOrder: 4 },
      ],
    },

    // --- Brisé ---
    {
      name: 'Riz Brisé Thaï',
      description: 'Riz brisé thaïlandais, excellent rapport qualité/prix. Parfait pour les grandes familles et la restauration.',
      stock: 300,
      categoryId: brise.id,
      image: 'images/12.jpeg',
      rating: 8.0,
      purchaseCount: 124,
      isNew: false,
      variants: [
        { label: '5 kg', price: 8.00, sortOrder: 1 },
        { label: '10 kg', price: 14.00, sortOrder: 2 },
        { label: '25 kg', price: 32.00, sortOrder: 3 },
        { label: '50 kg', price: 58.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Brisé Indien',
      description: 'Riz brisé importé d\'Inde, grains courts et savoureux. Usage professionnel ou stock familial longue durée.',
      stock: 250,
      categoryId: brise.id,
      image: 'images/13.jpeg',
      rating: 7.8,
      purchaseCount: 89,
      isNew: false,
      variants: [
        { label: '10 kg', price: 12.00, sortOrder: 1 },
        { label: '25 kg', price: 28.00, sortOrder: 2 },
        { label: '50 kg', price: 50.00, sortOrder: 3 },
      ],
    },

    // --- Local ---
    {
      name: 'Riz Local Récolte Fraîche',
      description: 'Riz cultivé localement, récolte de la saison en cours. Frais, savoureux, et soutient l\'agriculture locale.',
      stock: 140,
      categoryId: local.id,
      image: 'images/14.jpeg',
      rating: 9.3,
      purchaseCount: 53,
      isNew: true,
      variants: [
        { label: '1 kg', price: 3.00, sortOrder: 1 },
        { label: '5 kg', price: 12.00, sortOrder: 2 },
        { label: '10 kg', price: 20.00, sortOrder: 3 },
        { label: '25 kg', price: 45.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Local Premium',
      description: 'Sélection premium du riz local, trié à la main. Grains uniformes et propres, qualité restaurant.',
      stock: 100,
      categoryId: local.id,
      image: 'images/15.jpeg',
      rating: 9.6,
      purchaseCount: 38,
      isNew: false,
      variants: [
        { label: '1 kg', price: 4.00, sortOrder: 1 },
        { label: '5 kg', price: 15.00, sortOrder: 2 },
        { label: '10 kg', price: 26.00, sortOrder: 3 },
        { label: '25 kg', price: 55.00, sortOrder: 4 },
      ],
    },
    {
      name: 'Riz Local Gros Grain',
      description: 'Riz local à gros grain, parfait pour les plats mijotés et les one-pot. Texture moelleuse et généreuse.',
      stock: 160,
      categoryId: local.id,
      image: 'images/16.jpeg',
      rating: 8.6,
      purchaseCount: 41,
      isNew: false,
      variants: [
        { label: '5 kg', price: 10.00, sortOrder: 1 },
        { label: '10 kg', price: 18.00, sortOrder: 2 },
        { label: '25 kg', price: 40.00, sortOrder: 3 },
        { label: '50 kg', price: 72.00, sortOrder: 4 },
      ],
    },
  ];

  for (const p of products) {
    const { variants, ...productData } = p;
    // Use first variant price as base price
    const basePrice = variants[0]?.price || 0;
    const product = await prisma.product.create({
      data: {
        ...productData,
        price: basePrice,
      },
    });
    // Create variants
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

  const total = await prisma.product.count();
  const cats = await prisma.category.count();
  const varCount = await prisma.productVariant.count();
  console.log(`✅ Seed terminé — ${cats} catégories, ${total} produits, ${varCount} variantes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
