const mongoose = require('mongoose');

const policyDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Employee Handbook v3", "Parental Leave Policy 2025"
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true, // cloud storage URL for the original PDF
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Admin only — enforced at route level via middleware
      required: true,
    },
    version: {
      type: String,
      trim: true,
      default: '1.0',
    },
    isActive: {
      type: Boolean,
      default: true,
      // Only the active version is queried by the RAG bot
      // Old versions are kept for audit purposes
    },
    totalChunks: {
      type: Number,
      default: 0,
      // Set after chunking is complete — used to verify RAG ingestion
    },
    chunkingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
policyDocumentSchema.index({ isActive: 1 });                   // RAG bot: only query active docs
policyDocumentSchema.index({ uploadedBy: 1 });
policyDocumentSchema.index({ chunkingStatus: 1 });             // background job: find pending docs
policyDocumentSchema.index({ isActive: 1, chunkingStatus: 1 });

module.exports = mongoose.model('PolicyDocument', policyDocumentSchema);
