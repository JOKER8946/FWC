const express = require('express');
const router  = express.Router();
const {
  getAllPayroll, getMyPayroll, createPayroll,
  updatePayrollStatus, deletePayroll, getPayrollSummary,
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Self-service — must come before /:id routes
router.get('/my',      getMyPayroll);
router.get('/summary', authorize('admin', 'hr_recruiter'), getPayrollSummary);

// HR + Admin management
router.get('/',    authorize('admin', 'hr_recruiter'), getAllPayroll);
router.post('/',   authorize('admin', 'hr_recruiter'), createPayroll);

// Per-payslip actions
router.patch('/:id/status', authorize('admin', 'hr_recruiter'), updatePayrollStatus);
router.delete('/:id',       authorize('admin'),                  deletePayroll);

module.exports = router;
