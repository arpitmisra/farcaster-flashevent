const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fid: {
    type: Number,
    unique: true,
    sparse: true,
    index: true,
  },
  address: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    index: true,
  },
  displayName: String,
  avatar: String,
  bio: {
    type: String,
    maxlength: 280,
  },
  linkedWallets: [{
    type: String,
    lowercase: true,
  }],
  totalBets: {
    type: Number,
    default: 0,
  },
  totalVolume: {
    type: Number,
    default: 0,
  },
  totalWins: {
    type: Number,
    default: 0,
  },
  totalLosses: {
    type: Number,
    default: 0,
  },
  totalPnL: {
    type: Number,
    default: 0,
  },
  marketsCreated: {
    type: Number,
    default: 0,
  },
  lastLogin: Date,
  preferences: {
    notifications: {
      type: Boolean,
      default: true,
    },
    publicProfile: {
      type: Boolean,
      default: true,
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
  },
}, {
  timestamps: true,
});

// Indexes
userSchema.index({ username: 'text', displayName: 'text' });
userSchema.index({ totalVolume: -1 });
userSchema.index({ totalPnL: -1 });

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
  const total = this.totalWins + this.totalLosses;
  if (total === 0) return 0;
  return Math.round((this.totalWins / total) * 100);
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
