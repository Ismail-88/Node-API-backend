const express = require('express');
const router = express.Router();
const Category = require('../../model/category');
const Product = require('../../model/products');

// Get All Categories
router.get('/categories', async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});

// Get Products by Category Slug
router.get("/categories/:slug", async (req, res) => {
  try {
    const categorySlug = req.params.slug.toLowerCase();

    const category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const products = await Product.find({ category: category._id }).populate("category");
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Error fetching products" });
  }
});

module.exports = router;