const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      // Format: 'May-2025'
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    allowances: {
      hra: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      internet: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    deductions: {
      pf: { type: Number, default: 0 },          // Provident Fund
      tax: { type: Number, default: 0 },          // TDS / Income Tax
      loanRepayment: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    netPay: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'paid', 'on-hold'],
      default: 'pending',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound unique: one payslip per employee per month
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
payrollSchema.index({ status: 1 });
payrollSchema.index({ month: 1 });                       // admin: all payroll for a given month
payrollSchema.index({ employeeId: 1, status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
