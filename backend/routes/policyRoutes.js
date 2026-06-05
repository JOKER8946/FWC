const express = require('express');
const router  = express.Router();
const { uploadPolicy, listPolicies, togglePolicy, deletePolicy } = require('../controllers/policyController');
const { askBot } = require('../controllers/ragBotController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../config/multer');

router.use(protect);

// ── All authenticated users ───────────────────────────────────────────────────
router.get('/',    listPolicies);
router.post('/ask', askBot);

// ── Admin only ────────────────────────────────────────────────────────────────
router.post('/upload', authorize('admin'), upload.single('policy'), uploadPolicy);
router.patch('/:id/toggle', authorize('admin'), togglePolicy);
router.delete('/:id',       authorize('admin'), deletePolicy);

module.exports = router;
