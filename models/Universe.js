import mongoose from 'mongoose';

const universeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  nodes: {
    type: Array,
    default: [],
  },
  edges: {
    type: Array,
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp on save
universeSchema.pre('save', function () {
  this.updatedAt = new Date();
});

const Universe = mongoose.model('Universe', universeSchema);

export default Universe;

