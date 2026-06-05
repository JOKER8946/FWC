const express = require('express');
const router  = express.Router();
const {
  getAllEmployees, getEmployee, createEmployee,
  updateEmployee, deactivateEmployee, getDepartments,
  getMyProfile, getStats, getMyStats, getTodayAttendance,
  changeUserRole, toggleUserActive,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Special routes BEFORE /:id
router.get('/me',                getMyProfile);
router.get('/me/stats',          getMyStats);
router.get('/departments',       authorize('admin','senior_manager','hr_recruiter'), getDepartments);
router.get('/stats',             authorize('admin','senior_manager'), getStats);
router.get('/attendance/today',  authorize('admin','senior_manager'), getTodayAttendance);

// Main CRUD
router.route('/')
  .get(authorize('admin','senior_manager','hr_recruiter'), getAllEmployees)
  .post(authorize('admin'), createEmployee);

// Admin-only per-employee actions — must be before /:id catch-all
router.patch('/:id/role',          authorize('admin'), changeUserRole);
router.patch('/:id/toggle-active', authorize('admin'), toggleUserActive);

router.route('/:id')
  .get(getEmployee)
  .put(updateEmployee)
  .delete(authorize('admin'), deactivateEmployee);

module.exports = router;
