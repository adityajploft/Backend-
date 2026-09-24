const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)

      if (!decoded.sessionUuid || decoded?.sessionUuid!==user?.sessionUuid) {
        return res.status(401).json({ status: false, message: 'Token expired or not found. Please login again.' });
      }
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
         return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware specifically for the registration step
const protectVerification = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id }; // Just need the ID for this step
            next();
        } catch (error) {
            return res.status(401).json({success: false, message: 'Not authorized, verification token invalid or expired.' });
        }
    }

    if (!token) {
        return res.status(401).json({success: false, message: 'Not authorized, no verification token.' });
    }
};

const verifyResetToken = async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return res.status(401).json({ error: 'Authorization denied, no token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Authorization denied, user not found.' });
    }

    req.user = user; // Attach user object to the request
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authorization denied, token is invalid or has expired.' });
  }
};
module.exports = { protect, protectVerification, verifyResetToken };