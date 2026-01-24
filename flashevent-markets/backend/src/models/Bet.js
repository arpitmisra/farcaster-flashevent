const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  userFid: {
    type: Number,
    index: true,
  },
  position: {
    type: String,
    enum: ['YES', 'NO'],
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  shares: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  potentialPayout: {
    type: String,
    required: true,
  },
  txHash: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING',
  },
  yesPrice: String, // Price at time of bet
  noPrice: String,
  claimed: {
    type: Boolean,
    default: false,
  },
  claimTxHash: String,
  claimedAt: Date,
}, {
  timestamps: true,
});

// Indexes
betSchema.index({ marketId: 1, userId: 1 });
betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ marketId: 1, createdAt: -1 });
betSchema.index({ txHash: 1 }, { sparse: true });

// Virtual for profit/loss (calculated after market resolution)
betSchema.virtual('pnl').get(function() {
  // Calculate based on market outcome
  return null; // Calculated dynamically
});

betSchema.set('toJSON', { virtuals: true });
betSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bet', betSchema);
