const express      = require('express');
const router       = express.Router();
const {
  getCandidateSession,
  candidateSendMessage,
  candidateEndSession,
  recordProctoringEvent,
} = require('../controllers/candidateController');

// No auth middleware on any route — all access is token-gated at the controller level

// Token-gated candidate interview routes
router.get( '/:token',                    getCandidateSession);
router.post('/:token/message',            candidateSendMessage);
router.post('/:token/end',                candidateEndSession);
router.post('/:token/proctoring-event',   recordProctoringEvent);

module.exports = router;
