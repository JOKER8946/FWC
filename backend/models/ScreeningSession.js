const mongoose = require('mongoose');

// ── Sub-schema: individual turn in the conversation ──────────────────────────
const conversationTurnSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['ai', 'candidate'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      // For voice mode: this is the transcript of the audio
    },
    audioUrl: {
      type: String,
      default: null,
      // Populated only in voice mode — points to recorded audio file
    },
    transcript: {
      type: String,
      default: null,
      // Web Speech API / Whisper transcript (voice mode only)
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // no separate _id per turn — reduces overhead at scale
);

// ── Main schema ───────────────────────────────────────────────────────────────
const screeningSessionSchema = new mongoose.Schema(
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
    mode: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },

    // ── Full conversation history ─────────────────────────────────────────────
    // Gemini reads the full history on each turn to dynamically adapt questions
    conversationHistory: {
      type: [conversationTurnSchema],
      default: [],
    },

    // ── AI-generated post-session analysis (populated on session completion) ──
    aiAnalysis: {
      communicationScore: { type: Number, default: null, min: 0, max: 100 },
      technicalScore: { type: Number, default: null, min: 0, max: 100 },
      confidenceScore: { type: Number, default: null, min: 0, max: 100 },
      keyInsights: { type: [String], default: [] },
      overallVerdict: {
        type: String,
        enum: ['advance', 'hold', 'reject', null],
        default: null,
      },
    },

    // ── Workflow State ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'abandoned'],
      default: 'scheduled',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: null, // computed on completion: completedAt - startedAt
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
screeningSessionSchema.index({ resumeId: 1 }, { unique: true }); // one session per resume
screeningSessionSchema.index({ jobId: 1 });
screeningSessionSchema.index({ status: 1 });
screeningSessionSchema.index({ jobId: 1, status: 1 });           // recruiter: sessions by job + state
screeningSessionSchema.index({ 'aiAnalysis.overallVerdict': 1 }); // filter by verdict

module.exports = mongoose.model('ScreeningSession', screeningSessionSchema);
