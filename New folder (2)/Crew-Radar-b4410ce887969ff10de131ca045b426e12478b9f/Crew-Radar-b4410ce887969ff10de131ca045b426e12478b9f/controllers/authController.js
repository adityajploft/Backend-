// controllers/authController.js
const { messaging } = require('firebase-admin');
const User = require('../models/User');
const sendEmail = require('../services/emailService');
const jwt = a = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const generateToken = (id, sessionUuid='') => {
  return jwt.sign({ id, sessionUuid:sessionUuid }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};


// 1. Send Verification Code (Optimized)
exports.sendVerificationCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const verificationCodeExpires = new Date(Date.now() + 30 * 60 * 1000);

    const existingUser = await User.findOne({ email });

    if (existingUser?.isVerified && existingUser?.fullName && existingUser?.password) {
      return res.status(400).json({ message: `User already registered ${existingUser?.appleUserId?"with apple":""}. Please login.` });
    }

    // Function to upsert user
    const upsertUser = async () => {
      if (existingUser) {
        return User.updateOne(
          { email },
          { verificationCode, verificationCodeExpires, isVerified: false }
        );
      } else {
        const newUser = new User({ email, verificationCode, verificationCodeExpires });
        return newUser.save({ validateBeforeSave: false });
      }
    };

    // Run DB update and email sending in parallel
    const [dbResult, emailResult] = await Promise.all([
      upsertUser(),
      sendEmail({
        email,
        subject: 'Your Crew Radar Verification Code',
        message: `Your verification code is: <strong>${verificationCode}</strong>\nIt will expire in 30 minutes.`,
      }),
    ]);

    // Check if emailResult contains errors
    if (emailResult && Array.isArray(emailResult)) {
      return res.status(500).json({
        status: false,
        message: 'Failed to send verification email',
        errors: emailResult,
      });
    }

    // Success response
    return res.status(200).json({
      status: true,
      message: `Verification code has been sent to your email address`,
    });

  } catch (error) {
    console.error('Verification Error:', error);
    return res.status(500).json({ status: false, message: 'Server Error', error });
  }
};



// 2. Verify Code
exports.verifyCode = async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ 
            email, 
            verificationCode: code, 
            verificationCodeExpires: { $gt: Date.now() } 
        });

        if (!(user?.verificationCode && user.verificationCodeExpires)) {
            await res.status(400).json({status:false, message: 'Invalid or expired verification code.' });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        // Send a token that proves verification for the next step
        const verificationToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30m' });

        res.status(200).json({ 
            status:true,
            message: 'Email verified successfully.',
            verificationToken
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({status:false, message: 'Server Error' });
    }
};

// 3. Complete Registration
exports.register = async (req, res) => {
    // This route should be protected by a middleware that verifies the `verificationToken`
    const { fullName, password,confirmPassword, airline, worksForAirline, firebaseToken} = req.body;
    const userId = req.user.id; // Get user ID from the token middleware
    const uuid = uuidv4();
    try {
        const user = await User.findById(userId);

        if (user?.isVerified&& user?.fullName && user?.password) {
          return res.status(400).json({ status: true, message: 'User already register.' });
        }
        
        if (!user?.isVerified) {
            return res.status(400).json({status:false, message: 'User not verified or not found.' });
        }
        
        if(!user?.isRegistered && !user){
          return res.status(400).json({status:false, message: 'Session is expired.' });
        }
        
        const token = generateToken(user._id, uuid);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        user.fullName = fullName;
        user.password = password;
        user.confirmPassword = confirmPassword;
        user.airline = airline;
        user.worksForAirline = worksForAirline;
        user.isRegistered = true;
        user.firebaseToken = firebaseToken
        user.sessionUuid= decoded?.sessionUuid
        await user.save();

        res.status(201).json({
            status:true,
            message: 'Registration complete!',
            token,
            user: {
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              preferences: user.preferences,
              airlineName: user.airline,
              worksForAirline: user.worksForAirline,
              firebaseToken: user?.firebaseToken,
              isVerified: user?.isVerified,
              isRegistered: user?.isRegistered,
            }
        });

    } catch (error) {
        console.log(error,"error");
        res.status(500).json({ status:false,message: 'Server Error' });
    }
};

// 5. Login
exports.login = async (req, res) => {
  const { email, password, firebaseToken } = req.body;
  const uuid = uuidv4();

  try {
    const user = await User.findOne({ email });

    if(!user?.password){
      res.status(400).json({status: false, message:"User not found"})
    }
    
    if (user?.isVerified) {
      if (await user.matchPassword(password)) {
        const token = generateToken(user._id, uuid);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(user?._id, { sessionUuid: decoded?.sessionUuid, firebaseToken })

        res.json({
          status: true,
          message: 'Login successful',
          token,
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            preferences: user.preferences,
            airlineName: user.airline,
            worksForAirline: user.worksForAirline,
            flightNumber: user.flightNumber,
            firebaseToken: firebaseToken,
            isVerified: user?.isVerified,
          },
        });
      } else {
        res.status(401).json({ status: false, message: 'Invalid email or password' });
      }
    } else {
      res.status(401).json({ status: false, message: 'User not verified' });
    }
  } catch (error) {
    console.log('error', error);
    
    res.status(500).json({ status:false,message: 'Server Error' });
  }
};

