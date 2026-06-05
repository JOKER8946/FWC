const express = require('express');
const router  = express.Router();
const {
  uploadAndScreen, getResumes, getResume,
  shortlistResume, rejectResume, getJobsForScreener,
} = require('../controllers/resumeController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../config/multer');

router.use(protect);
router.use(authorize('admin', 'hr_recruiter'));

// Special routes first
router.get('/jobs', getJobsForScreener);

// Main routes
router.get('/',    getResumes);
router.post('/upload', upload.single('resume'), uploadAndScreen);

router.get('/:id',            getResume);
router.patch('/:id/shortlist', shortlistResume);
router.patch('/:id/reject',    rejectResume);

module.exports = router;
