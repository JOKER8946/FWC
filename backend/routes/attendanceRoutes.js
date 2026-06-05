const express = require('express');
const router  = express.Router();
const {
  checkIn, checkOut, getToday, getMyAttendance,
  getTodaySummary, getAllAttendance, markAttendance,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Employee-accessible (self)
router.post('/check-in',  checkIn);
router.post('/check-out', checkOut);
router.get('/today',      getToday);
router.get('/my',         getMyAttendance);

// Admin / manager only
router.get('/summary',    authorize('admin', 'senior_manager'), getTodaySummary);
router.get('/',           authorize('admin', 'senior_manager'), getAllAttendance);
router.post('/mark',      authorize('admin', 'senior_manager'), markAttendance);

module.exports = router;
