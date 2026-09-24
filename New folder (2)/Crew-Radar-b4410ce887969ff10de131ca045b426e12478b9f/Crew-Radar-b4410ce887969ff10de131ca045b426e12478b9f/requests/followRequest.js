const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

exports.sendFollowRequest = [
  body('follow_email_or_id', 'The ID or email of the user to follow is required.').notEmpty().isString(),
  validate,
];

exports.respondToRequest = [
  body('action', "Action must be either 'accept' or 'reject'.").isIn(['accept', 'reject']),
  validate,
];

exports.sendDayOfRequest = [
  body('isDayOff', 'Dayoff is required.').isString(),
  validate,
];