const Performance = require('../models/Performance');
const Employee    = require('../models/Employee');

// GET /api/performance/my — own reviews (any role)
const getMyPerformance = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });

    const reviews = await Performance.findOne({ employeeId: emp._id })
      .sort({ createdAt: -1 })
      .lean();

    const allReviews = await Performance.find({ employeeId: emp._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'firstName lastName')
      .lean();

    res.json({ success: true, data: allReviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/performance — all reviews (admin / senior_manager)
const getAllPerformance = async (req, res) => {
  try {
    const { employeeId, reviewPeriod, status, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (employeeId)   filter.employeeId   = employeeId;
    if (reviewPeriod) filter.reviewPeriod = reviewPeriod;
    if (status)       filter.status       = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      Performance.find(filter)
        .populate('employeeId', 'firstName lastName department designation')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Performance.countDocuments(filter),
    ]);

    res.json({ success: true, data: reviews, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/performance — create review (admin / senior_manager)
const createReview = async (req, res) => {
  try {
    const { employeeId, reviewPeriod, metrics, managerNotes, aiSummary, aiRecommendations } = req.body;
    if (!employeeId || !reviewPeriod)
      return res.status(400).json({ success: false, message: 'employeeId and reviewPeriod are required.' });

    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const reviewer = await Employee.findOne({ userId: req.user._id });

    const review = await Performance.create({
      employeeId,
      reviewPeriod,
      reviewedBy: reviewer?._id || employeeId,
      metrics:    metrics || {},
      managerNotes: managerNotes || null,
      aiSummary:    aiSummary || null,
      aiRecommendations: aiRecommendations || [],
      status: 'submitted',
    });

    await review.populate('employeeId', 'firstName lastName department designation');
    await review.populate('reviewedBy', 'firstName lastName');
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'A review for this employee and period already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/performance/:id — update review (admin / senior_manager)
const updateReview = async (req, res) => {
  try {
    const { metrics, managerNotes, status } = req.body;
    const update = {};
    if (metrics)      update.metrics      = metrics;
    if (managerNotes !== undefined) update.managerNotes = managerNotes;
    if (status)       update.status       = status;

    const review = await Performance.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('employeeId', 'firstName lastName department designation')
      .populate('reviewedBy', 'firstName lastName');

    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/performance/:id/acknowledge — employee acknowledges (any role)
const acknowledgeReview = async (req, res) => {
  try {
    const review = await Performance.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged' },
      { new: true }
    ).populate('employeeId', 'firstName lastName');

    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getMyPerformance, getAllPerformance, createReview, updateReview, acknowledgeReview };
