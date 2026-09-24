const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: String,

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  password: { type: String, minlength: 6 },
  confirmPassword: { type: String, minlength: 6 },

  // Verification
  verificationCode: String,
  verificationCodeExpires: Date,
  isVerified: { type: Boolean, default: false },

  resetPasswordOtp: String,
  resetPasswordOtpExpires: Date,

  sessionUuid: String,
  firebaseToken: String,
  appleUserId: String,
  deviceToken: String,
  identityToken: String,

  airline: String,
  worksForAirline: { type: Boolean, default: false },

  // Flight Info
  flightNumber: { type: [String], default: [] },
  flightStatus: { type: [String], default: [] },  
  flightDateTime: { type: [String], default: [] },

  isNotify: { type: Boolean, default: false },

  isRegistered: { type: Boolean, default: false },


  preferences: {
    allowCalendarAccess: { type: Boolean, default: false },
    allowNotifications: { type: Boolean, default: false },
    allowContactsAccess: { type: Boolean, default: false },
  },

}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  if (this.confirmPassword) {
    this.confirmPassword = await bcrypt.hash(this.confirmPassword, salt);
  }

  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
