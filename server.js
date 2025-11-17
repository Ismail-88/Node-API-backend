const express = require('express');
const cors = require('cors');
const path = require('path');
const dotENV = require('dotenv');
const connectDB = require('./config/db');

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
const reviewRoutes = require('./routes/user/review.routes')
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
//new
app.use('/', reviewRoutes)

// Start Server
app.listen(PORT, () => console.log(`Port listening on ${PORT}`));