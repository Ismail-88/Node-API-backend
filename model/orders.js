const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },      
  orderId: { type: String, required: true },
  orderDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
  items: [
    {
      title: String,
      price: Number,
      quantity: Number,
      images: [String]
    }
  ],
  shippingInfo: {
    fullName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  // paymentMethod: String,
  pricing: {
    subtotal: Number,
    deliveryFee: Number,
    handlingFee: Number,
    grandTotal: Number
  },
   paymentMethod: { 
    type: String,
    enum: ['razorpay', 'cod', 'stripe', 'paypal'],
    required: true 
  },
  paymentId: String, // Razorpay payment ID
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paidAt: Date,
  pricing: {
    subtotal: Number,
    deliveryFee: Number,
    handlingFee: Number,
    grandTotal: Number
  }
}, { timestamps: true });

module.exports = mongoose.model("orders", orderSchema);
