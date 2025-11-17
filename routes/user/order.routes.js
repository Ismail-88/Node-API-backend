const express = require('express');
const router = express.Router();
const Orders = require('../../model/orders');
const User = require('../../model/user');

// ============================================
// CREATE ORDER
// ============================================
router.post("/orders", async (req, res) => {
  try {
    const {
      userId,        // Clerk ID
      mongoUserId,   // MongoDB _id
      ...rest
    } = req.body;

    // Save order in DB
    const order = new Orders({
      ...rest,
      userId,        // Clerk ID
      mongoUserId,   // MongoDB ID
    });

    await order.save();

    // Update user's stats using mongoUserId
    if (mongoUserId && typeof order.pricing?.grandTotal === "number") {
      await User.findByIdAndUpdate(mongoUserId, {
        $inc: {
          totalOrders: 1,
          totalSpent: order.pricing.grandTotal,
        }
      });
    }

    res.status(201).json(order);

  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// GET ORDERS FOR SPECIFIC USER (Clerk ID)
// ============================================
router.get("/orders/user/:clerkId", async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.params.clerkId });
    res.json(orders);
  } catch (err) {
    console.error("Fetch user orders failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET ORDER BY orderId
// ============================================
router.get("/order/:orderId", async (req, res) => {
  try {
    const order = await Orders.findOne({ orderId: req.params.orderId });
    res.json(order);
  } catch (error) {
    console.error("Fetch single order failed:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
