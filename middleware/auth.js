// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const auth = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization');
    
//     if (!token) {
//       return res.status(401).json({ message: 'No token provided, authorization denied' });
//     }

//     // Remove 'Bearer ' prefix if present
//     const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;

//     // Verify token
//     const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    
//     // Check if user exists and is active
//     const user = await User.findById(decoded.id);
//     if (!user || !user.isActive) {
//       return res.status(401).json({ message: 'User not found or inactive' });
//     }

//     // Add user to request object
//     req.user = {
//       id: user._id,
//       email: user.email,
//       role: user.role
//     };

//     next();
//   } catch (error) {
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token' });
//     } else if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Token expired' });
//     }
    
//     console.error('Auth middleware error:', error);
//     return res.status(500).json({ message: 'Server error during authentication' });
//   }
// };

// module.exports = auth;
// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ridemate-secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};
