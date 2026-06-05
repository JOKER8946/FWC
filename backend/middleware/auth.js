const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── protect ───────────────────────────────────────────────────────────────────
// Verifies the JWT in the Authorization header.
// Attaches req.user (without passwordHash) for downstream handlers.
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. No token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user on every request — catches deactivated accounts instantly
    req.user = await User.findById(decoded.id).select('-passwordHash');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (!req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

// ── authorize ─────────────────────────────────────────────────────────────────
// Role-based access control — call AFTER protect.
// Usage: authorize('admin', 'senior_manager')
// Accepts one or more allowed roles as arguments.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this resource.`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
