const Notification = require('../models/Notification');
const NotificationSetting = require('../models/NotificationSetting');
const admin = require("../firebase/firebaseSetup");

/**
 * @desc    Get all notifications for the logged-in user
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res) => {
  try {
    if(req.query.userId){
      const notifications = await Notification.find({ user: req.query.userId })
      .sort({ createdAt: -1 });

      // console.log('notifications', notifications);
      

      res.status(200).json({
        status: true,
        message: 'Notifications fetched successfully.',
        data: notifications
      });
    }else{
      res.status(200).json({
        status: false,
        message: 'Please provide current user id',
        data: []
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch notifications.',
      error: error.message
    });
  }
};

/**
 * @desc    Create a notification (internal or for testing)
 * @route   POST /api/notifications
 * @access  Private
 */
exports.sendNotification = async (req, res) => {
  try {
    const { title, message, type, meta_data } = req.body;

    const notification = await Notification.create({
      user: req.user.id,
      title,
      message,
      type,
      meta_data
    });

    res.status(201).json({
      status: true,
      message: 'Notification created successfully.',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to create notification.',
      error: error.message
    });
  }
};


/**
 * @desc    Mark a single notification as read
 * @route   PUT /api/notifications/:notificationId/read
 * @access  Private
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found.'
      });
    }

    if (notification.user.toString() !== req.user.id.toString()) {
      return res.status(401).json({
        status: false,
        message: 'Not authorized to update this notification.'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      status: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to update notification.',
      error: error.message
    });
  }
};

/**
 * @desc    Get notification settings for the logged-in user
 * @route   GET /api/notifications/settings
 * @access  Private
 */
exports.getNotificationSettings = async (req, res) => {
  try {
    let settings = await NotificationSetting.findOne({ user: req.user.id });

    if (!settings) {
      settings = await NotificationSetting.create({ user: req.user.id });
    }

    res.status(200).json({
      status: true,
      message: 'Notification settings fetched successfully.',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to get notification settings.',
      error: error.message
    });
  }
};

/**
 * @desc    Update notification settings for the logged-in user
 * @route   PUT /api/notifications/settings
 * @access  Private
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { flight_takeoff_alert, flight_landing_alert, new_follower_alert } = req.body;

    const settings = await NotificationSetting.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          flight_takeoff_alert,
          flight_landing_alert,
          new_follower_alert
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      status: true,
      message: 'Notification settings updated successfully.',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to update notification settings.',
      error: error.message
    });
  }
};
