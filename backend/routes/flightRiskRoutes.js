const express = require('express');
const router  = express.Router();
const {
  runAnalysis, getAllRisks, getEmployeeRisk, resolveRisk, retrainModel,
} = require('../controllers/flightRiskController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'senior_manager'));

router.get('/',                   getAllRisks);
router.get('/:employeeId',        getEmployeeRisk);
router.post('/run',               authorize('admin'), runAnalysis);
router.post('/retrain',           authorize('admin'), retrainModel);
router.patch('/:id/resolve',      resolveRisk);

module.exports = router;
