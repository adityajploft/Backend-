const { body } = require('express-validator');

exports.validateSendCode = [
  body('email', 'Please provide a valid email address.')
    .isEmail()
    .normalizeEmail(),
];

exports.validateVerifyCode = [
  body('email', 'Please provide a valid email address.')
    .isEmail()
    .normalizeEmail(),
  body('code', 'Verification code must be a 4-digit string.')
    .isString()
    .isLength({ min: 4, max: 4 }),
];

exports.validateRegistration = [
  body('fullName', 'Full name is required.')
    .notEmpty()
    .trim()
    .escape(),
  body('password', 'Password must be at least 6 characters long.')
    .isLength({ min: 6 }),
  // Add a password confirmation check for best practice
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true; // Indicates the success of this synchronous custom validator
  }),
];

exports.validateLogin = [
  body('email', 'Please provide a valid email address.')
    .isEmail()
    .normalizeEmail(),
  body('password', 'Password cannot be empty.')
    .notEmpty(),
];