const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({

  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
 
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending',
  },
  isNotify: { type: Boolean, default: false }
}, { timestamps: true });

followSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follow = mongoose.model('Follow', followSchema);
module.exports = Follow;