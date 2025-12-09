const express = require('express');
const router = express.Router();
const Orders = require('../../model/orders');
const User = require('../../model/user');


router.post("/orders", async (req, res) => {
  try {
    const {
      userId,        
      mongoUserId,   
      ...rest
    } = req.body;

    // Save order in DB
    const order = new Orders({
      ...rest,
      userId,        
      mongoUserId,   
    });

    await order.save();

   
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


router.get("/orders/user/:clerkId", async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.params.clerkId });
    res.json(orders);
  } catch (err) {
    console.error("Fetch user orders failed:", err);
    res.status(500).json({ error: err.message });
  }
});


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
