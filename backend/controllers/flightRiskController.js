const Employee    = require('../models/Employee');
const Attendance  = require('../models/Attendance');
const Performance = require('../models/Performance');
const Leave       = require('../models/Leave');
const FlightRisk  = require('../models/FlightRisk');
const { predict, generateInsight } = require('../services/flightRiskNN');

const computeSignals = async (employee) => {
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

  const [recentAtt, olderAtt] = await Promise.all([
    Attendance.countDocuments({ employeeId: employee._id, date: { $gte: d30 }, status: 'present' }),
    Attendance.countDocuments({ employeeId: employee._id, date: { $gte: d60, $lt: d30 }, status: 'present' }),
  ]);
  let attendanceDropPercent = 0;
  if (olderAtt > 0) attendanceDropPercent = Math.max(0, Math.round(((olderAtt - recentAtt) / olderAtt) * 100));

  const ref = employee.dateOfJoining || now;
  const daysSinceLastPromotion = Math.floor((now - new Date(employee.lastPromotionDate || ref)) / 86400000);
  const daysSinceLastHike      = Math.floor((now - new Date(employee.lastHikeDate || ref)) / 86400000);

  const reviews = await Performance.find({ employeeId: employee._id }).sort({ createdAt: -1 }).limit(2).lean();
  let performanceTrend = 'unknown';
  let avgPerformanceScore = null;
  if (reviews.length >= 2) {
    avgPerformanceScore = Math.round((reviews[0].metrics.overallScore + reviews[1].metrics.overallScore) / 2);
    const diff = reviews[0].metrics.overallScore - reviews[1].metrics.overallScore;
    performanceTrend = diff >= 5 ? 'improving' : diff <= -5 ? 'declining' : 'stable';
  } else if (reviews.length === 1) {
    avgPerformanceScore = reviews[0].metrics.overallScore;
    performanceTrend = 'stable';
  }

  const [recentLeaves, olderLeaves] = await Promise.all([
    Leave.countDocuments({ employeeId: employee._id, appliedAt: { $gte: d30 }, status: { $ne: 'cancelled' } }),
    Leave.countDocuments({ employeeId: employee._id, appliedAt: { $gte: d90, $lt: d30 }, status: { $ne: 'cancelled' } }),
  ]);
  const leaveFrequencyIncreased = recentLeaves > Math.floor(olderLeaves / 2) + 1;

  const recentAbsenceCount = await Attendance.countDocuments({
    employeeId: employee._id, date: { $gte: d30 }, status: 'absent',
  });

  return { attendanceDropPercent, daysSinceLastPromotion, daysSinceLastHike, performanceTrend, leaveFrequencyIncreased, avgPerformanceScore, recentAbsenceCount };
};

const runAnalysis = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const query = employeeId ? { _id: employeeId, status: 'active' } : { status: 'active' };
    const employees = await Employee.find(query).lean();
    if (!employees.length) return res.status(404).json({ success: false, message: 'No active employees found.' });

    const results = [];
    for (const emp of employees) {
      try {
        const signals = await computeSignals(emp);
        const { riskScore, riskLevel, normalizedInput } = predict(signals);
        const aiInsight = generateInsight(signals, riskLevel, `${emp.firstName} ${emp.lastName}`);

        await FlightRisk.findOneAndUpdate(
          { employeeId: emp._id },
          { employeeId: emp._id, riskScore, riskLevel, signals, normalizedInput, aiInsight, calculatedAt: new Date(), isResolved: false },
          { upsert: true, new: true }
        );
        results.push({ employeeId: emp._id, name: `${emp.firstName} ${emp.lastName}`, department: emp.department, riskScore, riskLevel });
      } catch (err) {
        results.push({ employeeId: emp._id, error: err.message });
      }
    }
    results.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
    res.status(200).json({ success: true, message: `Analysis complete for ${results.length} employee(s).`, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllRisks = async (req, res) => {
  try {
    const { riskLevel, resolved } = req.query;
    const query = {};
    if (req.user.role === 'senior_manager') {
      const self = await Employee.findOne({ userId: req.user._id });
      if (self) {
        const directReports = await Employee.find({ managerId: self._id }).select('_id').lean();
        if (directReports.length > 0) query.employeeId = { $in: directReports.map(e => e._id) };
      }
    }
    if (riskLevel) query.riskLevel = riskLevel;
    if (resolved !== undefined) query.isResolved = resolved === 'true';
    const risks = await FlightRisk.find(query)
      .populate('employeeId', 'firstName lastName department designation profilePicture')
      .sort({ riskScore: -1 }).lean();
    res.status(200).json({ success: true, count: risks.length, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getEmployeeRisk = async (req, res) => {
  try {
    const risk = await FlightRisk.findOne({ employeeId: req.params.employeeId })
      .populate('employeeId', 'firstName lastName department designation dateOfJoining');
    if (!risk) return res.status(404).json({ success: false, message: 'No risk record found. Run analysis first.' });
    res.status(200).json({ success: true, data: risk });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const resolveRisk = async (req, res) => {
  try {
    const { actionTaken } = req.body;
    const risk = await FlightRisk.findByIdAndUpdate(
      req.params.id,
      { isResolved: true, resolvedAt: new Date(), actionTaken: actionTaken || '', actionTakenBy: req.user._id },
      { new: true }
    );
    if (!risk) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.status(200).json({ success: true, message: 'Marked as resolved.', data: risk });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const retrainModel = async (req, res) => {
  try {
    const { retrain } = require('../services/flightRiskNN');
    const result = retrain();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { runAnalysis, getAllRisks, getEmployeeRisk, resolveRisk, retrainModel };
