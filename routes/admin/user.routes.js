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