const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');

const startOfDay = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};

const endOfDay = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(23, 59, 59, 999);
  return s;
};

// Status based on check-in time: present if ≤ 09:30, otherwise late
const statusFromTime = (t) => {
  const h = t.getHours(), m = t.getMinutes();
  return (h < 9 || (h === 9 && m <= 30)) ? 'present' : 'late';
};

// ── POST /api/attendance/check-in ─────────────────────────────────────────────
const checkIn = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee profile linked to this account.' });

    const today = startOfDay();
    const existing = await Attendance.findOne({ employeeId: empId, date: today });

    if (existing?.checkIn) {
      return res.status(409).json({ success: false, message: 'Already checked in today.', data: existing });
    }

    const now    = new Date();
    const status = statusFromTime(now);

    let record;
    if (existing) {
      existing.checkIn    = now;
      existing.status     = status;
      existing.markedVia  = 'portal';
      record = await existing.save();
    } else {
      record = await Attendance.create({
        employeeId: empId,
        date:       today,
        checkIn:    now,
        status,
        markedVia:  'portal',
      });
    }

    res.status(200).json({ success: true, message: `Checked in at ${now.toLocaleTimeString()}`, data: record });
  } catch (err) {
    console.error('checkIn error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/attendance/check-out ────────────────────────────────────────────
const checkOut = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee profile linked.' });

    const today  = startOfDay();
    const record = await Attendance.findOne({ employeeId: empId, date: today });

    if (!record?.checkIn) return res.status(400).json({ success: false, message: 'You have not checked in today.' });
    if (record.checkOut)  return res.status(409).json({ success: false, message: 'Already checked out today.', data: record });

    const now = new Date();
    record.checkOut    = now;
    record.hoursWorked = parseFloat(((now - record.checkIn) / 3_600_000).toFixed(2));
    await record.save();

    res.status(200).json({ success: true, message: `Checked out at ${now.toLocaleTimeString()}`, data: record });
  } catch (err) {
    console.error('checkOut error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/attendance/today ─────────────────────────────────────────────────
const getToday = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    if (!empId) return res.status(200).json({ success: true, data: null });

    const record = await Attendance.findOne({ employeeId: empId, date: startOfDay() });
    res.status(200).json({ success: true, data: record || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/attendance/my?month=YYYY-MM ─────────────────────────────────────
const getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    if (!empId) return res.status(200).json({ success: true, data: [] });

    let from, to;
    if (req.query.month) {
      const [y, m] = req.query.month.split('-').map(Number);
      from = new Date(y, m - 1, 1);
      to   = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
      to   = endOfDay();
      from = new Date(Date.now() - 29 * 86_400_000);
      from.setHours(0, 0, 0, 0);
    }

    const records = await Attendance.find({ employeeId: empId, date: { $gte: from, $lte: to } })
      .sort({ date: 1 })
      .lean();

    res.status(200).json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/attendance/summary?date=YYYY-MM-DD ──────────────────────────────
// Admin / manager: today's headcount
const getTodaySummary = async (req, res) => {
  try {
    const dateStr = req.query.date;
    const day = dateStr ? startOfDay(new Date(dateStr)) : startOfDay();
    const eod = endOfDay(day);

    const records = await Attendance.find({ date: { $gte: day, $lte: eod } })
      .populate('employeeId', 'firstName lastName department designation')
      .lean();

    const totalEmployees = await Employee.countDocuments({ isActive: { $ne: false } });

    const counts = { present: 0, late: 0, absent: 0, wfh: 0, 'half-day': 0, holiday: 0 };
    records.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    counts.absent = Math.max(0, totalEmployees - records.length);

    res.status(200).json({
      success: true,
      data: { summary: counts, totalEmployees, records },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/attendance?employeeId=&from=&to= ─────────────────────────────────
const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, from, to, date } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (date) {
      filter.date = { $gte: startOfDay(new Date(date)), $lte: endOfDay(new Date(date)) };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(new Date(from));
      if (to)   filter.date.$lte = endOfDay(new Date(to));
    }

    const records = await Attendance.find(filter)
      .populate('employeeId', 'firstName lastName department designation')
      .sort({ date: -1 })
      .limit(500)
      .lean();

    res.status(200).json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/attendance/mark (admin / manager) ───────────────────────────────
const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, checkIn: ci, checkOut: co } = req.body;
    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'employeeId, date, and status are required.' });
    }

    const day     = startOfDay(new Date(date));
    const checkInT  = ci ? new Date(ci) : null;
    const checkOutT = co ? new Date(co) : null;
    const hoursWorked = checkInT && checkOutT
      ? parseFloat(((checkOutT - checkInT) / 3_600_000).toFixed(2))
      : 0;

    const record = await Attendance.findOneAndUpdate(
      { employeeId, date: day },
      { employeeId, date: day, status, checkIn: checkInT, checkOut: checkOutT, hoursWorked, markedVia: 'manual' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: record });
  } catch (err) {
    console.error('markAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkIn, checkOut, getToday, getMyAttendance, getTodaySummary, getAllAttendance, markAttendance };
