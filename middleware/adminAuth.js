const adminAuth = (req, res, next) => {
  try {
    // Check if user is authenticated (auth middleware should run first)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({ message: 'Server error during admin authentication' });
  }
};

module.exports = adminAuth;