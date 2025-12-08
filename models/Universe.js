import mongoose from 'mongoose';

const universeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // No unique constraint - users can have multiple canvases
  },
  name: {
    type: String,
    default: 'Untitled',
    trim: true,
  },
  nodes: {
    type: Array,
    default: [],
  },
  edges: {
    type: Array,
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add compound index for efficient queries
universeSchema.index({ userId: 1, updatedAt: -1 });

// Update the updatedAt timestamp on save
universeSchema.pre('save', function () {
  this.updatedAt = new Date();
});

const Universe = mongoose.model('Universe', universeSchema);

export default Universe;
