const express = require('express');
const router = express.Router();
const Product = require('../../model/products');
const upload = require('../../config/multer');

// NEW: Handle both main images and color images
const uploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'colorImages', maxCount: 20 }
]);


// Create Product with Images
router.post("/products", upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, price, stock, category, brand, discount, slug, colorsData } = req.body;

    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const product = new Product({ title, description, price, stock, category, brand, discount, slug, images });
    await product.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// Update Product
router.put("/products/:id", upload.array("images", 5), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    Object.keys(req.body).forEach((key) => {
      product[key] = req.body[key];
    });

    if (req.files && req.files.length > 0) {
      const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
      product.images = imagePaths;
    }

    await product.save();

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Delete Product
router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;