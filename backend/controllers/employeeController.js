const Employee = require('../models/Employee');
const User = require('../models/User');

// GET all employees (filters + pagination)
const getAllEmployees = async (req, res) => {
  try {
    const { page=1, limit=20, department, status, search, managerId, sortBy='createdAt', order='desc' } = req.query;
    const query = {};
    if (department) query.department = department.toLowerCase();
    if (status)     query.status = status;
    if (managerId)  query.managerId = managerId;
    if (search) {
      query.$or = [
        { firstName:   { $regex: search, $options: 'i' } },
        { lastName:    { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
        { email:       { $regex: search, $options: 'i' } },
      ];
    }
    if (req.user.role === 'senior_manager') {
      const self = await Employee.findOne({ userId: req.user._id });
      if (self) query.managerId = self._id;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [employees, total] = await Promise.all([
      Employee.find(query)
        .populate('managerId', 'firstName lastName designation')
        .populate('userId', 'role isActive email')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip).limit(Number(limit)).lean(),
      Employee.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: employees, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total/Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET single employee
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('managerId', 'firstName lastName designation email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    if (req.user.role === 'employee') {
      const self = await Employee.findOne({ userId: req.user._id });
      if (!self || self._id.toString() !== employee._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.status(200).json({ success: true, data: employee });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST create employee + user account
const createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, department, designation, managerId, dateOfJoining, employmentType, salary, role='employee', password } = req.body;
    if (!firstName || !lastName || !email || !department || !designation || !dateOfJoining || !salary)
      return res.status(400).json({ success: false, message: 'firstName, lastName, email, department, designation, dateOfJoining, salary are required.' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'Email already exists.' });
    const tempPassword = password || `Fwc@${Math.random().toString(36).slice(-6)}`;
    const user = await User.create({ email, passwordHash: tempPassword, role });
    const employee = await Employee.create({ userId: user._id, firstName, lastName, email, phone, department, designation, managerId: managerId||null, dateOfJoining, employmentType: employmentType||'full-time', salary });
    user.employeeId = employee._id;
    await user.save();
    res.status(201).json({ success: true, message: 'Employee created.', data: employee, credentials: { email, tempPassword } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT update employee
const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    if (req.user.role === 'employee') {
      const self = await Employee.findOne({ userId: req.user._id });
      if (!self || self._id.toString() !== employee._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied.' });
      const { phone, profilePicture } = req.body;
      if (phone !== undefined) employee.phone = phone;
      if (profilePicture !== undefined) employee.profilePicture = profilePicture;
      await employee.save();
      return res.status(200).json({ success: true, data: employee });
    }
    const fields = ['firstName','lastName','phone','department','designation','managerId','dateOfJoining','employmentType','salary','lastPromotionDate','lastHikeDate','lastHikePercent','status','profilePicture'];
    fields.forEach(f => { if (req.body[f] !== undefined) employee[f] = req.body[f]; });
    await employee.save();
    res.status(200).json({ success: true, message: 'Employee updated.', data: employee });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE (soft) deactivate employee
const deactivateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    employee.status = 'terminated';
    await employee.save();
    await User.findByIdAndUpdate(employee.userId, { isActive: false });
    res.status(200).json({ success: true, message: 'Employee deactivated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET departments list
const getDepartments = async (req, res) => {
  try {
    const departments = await Employee.distinct('department');
    res.status(200).json({ success: true, data: departments.sort() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET my own profile
const getMyProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id }).populate('managerId','firstName lastName designation email');
    if (!employee) return res.status(404).json({ success: false, message: 'Profile not found.' });
    res.status(200).json({ success: true, data: employee });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get admin dashboard stats
// @route   GET /api/employees/stats
// @access  Admin, Senior Manager
// ─────────────────────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [total, active, byDept] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ status: 'active' }),
      Employee.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);
    res.status(200).json({ success: true, data: { total, active, byDept } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get employee's own dashboard stats
// @route   GET /api/employees/me/stats
// @access  Any authenticated user
// ─────────────────────────────────────────────────────────────────────────────
const getMyStats = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Profile not found.' });

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const Attendance  = require('../models/Attendance');
    const Leave       = require('../models/Leave');
    const Performance = require('../models/Performance');
    const Payroll     = require('../models/Payroll');

    const [daysPresent, pendingLeaves, lastReview, lastPayslip] = await Promise.all([
      Attendance.countDocuments({ employeeId: emp._id, date: { $gte: start }, status: { $in: ['present', 'wfh'] } }),
      Leave.countDocuments({ employeeId: emp._id, status: 'pending' }),
      Performance.findOne({ employeeId: emp._id }).sort({ createdAt: -1 }),
      Payroll.findOne({ employeeId: emp._id }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        daysPresent,
        pendingLeaves,
        performanceScore: lastReview?.metrics?.overallScore ?? null,
        reviewPeriod:     lastReview?.reviewPeriod ?? null,
        lastNetPay:       lastPayslip?.netPay ?? null,
        lastPayMonth:     lastPayslip?.month ?? null,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get today's attendance count (for admin)
// @route   GET /api/employees/attendance/today
// @access  Admin, Senior Manager
// ─────────────────────────────────────────────────────────────────────────────
const getTodayAttendance = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const present = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['present', 'wfh'] },
    });
    res.status(200).json({ success: true, data: { present } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/employees/:id/role — change user role (admin only)
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'senior_manager', 'hr_recruiter', 'employee'];
    if (!validRoles.includes(role))
      return res.status(400).json({ success: false, message: `role must be one of: ${validRoles.join(', ')}` });

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    await User.findByIdAndUpdate(employee.userId, { role });
    res.json({ success: true, message: `Role updated to ${role}.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/employees/:id/toggle-active — activate/deactivate user (admin only)
const toggleUserActive = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const user = await User.findById(employee.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });

    const newActive = !user.isActive;
    await User.findByIdAndUpdate(employee.userId, { isActive: newActive });
    employee.status = newActive ? 'active' : 'terminated';
    await employee.save();

    res.json({ success: true, message: `User ${newActive ? 'activated' : 'deactivated'}.`, isActive: newActive });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getAllEmployees, getEmployee, createEmployee, updateEmployee, deactivateEmployee, getDepartments, getMyProfile, getStats, getMyStats, getTodayAttendance, changeUserRole, toggleUserActive };
