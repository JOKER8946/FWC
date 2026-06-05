const express = require('express');
const router  = express.Router();
const {
  createSession, sendMessage, endSession, getSession, getSessions,
} = require('../controllers/screeningController');
const { generateCandidateLink } = require('../controllers/candidateController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'hr_recruiter'));

router.get('/',                        getSessions);
router.post('/create',                 createSession);
router.post('/:id/generate-link',      generateCandidateLink); // before /:id to avoid conflict
router.get('/:id',                     getSession);
router.post('/:id/message',            sendMessage);
router.post('/:id/end',                endSession);

module.exports = router;
