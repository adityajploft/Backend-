const mongoose = require('mongoose');

const notificationSettingSchema = new mongoose.Schema({
  // The user these settings belong to.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, 
  },
  // Example settings
  flight_takeoff_alert: {
    type: Boolean,
    default: true,
  },
  flight_landing_alert: {
    type: Boolean,
    default: true,
  },
  new_follower_alert: {
    type: Boolean,
    default: true,
  },
  // Add more settings as needed
}, { timestamps: true });

const NotificationSetting = mongoose.model('NotificationSetting', notificationSettingSchema);
module.exports = NotificationSetting;