//  forgotPassword
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'No account found with this email address.',
      });
    }
    
    await res.status(200).json({
      status: true,
      message: 'An OTP has been sent to your registered email.',
    });

    const otp =  Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await User.updateOne(
      { email },
      {
        resetPasswordOtp: otp,
        resetPasswordOtpExpires: otpExpires,
      },
      { runValidators: false }
    );

    const message = `You requested a password reset.\n\nYour OTP is: <strong>${otp}</strong>\nIt will expire in 10 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your Crew Radar Reset Password OTP',
        message,
      });
    } catch (err) {
      console.error('Email sending failed:', err);

      // Clean up OTP fields if email fails
      await User.updateOne(
        { email },
        {
          $unset: {
            resetPasswordOtp: "",
            resetPasswordOtpExpires: "",
          },
        }
      );

      return res.status(500).json({
        status: false,
        message: 'Failed to send email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({
      status: false,
      message: 'Server Error',
    });
  }
};



//  verifyOtp
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordOtpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ status:false, error: 'Invalid or expired OTP.' });
    }

    // OTP is valid. Clear the fields in the database.
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    await user.save(); // This database write operation could fail.
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.status(200).json({status:true, message: 'OTP verified successfully.', resetToken });

  } catch (error) {
    console.error('[VERIFY OTP ERROR]:', error); // Log the full error for debugging.
    res.status(500).json({ status:false,error: 'An unexpected server error occurred. Please try again.' });
  }
};

// --- resetPassword function ---
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({email: req.user?.email})
    user.password = req.body.new_password;
    user.confirmPassword = req.body.new_password;
    await user.save(); 
    res.status(200).json({status:true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('[RESET PASSWORD ERROR]:', error); // Log the full error for debugging.
    res.status(500).json({status:false, error: 'An unexpected server error occurred while resetting the password.' });
  }
};

// --- logout function ---
exports.logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!token) {
    return res.status(400).json({ message: 'Token not provided' });
  }
  try {
    const user  = await User.findById(decoded?.id)
    
    if(decoded?.sessionUuid===user?.sessionUuid){
      await User.findByIdAndUpdate(decoded?.id, { sessionUuid: "",firebaseToken:"" })
      return res.status(200).json({ status: true, message: 'Logged out successfully.' });
    }else{
      return res.status(200).json({ status: true, message: 'User already Logged out.' });
    }
  } catch (error) {
    console.error('[LOGOUT ERROR]:', error);
    res.status(500).json({ status: false, error: 'An unexpected server error occurred.' });
  }
};

exports.appleSignIn = async (req, res) => {
  const uuid = uuidv4();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { identityToken, appleUserId, email, deviceToken, fullName, firebaseToken } = req.body;

  try {
    let user = await User.findOne({ $or:[{appleUserId}, {email}] });

    if (user) {
      // Login success
      const token = generateToken(user?._id, uuid);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const updatedUser  =await User.findByIdAndUpdate(user?._id, {
        appleUserId,
        identityToken,
        sessionUuid: decoded?.sessionUuid,
        deviceToken,
        email,
        fullName,
        firebaseToken
      });
      await user.save({ validateBeforeSave: false });
      
      return res.json({
        status: true,
        message: "Apple login successful",
        token,
        user: {
          id: user._id,
          fullName: updatedUser?.fullName,
          email: updatedUser?.email,
          isRegistered: user?.isRegistered,
          preferences: user.preferences,
        },
      });
    }
    const userData = {
      appleUserId,
      identityToken,
      deviceToken,
      email,
      fullName,
      isVerified: true,
      firebaseToken,
    };
    const newUser = new User(userData);
    await newUser.save({ validateBeforeSave: false });

    const token = generateToken(newUser?._id, uuid);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await User.findByIdAndUpdate(newUser?._id,{
      sessionUuid: decoded?.sessionUuid,
    })

    return res.json({
      status: true,
      message: "Apple login successful",
      token,
      user: {
        id: newUser._id,
        fullName: newUser?.fullName,
        email: newUser?.email,
        preferences: newUser.preferences,
        isRegistered: newUser?.isRegistered,
      },
    });

  } catch (err) {
    console.error("Apple Sign-In Error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};