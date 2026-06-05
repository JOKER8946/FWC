const express = require('express');
const router  = express.Router();
const {
  getMyPerformance, getAllPerformance,
  createReview, updateReview, acknowledgeReview,
} = require('../controllers/performanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my', getMyPerformance);
router.get('/',   authorize('admin', 'senior_manager'), getAllPerformance);
router.post('/',  authorize('admin', 'senior_manager'), createReview);

// acknowledge must be before /:id so Express doesn't treat 'acknowledge' as an id
router.patch('/:id/acknowledge', acknowledgeReview);
router.patch('/:id', authorize('admin', 'senior_manager'), updateReview);

module.exports = router;
