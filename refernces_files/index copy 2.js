const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose')

const Category = require('../model/category')
const Product = require('../model/products')
const Orders = require('../model/orders')
const dotENV = require('dotenv');
const slugify = require("slugify"); 
dotENV.config();
const multer = require("multer");
const path = require("path");
const PORT = process.env.PORT

mongoose.connect(process.env.MONGO_URI).then(()=>console.log('DB connected')).catch((err)=>console.log(err))


const app = express();
app.use(cors());
app.use(express.json())

// Setup Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
 
// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



app.post("/categories",async(req, res)=>{
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json(category)
    } catch (err) {
      res.status(400).json({ err: err.message });
    }
})

app.get('/categories', async(req, res)=>{
      const categories = await Category.find();
      res.json(categories)
})


// Replace your existing /products route with this 👇
app.post("/products", upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, price, stock, category, brand, discount, slug } = req.body;

    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const product = new Product({ title, description, price, stock, category, brand, discount, slug, images });
    await product.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});


// Get All Products (populate category details)
app.get("/products", async (req, res) => {
  const products = await Product.find().populate("category");
  res.json(products);
});

// Get Single Product
app.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ err: "Error fetching product" });
  }
});

 // Update product
// app.put("/products/:id", async (req, res) => {
//   try {
//     const product = await Product.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, runValidators: true }
//     );
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }
//     res.json(product);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

app.put(
  "/products/:id",
  upload.array("images", 5), // Multer middleware
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      // Update normal fields
      Object.keys(req.body).forEach((key) => {
        product[key] = req.body[key];
      });

      // Handle uploaded images
      if (req.files && req.files.length > 0) {
        const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
        product.images = imagePaths; // replace images entirely
      }

      await product.save();

      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);


// Delete product
app.delete("/products/:id", async (req, res) => {
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

// Get products by category slug (e.g. /categories/electronics)
app.get("/categories/:slug", async (req, res) => {
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

// Create order
app.post("/orders", async (req, res) => {
  try {
    const order = new Orders(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// Get orders for a specific user
app.get("/orders/user/:userId", async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.params.userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get order by orderId
app.get("/order/:orderId", async(req, res)=>{
  try {
    const order = await Orders.findOne({orderId: req.params.orderId });
  res.json(order);
  } catch (error) {
    res.status(500).json({error : error.message})
  }
  
})

app.get('/orders', async(req, res)=>{
      const orders = await Orders.find();
      res.json(orders)
})

// Update order status
app.patch("/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Orders.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get single order by ID (MongoDB _id)
app.get("/orders/:id", async (req, res) => {
  try {
    const order = await Orders.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update order status by orderId (used by Admin panel)
app.put("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Orders.findOneAndUpdate(
      { orderId }, // Find by custom orderId (ORD-...)
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ message: "Order status updated successfully", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






app.listen(PORT,()=>console.log(`Port listening on ${PORT}`))