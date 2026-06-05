const Payroll  = require('../models/Payroll');
const Employee = require('../models/Employee');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentMonthLabel = () => { const d = new Date(); return `${MONTHS[d.getMonth()]}-${d.getFullYear()}`; };

// GET /api/payroll — all payslips (admin / hr_recruiter)
const getAllPayroll = async (req, res) => {
  try {
    const { month, employeeId, status, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (month)      filter.month      = month;
    if (employeeId) filter.employeeId = employeeId;
    if (status)     filter.status     = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [payslips, total] = await Promise.all([
      Payroll.find(filter)
        .populate('employeeId', 'firstName lastName department designation')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payroll.countDocuments(filter),
    ]);

    res.json({ success: true, data: payslips, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payroll/summary — current-month totals (admin / hr_recruiter)
const getPayrollSummary = async (req, res) => {
  try {
    const month = currentMonthLabel();
    const payslips = await Payroll.find({ month });
    const totalNetPay = payslips.reduce((s, p) => s + (p.netPay || 0), 0);
    res.json({
      success: true,
      data: {
        month,
        totalNetPay,
        totalCount:     payslips.length,
        pendingCount:   payslips.filter(p => p.status === 'pending').length,
        processedCount: payslips.filter(p => p.status === 'processed').length,
        paidCount:      payslips.filter(p => p.status === 'paid').length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payroll/my — own payslips (any authenticated user)
const getMyPayroll = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });

    const payslips = await Payroll.find({ employeeId: emp._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: payslips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/payroll — create payslip (admin / hr_recruiter)
const createPayroll = async (req, res) => {
  try {
    const { employeeId, month, basicSalary, allowances, deductions, netPay, status } = req.body;
    if (!employeeId || !month || basicSalary == null || netPay == null)
      return res.status(400).json({ success: false, message: 'employeeId, month, basicSalary, and netPay are required.' });

    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const payslip = await Payroll.create({
      employeeId, month, basicSalary,
      allowances:  allowances  || {},
      deductions:  deductions  || {},
      netPay,
      status:      status || 'pending',
      processedBy: req.user._id,
      processedAt: new Date(),
    });

    await payslip.populate('employeeId', 'firstName lastName department designation');
    res.status(201).json({ success: true, data: payslip });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'A payslip for this employee and month already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/payroll/:id/status — update status (admin / hr_recruiter)
const updatePayrollStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'processed', 'paid', 'on-hold'];
    if (!valid.includes(status))
      return res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });

    const payslip = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status, processedBy: req.user._id, processedAt: new Date() },
      { new: true }
    ).populate('employeeId', 'firstName lastName department designation');

    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found.' });
    res.json({ success: true, data: payslip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/payroll/:id — admin only
const deletePayroll = async (req, res) => {
  try {
    const payslip = await Payroll.findByIdAndDelete(req.params.id);
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found.' });
    res.json({ success: true, message: 'Payslip deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllPayroll, getMyPayroll, createPayroll, updatePayrollStatus, deletePayroll, getPayrollSummary };
