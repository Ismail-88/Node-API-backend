const express = require('express');
const router = express.Router();
const Category = require('../../model/category');

// Create Category
router.post("/categories", async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ err: err.message });
  }
});

module.exports = router;