const { body, validationResult } = require('express-validator');

// A reusable function to handle the validation result.
// This prevents repeating the same error-checking logic.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return a 422 Unprocessable Entity status with the errors
    return res.status(422).json({ errors: errors.array() });
  }
  // If no errors, proceed to the next middleware (the controller)
  next();
};

// Now, we define our validation chains and append our `validate` function to each one.

exports.sendVerificationCodeRequest = [
  body('email', 'Please provide a valid email address.')
    .isEmail(),
  validate, // Run the validation check
];

exports.verifyCodeRequest = [
  body('email', 'Please provide a valid email address.')
    .isEmail(),
  body('code', 'Verification code must be a 4-digit string.')
    .isString()
    .isLength({ min: 4, max: 4 }),
  validate, // Run the validation check
];

exports.registerRequest = [
  body('fullName', 'Full name is required.')
    .notEmpty()
    .trim()
    .escape(),
  body("worksForAirline").custom((value, { req }) => {
    if (!value) {
      throw new Error("Select your airline option.")
    }
    return true;
  }).isBoolean(),
  body("airline").custom((value, { req }) => {
  const worksForAirline = req.body.worksForAirline;
    if (worksForAirline === true || worksForAirline === 'true') {
      if (!value || value.trim().length === 0) {
        throw new Error("Airline name is required.");
      }
    }
    return true;
  }),
  body('password').custom((value, { req }) => {
    if (value?.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    } else if (!value?.length) {
      throw new Error('Password is required');
    }
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (value && value !== req.body.password) {
      throw new Error('Confirm Password do not match.');
    } else if (!value?.length) {
      throw new Error('Confirm Password is required')
    }
    return true;
  }),
  body('firebaseToken','FirebaseToken is required.')
    .notEmpty(),
  validate, // Run the validation check
];

exports.loginRequest = [
  body('email', 'Please provide a valid email address.')
    .isEmail(),
  body('password', 'Password cannot be empty.')
    .notEmpty(),
  body('firebaseToken', "FirebaseToken is required").notEmpty(),
  validate, // Run the validation check
];

exports.forgotPasswordRequest = [
  body('email', 'Please provide a valid email').isEmail(),
];

exports.verifyOtpRequest = [
  body('email', 'A valid email is required').isEmail(),
  body('otp', 'OTP must be a 6-digit string').isString().isLength({ min: 6, max: 6 }),
];

exports.resetPasswordRequest = [
  body('new_password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  }),
];

exports.appleSignInRequest = [
  body('appleUserId', 'Apple User ID is required').exists(),
  validate
];

exports.postFlightNotification = [
  body('flightStatus').optional(),
  body('flightDateTime').optional(),
  body('isNotify').exists().default(false),
  body('followingId').exists(),
  validate,
];