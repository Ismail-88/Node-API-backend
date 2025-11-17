const express = require('express');
const router = express.Router();
const Product = require('../../model/products');

// Get All Products
router.get("/products", async (req, res) => {
  const products = await Product.find().populate("category");
  res.json(products);
});

// Get Single Product
router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ err: "Error fetching product" });
  }
});

module.exports = router;