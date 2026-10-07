const express = require('express');
const crypto = require('crypto');
const prisma = require('./db/client');
const config = require('./config');
const cryptoService = require('./services/crypto.service');
const notifyService = require('./services/notify.service');

const router = express.Router();

router.use(express.json({ limit: '100kb' }));

function requireAdult(req, res, next) {
  if (req.get('x-age-confirmed') !== 'true') {
    return res.status(403).json({ error: 'You must confirm that you are 21 or older.' });
  }
  return next();
}

function cleanText(value, maxLength, required = false) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (required && !text) throw new Error('All required fields must be completed.');
  return text.slice(0, maxLength) || null;
}

function formatCryptoAmount(amount, paymentMethod) {
  return amount.toFixed(paymentMethod === 'XMR' ? 12 : 8);
}

function buildPaymentUri(paymentMethod, walletAddress, amount) {
  return paymentMethod === 'XMR'
    ? `monero:${walletAddress}?tx_amount=${amount}`
    : `bitcoin:${walletAddress}?amount=${amount}`;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function storefrontRating(productId, rating) {
  const raw = Number(rating) || 0;
  const normalized = raw > 5 ? raw / 2 : raw;
  if (normalized > 0) return Number(Math.min(5, Math.max(3.8, normalized)).toFixed(1));
  const seeded = ((Number(productId) * 9301 + 49297) % 233280) / 233280;
  return Number((3.8 + seeded * 1.2).toFixed(1));
}

function storefrontReviewCount(productId, purchaseCount) {
  return Math.max(Number(purchaseCount) || 0, 18 + ((Number(productId) * 47) % 283));
}

const REVIEW_SAMPLES = Object.freeze([
  { author: 'Alex M.', rating: 5, comment: 'Excellent quality and very discreet packaging. Everything arrived exactly as described.' },
  { author: 'Jordan T.', rating: 5, comment: 'Smooth ordering experience, quick dispatch and great communication throughout.' },
  { author: 'Chris R.', rating: 4.5, comment: 'Fresh product, consistent quality and a straightforward checkout process.' },
  { author: 'Taylor B.', rating: 5, comment: 'One of my favorite recent picks. The quality really stands out.' },
  { author: 'Morgan L.', rating: 4.5, comment: 'Fast, discreet and reliable. I would happily order this one again.' },
  { author: 'Jamie K.', rating: 5, comment: 'The product matched the description perfectly and arrived in great condition.' },
  { author: 'Sam D.', rating: 4, comment: 'Very solid selection and helpful service. The whole process felt secure.' },
  { author: 'Casey N.', rating: 5, comment: 'Premium quality from start to finish. Definitely worth trying.' },
  { author: 'Riley P.', rating: 4.5, comment: 'Great consistency and careful packaging. Delivery was right on time.' },
  { author: 'Avery S.', rating: 5, comment: 'Easy checkout, private payment and a product I would recommend.' },
  { author: 'Drew H.', rating: 4.5, comment: 'A dependable choice with excellent presentation and freshness.' },
  { author: 'Cameron W.', rating: 5, comment: 'Really impressed by the quality. Canna Express delivered again.' },
  { author: 'Harper J.', rating: 4.2, comment: 'The ordering flow was simple and the product quality was consistent throughout.' },
  { author: 'Quinn A.', rating: 3.9, comment: 'A good everyday option with discreet packaging and dependable delivery.' },
  { author: 'Reese F.', rating: 4.7, comment: 'Fresh, carefully packed and exactly what I expected from the description.' },
  { author: 'Parker V.', rating: 4.4, comment: 'Very pleased with the overall experience and the product presentation.' },
  { author: 'Rowan C.', rating: 4.8, comment: 'Excellent consistency and a secure checkout process. I would order again.' },
  { author: 'Skyler G.', rating: 4.1, comment: 'Reliable quality, fair value and helpful updates from order to delivery.' },
  { author: 'Emerson B.', rating: 3.8, comment: 'Solid product and smooth service. Everything arrived safely and discreetly.' },
  { author: 'Finley R.', rating: 4.6, comment: 'The freshness and attention to packaging made this a standout purchase.' },
  { author: 'Dakota M.', rating: 4.3, comment: 'A dependable selection with accurate details and a straightforward payment flow.' },
  { author: 'Sage T.', rating: 4.9, comment: 'Premium quality and fast handling. This one easily earned a place among my favorites.' },
  { author: 'Blake N.', rating: 4, comment: 'Everything worked as expected, from private payment to discreet arrival.' },
  { author: 'Kendall P.', rating: 4.5, comment: 'Well presented, consistent and delivered with care. A very positive experience.' },
]);

router.get('/catalog', requireAdult, async (_req, res) => {
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { products: { some: { active: true, stock: { gt: 0 } } } },
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { active: true, stock: { gt: 0 } },
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
          description: true,
          stock: true,
          rating: true,
          purchaseCount: true,
          isNew: true,
          category: { select: { id: true, name: true } },
          variants: {
            select: { id: true, label: true, price: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ isNew: 'desc' }, { purchaseCount: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const storefrontProducts = products.map((product) => ({
      ...product,
      rating: storefrontRating(product.id, product.rating),
      reviewCount: storefrontReviewCount(product.id, product.purchaseCount),
    }));

    return res.json({ categories, products: storefrontProducts });
  } catch (error) {
    console.error('Storefront catalog error:', error.message);
    return res.status(500).json({ error: 'The catalog is temporarily unavailable.' });
  }
});

router.get('/reviews', requireAdult, async (_req, res) => {
  try {
    const [products, storedReviews] = await Promise.all([
      prisma.product.findMany({
        where: { active: true, stock: { gt: 0 } },
        select: {
          id: true,
          name: true,
          image: true,
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.review.findMany({
        include: {
          product: { select: { id: true, name: true, image: true, category: { select: { id: true, name: true } } } },
          user: { select: { fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const targetReviewCount = 30;
    const reviews = shuffled(storedReviews).slice(0, targetReviewCount).map((review) => ({
      id: `db-${review.id}`,
      author: review.user.fullName || review.user.username || 'Verified customer',
      rating: Math.min(5, Math.max(3.8, review.rating > 5 ? review.rating / 2 : review.rating)),
      comment: review.comment || 'A great product with quality that matched my expectations.',
      date: review.createdAt,
      product: review.product,
      source: 'customer',
    }));

    if (reviews.length < targetReviewCount && products.length) {
      const selectedProducts = shuffled(products);
      const samples = shuffled(REVIEW_SAMPLES);
      const missing = targetReviewCount - reviews.length;
      for (let index = 0; index < missing; index += 1) {
        const sample = samples[index % samples.length];
        const daysAgo = 4 + Math.floor(Math.random() * 120);
        reviews.push({
          id: `sample-${index}-${selectedProducts[index % selectedProducts.length].id}`,
          ...sample,
          date: new Date(Date.now() - daysAgo * 86400000),
          product: selectedProducts[index % selectedProducts.length],
          source: 'sample',
        });
      }
    }

    res.set('Cache-Control', 'no-store');
    return res.json({ reviews: shuffled(reviews), total: storedReviews.length });
  } catch (error) {
    console.error('Storefront reviews error:', error.message);
    return res.status(500).json({ error: 'Reviews are temporarily unavailable.' });
  }
});

router.post('/orders', requireAdult, async (req, res) => {
  try {
    const { browserId, items, shipping = {}, paymentMethod, refundAddress, notes } = req.body || {};
    if (!/^[a-f0-9-]{20,64}$/i.test(String(browserId || ''))) {
      return res.status(400).json({ error: 'Invalid session identifier.' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: 'Your cart is empty or invalid.' });
    }
    if (!['BTC', 'XMR'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }

    const walletAddress = paymentMethod === 'BTC' ? config.wallets.btc : config.wallets.xmr;
    if (!walletAddress) {
      return res.status(503).json({ error: `${paymentMethod} payments are temporarily unavailable.` });
    }

    const customer = {
      name: cleanText(shipping.name, 120, true),
      country: cleanText(shipping.country, 80, true),
      street: cleanText(shipping.street, 180, true),
      apt: cleanText(shipping.apt, 80),
      city: cleanText(shipping.city, 100, true),
      state: cleanText(shipping.state, 100),
      zip: cleanText(shipping.zip, 24),
      notes: cleanText(notes, 500),
      refundAddress: cleanText(refundAddress, 200, true),
    };

    const normalized = new Map();
    for (const raw of items) {
      const productId = Number(raw.productId);
      const variantId = raw.variantId == null ? null : Number(raw.variantId);
      const quantity = Number(raw.quantity);
      const strain = cleanText(raw.strain, 80);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ error: 'An item in your cart is invalid.' });
      }
      const key = `${productId}:${variantId ?? 'base'}:${strain || 'no-strain'}`;
      const previous = normalized.get(key);
      normalized.set(key, { productId, variantId, strain, quantity: (previous?.quantity || 0) + quantity });
    }
    const orderItemsInput = [...normalized.values()];
    const productIds = [...new Set(orderItemsInput.map((item) => item.productId))];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { variants: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      return res.status(409).json({ error: 'A product in your cart is no longer available.' });
    }

    const quantitiesByProduct = new Map();
    const pricedItems = orderItemsInput.map((item) => {
      const product = productsById.get(item.productId);
      const variant = item.variantId == null
        ? null
        : product.variants.find((entry) => entry.id === item.variantId);
      if (item.variantId != null && !variant) throw new Error(`A variant of ${product.name} is no longer available.`);
      quantitiesByProduct.set(product.id, (quantitiesByProduct.get(product.id) || 0) + item.quantity);
      return {
        productId: product.id,
        variantId: variant?.id || null,
        quantity: item.quantity,
        price: variant?.price ?? product.price,
        label: [variant?.label, item.strain ? `Strain: ${item.strain}` : null].filter(Boolean).join(' · ') || null,
      };
    });

    for (const [productId, quantity] of quantitiesByProduct) {
      if (productsById.get(productId).stock < quantity) {
        return res.status(409).json({ error: `Insufficient stock for ${productsById.get(productId).name}.` });
      }
    }

    const total = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cryptoAmount = formatCryptoAmount(
      await cryptoService.convertUsdToCrypto(total, paymentMethod),
      paymentMethod,
    );

    const order = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { telegramId: `web:${browserId}` },
        create: { telegramId: `web:${browserId}`, fullName: customer.name },
        update: { fullName: customer.name },
      });

      for (const [productId, quantity] of quantitiesByProduct) {
        const updated = await tx.product.updateMany({
          where: { id: productId, active: true, stock: { gte: quantity } },
          data: { stock: { decrement: quantity }, purchaseCount: { increment: quantity } },
        });
        if (updated.count !== 1) throw new Error(`Insufficient stock for ${productsById.get(productId).name}.`);
      }

      return tx.order.create({
        data: {
          orderNumber: `WEB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          userId: user.id,
          total,
          paymentMethod,
          shippingName: customer.name,
          shippingCountry: customer.country,
          shippingStreet: customer.street,
          shippingApt: customer.apt,
          shippingCity: customer.city,
          shippingState: customer.state,
          shippingZip: customer.zip,
          notes: customer.notes,
          refundAddress: customer.refundAddress,
          items: { create: pricedItems },
        },
        include: { items: { include: { product: true, variant: true } }, user: true },
      });
    }, { maxWait: 60000, timeout: 120000 });

    const paymentUri = buildPaymentUri(paymentMethod, walletAddress, cryptoAmount);
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(paymentUri)}&size=420&margin=2`;
    res.status(201).json({
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod,
      walletAddress,
      cryptoAmount,
      paymentUri,
      qrCodeUrl,
      expiresInMinutes: 30,
    });

    const bot = req.app.locals.bot;
    if (bot) {
      notifyService.notifyNewOrder(bot, order, { from: { username: 'web_order' } });
    }
  } catch (error) {
    console.error('Storefront checkout error:', error.message);
    const status = /All required fields/.test(error.message)
      ? 400
      : (/no longer available|Insufficient stock/.test(error.message) ? 409 : 500);
    return res.status(status).json({ error: status === 500 ? 'The order could not be created. Please try again.' : error.message });
  }
});

router.get('/account', requireAdult, async (req, res) => {
  try {
    const browserId = String(req.query.browserId || '');
    if (!/^[a-f0-9-]{20,64}$/i.test(browserId)) {
      return res.status(400).json({ error: 'Invalid session identifier.' });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: `web:${browserId}` },
      select: {
        fullName: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            orderNumber: true,
            total: true,
            paymentMethod: true,
            status: true,
            proofMessage: true,
            createdAt: true,
            shippingName: true,
            shippingCountry: true,
            shippingStreet: true,
            shippingApt: true,
            shippingCity: true,
            shippingState: true,
            shippingZip: true,
            items: {
              select: {
                quantity: true,
                price: true,
                label: true,
                product: { select: { name: true, image: true } },
              },
            },
          },
        },
      },
    });

    const orders = user?.orders || [];
    const latest = orders[0];
    return res.json({
      profile: {
        fullName: user?.fullName || null,
        shipping: latest ? {
          name: latest.shippingName,
          country: latest.shippingCountry,
          street: latest.shippingStreet,
          apt: latest.shippingApt,
          city: latest.shippingCity,
          state: latest.shippingState,
          zip: latest.shippingZip,
        } : null,
      },
      summary: {
        totalOrders: orders.length,
        pendingOrders: orders.filter((order) => order.status === 'pending').length,
        completedOrders: orders.filter((order) => ['paid', 'shipped'].includes(order.status)).length,
        totalSpent: orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0),
      },
      orders: orders.map((order) => ({
        ...order,
        proofReceived: Boolean(order.proofMessage),
        proofMessage: undefined,
      })),
    });
  } catch (error) {
    console.error('Storefront account error:', error.message);
    return res.status(500).json({ error: 'Your customer space is temporarily unavailable.' });
  }
});

router.post('/orders/:orderNumber/proof', requireAdult, async (req, res) => {
  try {
    const browserId = String(req.body?.browserId || '');
    const proof = cleanText(req.body?.proof, 500, true);
    const order = await prisma.order.findFirst({
      where: { orderNumber: req.params.orderNumber, user: { telegramId: `web:${browserId}` } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    await prisma.order.update({ where: { id: order.id }, data: { proofMessage: proof } });
    const bot = req.app.locals.bot;
    if (bot) {
      bot.telegram.sendMessage(
        config.adminId,
        `📎 Web payment proof received for <b>${notifyService.escapeHtml(order.orderNumber)}</b>\n<code>${notifyService.escapeHtml(proof)}</code>`,
        { parse_mode: 'HTML' },
      ).catch((error) => console.error('Web proof notification failed:', error.message));
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid payment proof.' });
  }
});

module.exports = router;
