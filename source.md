# Backend Organized Code Files

## 📁 File Structure
```
project-root/
├── index.js
├── config/
│   ├── database.js
│   └── multer.js
├── middleware/
│   └── auth.js
├── utils/
│   └── tokenGenerator.js
├── routes/
│   ├── admin/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── product.routes.js
│   │   ├── category.routes.js
│   │   └── order.routes.js
│   └── user/
│       ├── auth.routes.js
│       ├── product.routes.js
│       ├── category.routes.js
│       └── order.routes.js
└── model/
```

---

## 📄 **index.js** (Main Server File - Clean)

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotENV = require('dotenv');
const connectDB = require('./config/database');

dotENV.config();

// Connect Database
connectDB();

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import Routes
const adminAuthRoutes = require('./routes/admin/auth.routes');
const adminUserRoutes = require('./routes/admin/user.routes');
const adminProductRoutes = require('./routes/admin/product.routes');
const adminCategoryRoutes = require('./routes/admin/category.routes');
const adminOrderRoutes = require('./routes/admin/order.routes');

const userAuthRoutes = require('./routes/user/auth.routes');
const userProductRoutes = require('./routes/user/product.routes');
const userCategoryRoutes = require('./routes/user/category.routes');
const userOrderRoutes = require('./routes/user/order.routes');

// Mount Routes
// Admin Routes
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/', adminProductRoutes);
app.use('/', adminCategoryRoutes);
app.use('/', adminOrderRoutes);

// User Routes
app.use('/', userAuthRoutes);
app.use('/', userProductRoutes);
app.use('/', userCategoryRoutes);
app.use('/', userOrderRoutes);

// Start Server
app.listen(PORT, () => console.log(`Port listening on ${PORT}`));
```

---

## 📄 **config/database.js**

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB connected');
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## 📄 **config/multer.js**

```javascript
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

module.exports = upload;
```

---

## 📄 **middleware/auth.js**

```javascript
const jwt = require('jsonwebtoken');
const User = require('../model/user');

// Verify JWT Token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Verify Admin Role
const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = { verifyToken, verifyAdmin };
```

---

## 📄 **utils/tokenGenerator.js**

```javascript
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
```

---

## 📄 **routes/admin/auth.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const User = require('../../model/user');
const generateToken = require('../../utils/tokenGenerator');
const { verifyToken, verifyAdmin } = require('../../middleware/auth');

// Admin Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const validRoles = ['admin', 'staff', 'superadmin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, staff, or superadmin' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({
      name,
      email,
      password, 
      role: role || 'admin',
      isEmailVerified: true,
      isActive: true,
      permissions: {
        canManageProducts: true,
        canManageOrders: true,
        canManageUsers: role === 'superadmin',
        canViewAnalytics: true,
      },
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== 'admin' && user.role !== 'staff' && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Admin access required.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Admin Profile
router.get('/profile', verifyToken, verifyAdmin, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

## 📄 **routes/admin/user.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const User = require('../../model/user');
const Orders = require('../../model/orders');
const { verifyToken, verifyAdmin } = require('../../middleware/auth');

// Get All Users (Admin Only)
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(query);

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const orders = await Orders.find({ userId: user._id });

        const totalOrders = orders.length;
        const totalSpent = orders.reduce(
          (sum, order) => sum + (order.pricing?.grandTotal || 0),
          0
        );

        return {
          ...user.toObject(),
          totalOrders,
          totalSpent,
        };
      })
    );

    res.json({
      users: enrichedUsers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Stats (Admin Only)
router.get('/users/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalAdmins = await User.countDocuments({ role: { $in: ['admin', 'staff', 'superadmin'] } });
    const activeUsers = await User.countDocuments({ role: 'user', isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    const newAdminsThisMonth = await User.countDocuments({
      role: { $in: ['admin', 'staff', 'superadmin'] },
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    res.json({
      totalUsers,
      totalAdmins,
      activeUsers,
      newUsersThisMonth,
      newAdminsThisMonth
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

## 📄 **routes/admin/product.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const Product = require('../../model/products');
const upload = require('../../config/multer');

// Create Product with Images
router.post("/products", upload.array("images", 5), async (req, res) => {
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
```

---

## 📄 **routes/admin/category.routes.js**

```javascript
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
```

---

## 📄 **routes/admin/order.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const Orders = require('../../model/orders');

// Get All Orders
router.get('/orders', async (req, res) => {
  const orders = await Orders.find();
  res.json(orders);
});

// Get Single Order by MongoDB _id
router.get("/orders/:id", async (req, res) => {
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

// Update Order Status by MongoDB _id
router.patch("/orders/:id/status", async (req, res) => {
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

// Update Order Status by orderId
router.put("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Orders.findOneAndUpdate(
      { orderId },
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

// Delete Order
router.delete("/orders/:id", async (req, res) => {
  try {
    const order = await Orders.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ message: "Order deleted successfully", order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

## 📄 **routes/user/auth.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const User = require('../../model/user');

// Get Mongo User by Clerk ID
router.get('/users/clerk/:clerkId', async (req, res) => {
  try {
    const { clerkId } = req.params;
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      profileImage: user.profileImage,
      totalOrders: user.totalOrders,
      totalSpent: user.totalSpent.toLocaleString("en-US", { style: "currency", currency: "USD" })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync Clerk User to Database
router.post('/api/users/sync', async (req, res) => {
  try {
    const { clerkId, email, name, profileImage } = req.body;
    if (!clerkId || !email) {
      return res.status(400).json({ error: 'ClerkId and email are required' });
    }

    let user = await User.findOne({ clerkId });

    if (user) {
      user.lastLogin = new Date();
      user.name = name || user.name;
      user.email = email;
      user.profileImage = profileImage || user.profileImage;
      await user.save();
    } else {
      user = new User({
        clerkId,
        email,
        name: name || 'User',
        profileImage: profileImage,
        role: 'user',
        isEmailVerified: true,
        isActive: true,
        lastLogin: new Date()
      });
      await user.save();
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        profileImage: user.profileImage,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Order Stats
router.patch('/api/users/:id/order-stats', async (req, res) => {
  try {
    const { orderAmount } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.totalOrders += 1;
    user.totalSpent += orderAmount;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

## 📄 **routes/user/product.routes.js**

```javascript
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
```

---

## 📄 **routes/user/category.routes.js**

```javascript
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
```

---

## 📄 **routes/user/order.routes.js**

```javascript
const express = require('express');
const router = express.Router();
const Orders = require('../../model/orders');
const User = require('../../model/user');

// Create Order
router.post("/orders", async (req, res) => {
  try {
    const order = new Orders(req.body);
    await order.save();

    if (order.userId && typeof order.pricing?.grandTotal === "number") {
      await User.findByIdAndUpdate(order.userId, {
        $inc: { 
          totalOrders: 1, 
          totalSpent: order.pricing.grandTotal
        }
      });
    }
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Orders for Specific User
router.get("/orders/user/:userId", async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.params.userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Order by orderId
router.get("/order/:orderId", async (req, res) => {
  try {
    const order = await Orders.findOne({ orderId: req.params.orderId });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## ✅ Summary

**This structure provides:**
- ✨ Clean, modular code organization
- 🔐 Separate admin and user route concerns
- 🧩 Reusable middleware and utilities
- 📦 Easy to maintain and scale
- 🎯 Single responsibility per file

**Your index.js is now just 40 lines instead of 600+!**