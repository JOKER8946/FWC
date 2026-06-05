const express = require('express');
const router  = express.Router();
const { createJob, getJobs, updateJob } = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'hr_recruiter', 'senior_manager'));

router.route('/').get(getJobs).post(authorize('admin', 'hr_recruiter'), createJob);
router.route('/:id').put(authorize('admin', 'hr_recruiter'), updateJob);

module.exports = router;
