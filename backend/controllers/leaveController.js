const Leave    = require('../models/Leave');
const Employee = require('../models/Employee');

const getLeaves = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ userId: req.user._id });
      if (emp) query.employeeId = emp._id;
    }
    const leaves = await Leave.find(query)
      .populate('employeeId', 'firstName lastName department')
      .sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createLeave = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    const { leaveType, fromDate, toDate, reason } = req.body;
    const from = new Date(fromDate); const to = new Date(toDate);
    const totalDays = Math.ceil((to - from) / (1000*60*60*24)) + 1;
    const leave = await Leave.create({ employeeId: emp._id, leaveType, fromDate, toDate, totalDays, reason, status: 'pending' });
    res.status(201).json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { action } = req.params;
    const status = action === 'approve' ? 'approved' : 'rejected';
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy: req.user.employeeId, approvedAt: new Date() },
      { new: true }
    );
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found.' });
    res.status(200).json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getLeaves, createLeave, updateLeaveStatus };
