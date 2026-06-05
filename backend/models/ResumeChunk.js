const mongoose = require('mongoose');

const resumeChunkSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    chunkIndex: { type: Number, required: true, min: 0 },
    content: { type: String, required: true, trim: true },
    charCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
resumeChunkSchema.index({ resumeId: 1, chunkIndex: 1 }, { unique: true });
resumeChunkSchema.index({ jobId: 1 });

// ── Full-text index: powers keyword RAG retrieval ────────────────────────────
resumeChunkSchema.index({ content: 'text' });

module.exports = mongoose.model('ResumeChunk', resumeChunkSchema);
