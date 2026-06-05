const Job = require('../models/Job');

const createJob = async (req, res) => {
  try {
    const { title, department, description, requirements, experienceRequired, salaryRange, employmentType, closingDate } = req.body;
    if (!title || !department || !description)
      return res.status(400).json({ success: false, message: 'title, department, description required.' });
    const job = await Job.create({
      title, department, description,
      requirements: requirements || [],
      experienceRequired: experienceRequired || 0,
      salaryRange: salaryRange || { min: 0, max: 0 },
      employmentType: employmentType || 'full-time',
      closingDate: closingDate || null,
      postedBy: req.user._id,
      status: 'open',
    });
    res.status(201).json({ success: true, data: job });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getJobs = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: jobs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.status(200).json({ success: true, data: job });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { createJob, getJobs, updateJob };
