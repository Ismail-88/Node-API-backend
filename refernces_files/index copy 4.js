const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken');
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


// ============= AUTHENTICATION MIDDLEWARE =============

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

// Generate JWT Token
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

// ============= AUTHENTICATION ROUTES =============

app.post('/api/admin/register', async (req, res) => {
  try {
    console.log('📝 Register attempt:', req.body);
    
    const { name, email, password, role } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate role
    const validRoles = ['admin', 'staff', 'superadmin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, staff, or superadmin' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create new admin user (password will be hashed by mongoose pre-save hook)
    const user = new User({
      name,
      email,
      password, // Will be auto-hashed by the model's pre-save middleware
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

    console.log('✅ Admin created successfully:', { name, email, role });

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
    console.error('❌ Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('👤 User found:', { 
      email: user.email, 
      role: user.role,
      hasPassword: !!user.password 
    });

    // Check if user has admin role
    if (user.role !== 'admin' && user.role !== 'staff' && user.role !== 'superadmin') {
      console.log('❌ Not an admin:', user.role);
      return res.status(403).json({ error: 'Access denied. Admin access required.' });
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account deactivated');
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Compare password using the model's method
    const isMatch = await user.comparePassword(password);
    
    console.log('🔑 Password match:', isMatch);

    if (!isMatch) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    console.log('✅ Login successful');

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
    console.error('❌ Login error:', err);
    res.status(500).json({ error: err.message });
  }
});



// Sync Clerk User
// ✅ Sync Clerk User to Database
app.post('/api/users/sync', async (req, res) => {
  try {
    console.log('🔄 User sync attempt:', req.body);
    
    const { clerkId, email, name, profileImage } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({ error: 'ClerkId and email are required' });
    }

    let user = await User.findOne({ clerkId });

    if (user) {
      // Update existing user
      user.name = name || user.name;
      user.email = email;
      user.profileImage = profileImage || user.profileImage;
      user.lastLogin = new Date();
      await user.save();
      
      console.log('✅ User updated:', email);
    } else {
      // Check if email is already used by an admin
      const existingEmail = await User.findOne({ email });
      if (existingEmail && existingEmail.role !== 'user') {
        console.log('❌ Email already used by admin:', email);
        return res.status(400).json({ 
          error: 'This email is already registered as an admin account' 
        });
      }

      // Create new regular user
      user = new User({
        clerkId,
        email,
        name: name || 'User',
        profileImage: profileImage || 'https://via.placeholder.com/150',
        role: 'user',
        isEmailVerified: true,
        isActive: true,
        lastLogin: new Date()
      });
      
      await user.save();
      
      console.log('✅ New user created:', email);
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error('❌ User sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Admin Profile
app.get('/api/admin/profile', verifyToken, verifyAdmin, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Users (Admin Only)
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
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

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Stats (Admin Only)
app.get('/api/admin/users/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalAdmins = await User.countDocuments({ 
      role: { $in: ['admin', 'staff', 'superadmin'] } 
    });
    const activeUsers = await User.countDocuments({ isActive: true, role: 'user' });
    const newUsersThisMonth = await User.countDocuments({
      role: 'user',
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    res.json({
      totalUsers,
      totalAdmins,
      activeUsers,
      newUsersThisMonth
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Order Stats
app.patch('/api/users/:id/order-stats', async (req, res) => {
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