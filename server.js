// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration - Fixed trailing slash
const allowedOrigins = [
  "http://localhost:5173",                
  "http://127.0.0.1:5173",                
  "https://ecommerce-reacts.vercel.app"  // ← Removed trailing /
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept"
    );
  }
  if (req.method === "OPTIONS") {
    if (req.headers["access-control-request-private-network"]) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    return res.sendStatus(204);
  }
  next();
});

// Middleware
app.use(express.json());

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => res.json({ ok: true }));

// Root endpoint - helpful for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'ShopSphere API is running!',
    endpoints: {
      admin: [
        '/api/admin/auth',
        '/api/admin/users',
        '/api/admin/products',
        '/api/admin/categories',
        '/api/admin/orders'
      ],
      user: [
        '/api/user/auth',
        '/api/user/products',
        '/api/user/categories',
        '/api/user/orders',
        '/api/user/reviews'
      ]
    }
  });
});

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
const reviewRoutes = require('./routes/user/review.routes');

// Mount Admin Routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/orders', adminOrderRoutes);

// Mount User Routes
app.use('/api/user/auth', userAuthRoutes);
app.use('/api/user/products', userProductRoutes);
app.use('/api/user/categories', userCategoryRoutes);
app.use('/api/user/orders', userOrderRoutes);
app.use('/api/user/reviews', reviewRoutes);

// 404 Handler - Must be after all routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: '/api/user/products, /api/user/categories, /api/user/orders'
  });
});

// Error Handler - Must be last
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message || err);
  res.status(err.status || 500).json({ 
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});