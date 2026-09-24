const express = require('express');
const {sendVerificationCode,verifyCode,register,login,forgotPassword, verifyOtp,  resetPassword, appleSignIn, logout} = require('../controllers/authController');
const { protectVerification,verifyResetToken } = require('../middleware/authMiddleware');

// Import your new, dedicated request validators
const {sendVerificationCodeRequest,verifyCodeRequest,registerRequest,loginRequest,forgotPasswordRequest, verifyOtpRequest, resetPasswordRequest, appleSignInRequest } = require('../requests/authRequest');

const router = express.Router();

// --- REGISTER/LOGIN ---
router.post('/send-verification-code', sendVerificationCodeRequest, sendVerificationCode);
router.post('/verify-code', verifyCodeRequest, verifyCode);
router.post('/register', protectVerification, registerRequest, register);
router.post('/login', loginRequest, login);
router.get('/logout', logout);

// --- PASSWORD RESET ROUTES ---
router.post('/forgot-password', forgotPasswordRequest, forgotPassword);
router.post('/verify-otp', verifyOtpRequest, verifyOtp);
router.post('/reset-password/:token', verifyResetToken, resetPasswordRequest, resetPassword);
router.post('/apple-signin', appleSignInRequest, appleSignIn);

module.exports = router;