const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requirements: {
      type: [String],
      default: [],
      // Array of skill/qualification strings used by the AI blind screener
    },
    experienceRequired: {
      type: Number,
      default: 0,
      min: 0,
    },
    salaryRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    location: {
      type: String,
      trim: true,
      default: 'Bangalore, India',
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // HR Recruiter
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'on-hold', 'draft'],
      default: 'draft',
    },
    applicationsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    closingDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
jobSchema.index({ status: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ status: 1, department: 1 });  // recruiter: open jobs by department
jobSchema.index({ createdAt: -1 });             // latest jobs first

module.exports = mongoose.model('Job', jobSchema);
