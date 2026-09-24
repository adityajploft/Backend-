const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

exports.sendNotification = [
  body('title', 'Title is required.').notEmpty().isString(),
  body('message', 'Message is required.').notEmpty().isString(),
  body('type', 'Type is required.').notEmpty().isString(),
  body('meta_data').optional().isObject(),
  validate,
];

exports.updateSettings = [
  body('flight_takeoff_alert').optional().isBoolean(),
  body('flight_landing_alert').optional().isBoolean(),
  body('new_follower_alert').optional().isBoolean(),
  validate,
];
