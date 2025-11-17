// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS whitelist (add your Vercel URL after deploy)
const allowedOrigins = [
  'http://localhost:5173',               // Vite dev
  'http://localhost:3000',               // if you use other dev port
  // add your Vercel domain here, e.g.:
  // 'https://your-frontend.vercel.app'
];

// Use CORS with whitelist
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// serve uploads (note: Render's disk is ephemeral; for production use S3 or Cloudinary)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// simple health route for Render and uptime checks
app.get('/health', (req, res) => res.json({ ok: true }));

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

// Mount Routes (consistent API prefixes)
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/orders', adminOrderRoutes);

app.use('/api/user/auth', userAuthRoutes);
app.use('/api/user/products', userProductRoutes);
app.use('/api/user/categories', userCategoryRoutes);
app.use('/api/user/orders', userOrderRoutes);
app.use('/api/user/reviews', reviewRoutes);

// Generic 404 handler (optional)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Basic error handler (so server doesn't crash with thrown errors)
app.use((err, req, res, next) => {
  console.error(err && err.message ? err.message : err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
