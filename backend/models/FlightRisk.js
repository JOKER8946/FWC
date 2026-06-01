const mongoose = require('mongoose');

const flightRiskSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // ── Risk Score ────────────────────────────────────────────────────────────
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      // 0-30: low | 31-60: medium | 61-85: high | 86-100: critical
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },

    // ── Data Signals used to calculate the score ──────────────────────────────
    // These are snapshot values at the time of calculation — not live references
    signals: {
      attendanceDropPercent: {
        type: Number,
        default: 0,
        // % drop in attendance vs. their 90-day average
      },
      daysSinceLastPromotion: {
        type: Number,
        default: 0,
      },
      daysSinceLastHike: {
        type: Number,
        default: 0,
      },
      performanceTrend: {
        type: String,
        enum: ['improving', 'stable', 'declining', 'unknown'],
        default: 'unknown',
        // Derived from comparing last 2 performance review overallScores
      },
      leaveFrequencyIncreased: {
        type: Boolean,
        default: false,
        // True if leave applications in last 30 days > monthly average
      },
      avgPerformanceScore: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
      recentAbsenceCount: {
        type: Number,
        default: 0,
        // Number of unplanned absences in last 30 days
      },
    },

    // ── Gemini AI-generated Retention Insight ─────────────────────────────────
    aiInsight: {
      type: String,
      default: null,
      trim: true,
      // e.g. "Priya has shown a 34% drop in attendance and has not received a
      //       hike in 18 months. Recommend immediate 1:1 and salary review."
    },

    // ── Manager Intervention Tracking ────────────────────────────────────────
    actionTaken: {
      type: String,
      trim: true,
      default: null,
      // Manager logs what retention action they took
    },
    actionTakenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actionTakenAt: {
      type: Date,
      default: null,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },

    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
flightRiskSchema.index({ employeeId: 1 });
flightRiskSchema.index({ riskLevel: 1 });
flightRiskSchema.index({ riskScore: -1 });                     // admin: sort by highest risk
flightRiskSchema.index({ isResolved: 1 });
flightRiskSchema.index({ riskLevel: 1, isResolved: 1 });       // manager: active high-risk flags
flightRiskSchema.index({ employeeId: 1, calculatedAt: -1 });   // latest risk record per employee
flightRiskSchema.index({ calculatedAt: -1 });                  // time-series: recent calculations

module.exports = mongoose.model('FlightRisk', flightRiskSchema);
