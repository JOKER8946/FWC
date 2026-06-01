const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'compensatory'],
      required: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0.5, // supports half-day
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // the manager who approved/rejected
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
leaveSchema.index({ employeeId: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ employeeId: 1, status: 1 });        // employee dashboard: my pending leaves
leaveSchema.index({ approvedBy: 1, status: 1 });        // manager dashboard: leaves awaiting my approval
leaveSchema.index({ fromDate: 1, toDate: 1 });          // date-range queries

module.exports = mongoose.model('Leave', leaveSchema);
