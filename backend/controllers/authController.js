const User = require('../models/User');
const Employee = require('../models/Employee');
const generateToken = require('../utils/generateToken');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new user (Admin only in production)
// @route   POST /api/auth/register
// @access  Public (lock this down after seeding initial admin)
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, department, designation, dateOfJoining, salary } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'email, password, role, firstName, lastName are required.',
      });
    }

    const validRoles = ['admin', 'senior_manager', 'hr_recruiter', 'employee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // ── Check duplicate ───────────────────────────────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // ── Create User ───────────────────────────────────────────────────────────
    // passwordHash field triggers bcrypt pre-save hook in User model
    const user = await User.create({
      email,
      passwordHash: password,
      role,
    });

    // ── Create linked Employee profile ────────────────────────────────────────
    const employee = await Employee.create({
      userId: user._id,
      firstName,
      lastName,
      email,
      department: department || 'general',
      designation: designation || role,
      dateOfJoining: dateOfJoining || new Date(),
      salary: salary || 0,
    });

    // ── Link employee back to user ────────────────────────────────────────────
    user.employeeId = employee._id;
    await user.save();

    // ── Update last login ─────────────────────────────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        employeeId: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Explicitly select passwordHash since it has select:false in schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!user) {
      // Generic message — never reveal whether email exists or not
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact HR.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ── Fetch linked employee profile ─────────────────────────────────────────
    const employee = await Employee.findOne({ userId: user._id });

    // ── Update last login timestamp ───────────────────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        employeeId: employee?._id || null,
        firstName: employee?.firstName || '',
        lastName: employee?.lastName || '',
        department: employee?.department || '',
        designation: employee?.designation || '',
        profilePicture: employee?.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get currently logged-in user
// @route   GET /api/auth/me
// @access  Private (requires valid JWT)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id });

    res.status(200).json({
      success: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
        lastLogin: req.user.lastLogin,
        employeeId: employee?._id || null,
        firstName: employee?.firstName || '',
        lastName: employee?.lastName || '',
        department: employee?.department || '',
        designation: employee?.designation || '',
        profilePicture: employee?.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Assigning triggers the bcrypt pre-save hook
    user.passwordHash = newPassword;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      token, // issue a fresh token
    });
  } catch (err) {
    console.error('UpdatePassword error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Logout (stateless — client discards token)
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  // JWT is stateless — actual logout happens on the frontend by deleting the token.
  // This endpoint exists for audit logging and future token blacklisting.
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { register, login, getMe, updatePassword, logout };
