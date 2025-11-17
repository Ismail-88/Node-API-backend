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