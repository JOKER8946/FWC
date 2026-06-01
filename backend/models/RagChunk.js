const mongoose = require('mongoose');

const ragChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PolicyDocument',
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
      // Sequential index: 0, 1, 2... for ordering and debugging
    },
    content: {
      type: String,
      required: true,
      trim: true,
      // The actual policy text chunk sent to Gemini as context
      // Recommended chunk size: ~500 tokens / ~2,000 characters
    },
    metadata: {
      pageNumber: { type: Number, default: null },
      section: { type: String, trim: true, default: null },
      // e.g. "Section 4: Leave Policy", "Chapter 2: Code of Conduct"
      characterCount: { type: Number, default: 0 },
    },
    // Optional: store vector embeddings if you upgrade to Atlas Vector Search
    // embedding: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
ragChunkSchema.index({ documentId: 1 });
ragChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true }); // ordered traversal
ragChunkSchema.index({ documentId: 1, 'metadata.section': 1 });           // section-level search

// ── Text Index for keyword search ─────────────────────────────────────────────
// Enables $text queries: db.ragchunks.find({ $text: { $search: "parental leave" } })
// This is your fallback retrieval method before adopting vector search
ragChunkSchema.index({ content: 'text', 'metadata.section': 'text' });

module.exports = mongoose.model('RagChunk', ragChunkSchema);
