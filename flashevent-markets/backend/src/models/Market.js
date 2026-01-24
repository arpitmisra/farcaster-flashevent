const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['PRICE_TOUCH', 'ONCHAIN_EVENT', 'API_COUNT', 'SPORTS'],
    required: true,
    index: true,
  },
  question: {
    type: String,
    required: true,
    maxlength: 280,
  },
  endTime: {
    type: Number,
    required: true,
    index: true,
  },
  creator: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  creatorFid: {
    type: Number,
    index: true,
  },
  contractAddress: {
    type: String,
    lowercase: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'RESOLVED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  parameters: {
    token: String,
    targetPrice: Number,
    isAbove: Boolean,
    contractAddress: String,
    eventSelector: String,
    apiEndpoint: String,
    threshold: Number,
    // Sports market parameters
    sport: String,
    team1: String,
    team2: String,
    betType: String,
    matchDate: String,
    totalLine: Number,
  },
  yesVolume: {
    type: String,
    default: '0',
  },
  noVolume: {
    type: String,
    default: '0',
  },
  yesPrice: {
    type: String,
    default: '0.5',
  },
  noPrice: {
    type: String,
    default: '0.5',
  },
  outcome: {
    type: Boolean,
    default: null,
  },
  resolvedAt: Date,
  resolutionTxHash: String,
  resolutionProofHash: String,
  creationTxHash: String,
  // Resolution tracking fields
  resolvedBy: {
    type: String,
    default: null, // 'auto-resolver', 'admin', 'blockchain-sync', or wallet address
  },
  resolutionAttempts: {
    type: Number,
    default: 0,
  },
  lastResolutionError: {
    type: String,
    default: null,
  },
  // Manual review fields
  requiresManualReview: {
    type: Boolean,
    default: false,
    index: true,
  },
  manualReviewReason: {
    type: String,
    default: null,
  },
  flaggedAt: Date,
  // Cancellation fields
  cancelledAt: Date,
  cancellationTxHash: String,
  cancelledBy: String,
  cancellationReason: String,
}, {
  timestamps: true,
});

// Indexes for common queries
marketSchema.index({ status: 1, endTime: 1 });
marketSchema.index({ creator: 1, createdAt: -1 });
marketSchema.index({ type: 1, status: 1 });

// Virtual for total volume
marketSchema.virtual('totalVolume').get(function() {
  return (BigInt(this.yesVolume || 0) + BigInt(this.noVolume || 0)).toString();
});

// Virtual for time remaining
marketSchema.virtual('timeRemaining').get(function() {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, this.endTime - now);
});

marketSchema.set('toJSON', { virtuals: true });
marketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Market', marketSchema);
