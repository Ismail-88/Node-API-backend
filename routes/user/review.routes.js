const express = require('express');
const router = express.Router();
const Review = require('../../model/review');
const User = require('../../model/user');
const Product = require('../../model/products');

// Get all reviews for a product
router.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId })
      .populate('userId', 'name profileImage clerkId email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get reviews by rating
router.get('/api/products/:productId/reviews/rating/:rating', async (req, res) => {
  try {
    const { productId, rating } = req.params;

    const reviews = await Review.find({ 
      productId, 
      rating: parseInt(rating) 
    })
      .populate('userId', 'name profileImage clerkId')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get review statistics for a product
router.get('/api/products/:productId/reviews/stats', async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId });

    const total = reviews.length;
    if (total === 0) {
      return res.json({
        average: 0,
        total: 0,
        distribution: [0, 0, 0, 0, 0]
      });
    }

    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const average = (sum / total).toFixed(1);

    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach(review => {
      distribution[5 - review.rating]++;
    });

    res.json({
      average: parseFloat(average),
      total,
      distribution
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
});

// Create a new review
router.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { productId } = req.params;
    const { clerkId, rating, title, comment, images } = req.body;

    // Validate required fields
    if (!clerkId) {
      return res.status(401).json({ message: 'Authentication required. ClerkId is missing.' });
    }

    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (comment.trim().length < 10) {
      return res.status(400).json({ message: 'Comment must be at least 10 characters' });
    }

    // Find user by clerkId
    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sync your account.' });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId,
      userId: user._id
    });

    if (existingReview) {
      return res.status(400).json({ 
        message: 'You have already reviewed this product. Please edit your existing review.' 
      });
    }

    // Create new review
    const review = new Review({
      productId,
      userId: user._id,
      rating: parseInt(rating),
      title: title?.trim() || '',
      comment: comment.trim(),
      images: images || [],
      verified: false // Set to true if user has purchased the product
    });

    await review.save();

    // Populate user data before sending response
    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name profileImage clerkId email')
      .lean();

    res.status(201).json({
      message: 'Review created successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error creating review:', error);
    
    // Handle duplicate review error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'You have already reviewed this product' 
      });
    }

    res.status(500).json({ 
      message: 'Error creating review', 
      error: error.message 
    });
  }
});

// Update a review
router.put('/api/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { clerkId, rating, title, comment, images } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find user by clerkId
    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find review and verify ownership
    const review = await Review.findOne({
      _id: reviewId,
      userId: user._id
    });

    if (!review) {
      return res.status(404).json({ 
        message: 'Review not found or you are not authorized to edit this review' 
      });
    }

    // Validate new data
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (comment && comment.trim().length < 10) {
      return res.status(400).json({ message: 'Comment must be at least 10 characters' });
    }

    // Update fields
    if (rating) review.rating = parseInt(rating);
    if (title !== undefined) review.title = title.trim();
    if (comment) review.comment = comment.trim();
    if (images !== undefined) review.images = images;

    await review.save();

    // Populate and return updated review
    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name profileImage clerkId email')
      .lean();

    res.json({
      message: 'Review updated successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ 
      message: 'Error updating review', 
      error: error.message 
    });
  }
});

// Delete a review
router.delete('/api/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { clerkId } = req.query;

    if (!clerkId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find user by clerkId
    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find and delete review
    const review = await Review.findOneAndDelete({
      _id: reviewId,
      userId: user._id
    });

    if (!review) {
      return res.status(404).json({ 
        message: 'Review not found or you are not authorized to delete this review' 
      });
    }

    res.json({ 
      message: 'Review deleted successfully',
      deletedReviewId: reviewId
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ 
      message: 'Error deleting review', 
      error: error.message 
    });
  }
});

// Like/Unlike a review
router.post('/api/reviews/:reviewId/like', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { clerkId } = req.body;

    if (!clerkId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find user by clerkId
    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Toggle like
    const likeIndex = review.likes.indexOf(user._id);
    if (likeIndex > -1) {
      // Unlike
      review.likes.splice(likeIndex, 1);
    } else {
      // Like
      review.likes.push(user._id);
    }

    await review.save();

    // Populate and return updated review
    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name profileImage clerkId')
      .lean();

    res.json({
      message: likeIndex > -1 ? 'Review unliked' : 'Review liked',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error liking review:', error);
    res.status(500).json({ 
      message: 'Error liking review', 
      error: error.message 
    });
  }
});

// Get all reviews by a user
router.get('/api/users/:clerkId/reviews', async (req, res) => {
  try {
    const { clerkId } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reviews = await Review.find({ userId: user._id })
      .populate('productId', 'title images price')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching user reviews', 
      error: error.message 
    });
  }
});

// Check if user has reviewed a product
router.get('/api/products/:productId/reviews/check/:clerkId', async (req, res) => {
  try {
    const { productId, clerkId } = req.params;

    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.json({ hasReviewed: false });
    }

    const review = await Review.findOne({
      productId,
      userId: user._id
    });

    res.json({ 
      hasReviewed: !!review,
      review: review || null
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error checking review status', 
      error: error.message 
    });
  }
});

module.exports = router;