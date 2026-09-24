const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },

  type: {
    type: String,
    required: true,
  },
 
  meta_data: {
    type: Map,
    of: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Indexing for faster queries
notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;