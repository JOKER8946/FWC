const express = require('express');
const router = express.Router();
const { getLeaves, createLeave, updateLeaveStatus } = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getLeaves);
router.post('/', createLeave);
router.patch('/:id/:action', authorize('admin','senior_manager'), updateLeaveStatus);

module.exports = router;
