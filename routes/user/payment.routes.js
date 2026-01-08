// routes/user/payment.routes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const razorpayInstance = require('../../config/razorpay');
const Order = require('../../model/orders');

// Create Razorpay Order
// Note: The route is '/create-order' but will be accessed as '/api/payment/create-order'
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, orderData } = req.body;

    console.log('Received payment request:', { amount, currency, orderData }); // Debug log

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1 // Auto capture
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Save order to database with pending status
    const order = new Order({
      userId: orderData.userId,
      orderId: razorpayOrder.id,
      orderDate: new Date(),
      status: 'Pending',
      items: orderData.items,
      shippingInfo: orderData.shippingInfo,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      pricing: {
        subtotal: orderData.pricing.subtotal,
        deliveryFee: orderData.pricing.deliveryFee,
        handlingFee: orderData.pricing.handlingFee,
        grandTotal: amount
      }
    });

    await order.save();

    console.log('Order created successfully:', order._id); // Debug log

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      dbOrderId: order._id
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
});

// Verify Payment
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      dbOrderId
    } = req.body;

    console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id }); // Debug log

    // Create signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    // Verify signature
    if (razorpay_signature === expectedSign) {
      // Update order status in database
      const order = await Order.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          status: 'Processing',
          paymentId: razorpay_payment_id,
          paymentStatus: 'paid',
          paidAt: new Date()
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      console.log('Payment verified successfully:', order._id); // Debug log

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        order: {
          id: order._id,
          orderId: order.orderId,
          paymentId: razorpay_payment_id,
          status: order.status
        }
      });
    } else {
      // Payment verification failed
      await Order.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          status: 'Cancelled',
          paymentStatus: 'failed'
        }
      );

      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
});

// Handle COD Orders
router.post('/cod-order', async (req, res) => {
  try {
    const { orderData } = req.body;

    console.log('Creating COD order:', orderData); // Debug log

    const order = new Order({
      userId: orderData.userId,
      orderId: `COD_${Date.now()}`,
      orderDate: new Date(),
      status: 'Pending',
      items: orderData.items,
      shippingInfo: orderData.shippingInfo,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      pricing: orderData.pricing
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order._id,
        orderId: order.orderId,
        status: order.status
      }
    });

  } catch (error) {
    console.error('Error creating COD order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// Get Order Status
router.get('/order-status/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// Test route to verify the route is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Payment routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;