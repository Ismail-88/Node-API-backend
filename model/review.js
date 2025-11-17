const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  images: [{
    type: String
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  verified: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reviews from same user for same product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Virtual for likes count
reviewSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Update helpful count whenever likes change
reviewSchema.pre('save', function(next) {
  if (this.likes) {
    this.helpful = this.likes.length;
  }
  next();
});

module.exports = mongoose.model('Review', reviewSchema);



// const mongoose = require('mongoose');

// const reviewSchema = new mongoose.Schema({
//   productId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true
//   },
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   userName: {
//     type: String,
//     required: true
//   },
//   userAvatar: String,
//   rating: {
//     type: Number,
//     required: true,
//     min: 1,
//     max: 5
//   },
//   title: String,
//   comment: {
//     type: String,
//     required: true,
//     minlength: 10,
//     maxlength: 500
//   },
//   images: [String],
//   likes: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   reports: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   verified: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('Review', reviewSchema);