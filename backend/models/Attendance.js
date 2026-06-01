const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day', 'wfh', 'holiday'],
      required: true,
      default: 'absent',
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0,
      max: 24,
    },
    markedVia: {
      type: String,
      enum: ['manual', 'ai_voice', 'portal', 'biometric'],
      default: 'portal',
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound unique: one record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });                  // fetch all attendance for a given date
attendanceSchema.index({ status: 1 });                // filter by attendance status
attendanceSchema.index({ employeeId: 1, status: 1 }); // flight-risk: count absences per employee

module.exports = mongoose.model('Attendance', attendanceSchema);
