const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    reviewPeriod: {
      type: String,
      required: true,
      trim: true,
      // Format: 'Q1-2025', 'Q2-2025', etc.
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // the manager conducting the review
      required: true,
    },
    metrics: {
      taskCompletionRate: { type: Number, default: 0, min: 0, max: 100 },
      attendanceScore: { type: Number, default: 0, min: 0, max: 100 },
      qualityScore: { type: Number, default: 0, min: 0, max: 100 },
      teamworkScore: { type: Number, default: 0, min: 0, max: 100 },
      communicationScore: { type: Number, default: 0, min: 0, max: 100 },
      overallScore: { type: Number, default: 0, min: 0, max: 100 },
    },
    managerNotes: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Gemini AI-generated fields ──────────────────────────────────────────
    aiSummary: {
      type: String,
      default: null,
      // Example: "Ravi consistently meets targets but attendance has dipped 12%
      //           over the last quarter. Consider a check-in before next review."
    },
    aiRecommendations: {
      type: [String],
      default: [],
      // Example: ["Enroll in time-management workshop", "Schedule 1:1 with manager"]
    },
    aiGeneratedAt: {
      type: Date,
      default: null,
    },
    // ───────────────────────────────────────────────────────────────────────

    status: {
      type: String,
      enum: ['draft', 'submitted', 'acknowledged'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound unique: one review per employee per quarter
performanceSchema.index({ employeeId: 1, reviewPeriod: 1 }, { unique: true });
performanceSchema.index({ reviewedBy: 1 });
performanceSchema.index({ 'metrics.overallScore': 1 });  // sort by score on dashboards
performanceSchema.index({ status: 1 });
performanceSchema.index({ employeeId: 1, status: 1 });   // flight-risk: fetch latest reviews

module.exports = mongoose.model('Performance', performanceSchema);
