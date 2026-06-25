const express = require('express');
const router = express.Router();
const prisma = require('../db/client');

// Middleware to parse JSON bodies
router.use(express.json());

// --- CATEGORIES API ---

// List all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        children: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const newCategory = await prisma.category.create({
      data: {
        name,
        parentId: parentId ? Number(parentId) : null,
      },
    });
    res.json(newCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit category
router.put('/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, parentId } = req.body;

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name,
        parentId: parentId ? Number(parentId) : null,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.category.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCTS API ---

// List all products
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { id: 'desc' },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
router.post('/products', async (req, res) => {
  try {
    const { name, price, description, stock, image, categoryId, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (price === undefined) return res.status(400).json({ error: 'Price is required' });
    if (!categoryId) return res.status(400).json({ error: 'Category is required' });

    const newProduct = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        description: description || null,
        stock: parseInt(stock, 10) || 0,
        image: image || null,
        categoryId: Number(categoryId),
        active: active !== undefined ? Boolean(active) : true,
      },
    });
    res.json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit product
router.put('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, price, description, stock, image, categoryId, active } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        price: price !== undefined ? parseFloat(price) : undefined,
        description: description !== undefined ? description : undefined,
        stock: stock !== undefined ? parseInt(stock, 10) : undefined,
        image: image !== undefined ? image : undefined,
        categoryId: categoryId !== undefined ? Number(categoryId) : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- VARIANTS API ---

// Get variants for a product
router.get('/products/:id/variants', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(variants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a variant for a product
router.post('/products/:id/variants', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { label, price, sortOrder } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });
    if (price === undefined) return res.status(400).json({ error: 'Price is required' });

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        label,
        price: parseFloat(price),
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : 0,
      },
    });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a variant
router.put('/variants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { label, price, sortOrder } = req.body;
    const variant = await prisma.productVariant.update({
      where: { id },
      data: {
        label: label !== undefined ? label : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : undefined,
      },
    });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a variant
router.delete('/variants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.productVariant.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk save variants for a product (delete all existing, create new ones)
router.post('/products/:id/variants/bulk', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { variants } = req.body; // array of { label, price, sortOrder }
    if (!Array.isArray(variants)) return res.status(400).json({ error: 'variants must be an array' });

    await prisma.$transaction(async (tx) => {
      // Delete existing variants
      await tx.productVariant.deleteMany({ where: { productId } });
      // Create new ones
      if (variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v, i) => ({
            productId,
            label: v.label,
            price: parseFloat(v.price),
            sortOrder: v.sortOrder !== undefined ? parseInt(v.sortOrder, 10) : i,
          })),
        });
      }
    });

    const saved = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
