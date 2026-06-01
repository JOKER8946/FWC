const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // self-referencing — points to the reporting manager
      default: null,
    },
    dateOfJoining: {
      type: Date,
      required: true,
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    salary: {
      type: Number,
      required: true,
      min: 0,
    },
    lastPromotionDate: {
      type: Date,
      default: null,
    },
    lastHikeDate: {
      type: Date,
      default: null,
    },
    lastHikePercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'resigned', 'terminated', 'on-leave'],
      default: 'active',
    },
    profilePicture: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
employeeSchema.index({ userId: 1 }, { unique: true });
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ department: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ managerId: 1 });                // fetch all direct reports
employeeSchema.index({ department: 1, status: 1 });    // department-level dashboard filters

module.exports = mongoose.model('Employee', employeeSchema);
