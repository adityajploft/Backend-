const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  sendNotification,
  markNotificationRead,
  getNotificationSettings,
  updateNotificationSettings,
} = require('../controllers/notificationController');
const {
  sendNotification: sendValidator,
  updateSettings: settingsValidator,
} = require('../requests/notificationRequest');

const router = express.Router();

// All notification routes are protected
router.use(protect);

router.route('/')
  .get(getNotifications)
  .post(sendValidator, sendNotification);

router.route('/settings')
  .get(getNotificationSettings)
  .put(settingsValidator, updateNotificationSettings);

router.route('/:notificationId/read')
  .put(markNotificationRead);

module.exports = router;