const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updatePassword,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login',    login);

// Protected routes (valid JWT required)
router.get('/me',              protect, getMe);
router.put('/update-password', protect, updatePassword);
router.post('/logout',         protect, logout);

module.exports = router;
