const express = require('express');
const router = express.Router();
const Product = require('../../model/products');
const upload = require('../../config/multer');
const path = require('path');
const fs = require('fs').promises;

// ✨ NEW: Handle both main images and color images
const uploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'colorImages', maxCount: 20 }
]);

// ✨ UPDATED: Create Product with Color Variants
router.post("/products", uploadFields, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      price, 
      stock, 
      category, 
      brand, 
      discount, 
      slug,
      colorsData // ✨ NEW
    } = req.body;

    // Handle main product images
    const images = req.files?.images 
      ? req.files.images.map(file => `/uploads/${file.filename}`) 
      : [];

    // ✨ NEW: Process color variants
    let colors = [];
    if (colorsData) {
      try {
        const parsedColorsData = JSON.parse(colorsData);
        const colorImages = req.files?.colorImages || [];
        let colorImageIndex = 0;

        colors = parsedColorsData.map((colorData) => {
          const colorImagePaths = [];

          if (colorData.existingImages && colorData.existingImages.length > 0) {
            colorImagePaths.push(...colorData.existingImages);
          }

          for (let i = 0; i < colorData.newImagesCount; i++) {
            if (colorImages[colorImageIndex]) {
              colorImagePaths.push(`/uploads/${colorImages[colorImageIndex].filename}`);
              colorImageIndex++;
            }
          }

          return {
            name: colorData.name,
            hex: colorData.hex,
            images: colorImagePaths,
          };
        });
      } catch (error) {
        console.error("Error parsing colors data:", error);
      }
    }

    const productData = {
      title,
      description,
      price,
      stock,
      category,
      brand,
      discount: discount || 0,
      slug,
      images,
    };

    if (colors.length > 0) {
      productData.colors = colors;
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({ 
      message: "Product added successfully", 
      product 
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(400).json({ error: error.message });
  }
});

// ✨ UPDATED: Update Product with Color Variants
router.put("/products/:id", uploadFields, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { 
      title, 
      description, 
      price, 
      stock, 
      category, 
      brand, 
      discount, 
      slug,
      existingImages,
      colorsData // ✨ NEW
    } = req.body;

    // Update basic fields
    if (title) product.title = title;
    if (description) product.description = description;
    if (price) product.price = price;
    if (stock) product.stock = stock;
    if (category) product.category = category;
    if (brand) product.brand = brand;
    if (discount !== undefined) product.discount = discount;
    if (slug) product.slug = slug;

    // Handle main images
    let mainImages = [];
    if (existingImages) {
      try {
        mainImages = JSON.parse(existingImages);
      } catch (error) {
        console.error("Error parsing existing images:", error);
      }
    }
    
    if (req.files?.images && req.files.images.length > 0) {
      const newImages = req.files.images.map(file => `/uploads/${file.filename}`);
      mainImages = [...mainImages, ...newImages];
    }

    // Delete removed main images
    const removedImages = product.images.filter(img => !mainImages.includes(img));
    for (const img of removedImages) {
      try {
        const imagePath = path.join(__dirname, '..', '..', img);
        await fs.unlink(imagePath);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }

    product.images = mainImages;

    // ✨ NEW: Process color variants
    if (colorsData) {
      try {
        const parsedColorsData = JSON.parse(colorsData);
        const colorImages = req.files?.colorImages || [];
        let colorImageIndex = 0;

        const colors = parsedColorsData.map((colorData) => {
          const colorImagePaths = [];

          if (colorData.existingImages && colorData.existingImages.length > 0) {
            colorImagePaths.push(...colorData.existingImages);
          }

          for (let i = 0; i < colorData.newImagesCount; i++) {
            if (colorImages[colorImageIndex]) {
              colorImagePaths.push(`/uploads/${colorImages[colorImageIndex].filename}`);
              colorImageIndex++;
            }
          }

          return {
            name: colorData.name,
            hex: colorData.hex,
            images: colorImagePaths,
          };
        });

        // Delete removed color images
        if (product.colors && product.colors.length > 0) {
          product.colors.forEach((oldColor) => {
            const stillExists = colors.some(
              (newColor) => newColor.name === oldColor.name
            );
            
            if (!stillExists) {
              oldColor.images.forEach(async (img) => {
                try {
                  const imagePath = path.join(__dirname, '..', '..', img);
                  await fs.unlink(imagePath);
                } catch (err) {
                  console.error("Error deleting color image:", err);
                }
              });
            } else {
              const newColor = colors.find(c => c.name === oldColor.name);
              const removedColorImages = oldColor.images.filter(
                img => !newColor.images.includes(img)
              );
              
              removedColorImages.forEach(async (img) => {
                try {
                  const imagePath = path.join(__dirname, '..', '..', img);
                  await fs.unlink(imagePath);
                } catch (err) {
                  console.error("Error deleting color image:", err);
                }
              });
            }
          });
        }

        product.colors = colors;
      } catch (error) {
        console.error("Error parsing colors data:", error);
      }
    } else {
      if (product.colors && product.colors.length > 0) {
        product.colors.forEach((color) => {
          color.images.forEach(async (img) => {
            try {
              const imagePath = path.join(__dirname, '..', '..', img);
              await fs.unlink(imagePath);
            } catch (err) {
              console.error("Error deleting color image:", err);
            }
          });
        });
        product.colors = [];
      }
    }

    await product.save();

    res.json({ 
      message: "Product updated successfully", 
      product 
    });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(400).json({ error: err.message });
  }
});

// ✨ UPDATED: Delete Product (with color images cleanup)
router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Delete main images
    for (const img of product.images) {
      try {
        const imagePath = path.join(__dirname, '..', '..', img);
        await fs.unlink(imagePath);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }

    // ✨ NEW: Delete color images
    if (product.colors && product.colors.length > 0) {
      for (const color of product.colors) {
        for (const img of color.images) {
          try {
            const imagePath = path.join(__dirname, '..', '..', img);
            await fs.unlink(imagePath);
          } catch (err) {
            console.error("Error deleting color image:", err);
          }
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: "Product deleted successfully", 
      product 
    });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all products
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate('category');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;