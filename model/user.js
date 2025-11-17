// backend/model/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.role === 'admin' || this.role === 'staff' || this.role === 'superadmin';
    },
    select: false // Don't include password in queries by default
  },
  clerkId: {
    type: String,
    sparse: true,
    unique: true
  },
  role: {
    type: String,
    required: true,
    enum: ['user', 'admin', 'staff', 'superadmin'],
    default: 'user'
  },
  profileImage: {
    type: String,
    default: null,
  },
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  permissions: {
    canManageProducts: { type: Boolean, default: false },
    canManageOrders: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// ============= PRE-SAVE MIDDLEWARE - Hash Password =============
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }

  // Only hash for admin/staff (users from Clerk don't have passwords)
  if (this.role === 'admin' || this.role === 'staff' || this.role === 'superadmin') {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      console.log('Password hashed for:', this.email);
    } catch (error) {
      console.error('Error hashing password:', error);
      return next(error);
    }
  }
  
  next();
});

// ============= INSTANCE METHOD - Compare Password =============
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) {
      console.log('No password found for user');
      return false;
    }
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log(' Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
};

// ============= INSTANCE METHOD - Check Permission =============
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'superadmin') return true;
  if (this.role === 'admin') return true;
  if (this.role === 'staff') {
    return this.permissions[permission] || false;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);