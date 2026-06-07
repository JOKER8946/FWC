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
    },
    // Raw Web-Speech-API transcript for voice turns. Mirrors `message` for
    // voice turns (the candidate's text *is* the transcript) but kept as a
    // distinct field so future flows can diverge — e.g. typed edits to a
    // voice transcript, or a separate STT source via Gemini.
    transcript: {
      type: String,
      default: null,
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
      summary: { type: String, default: '' },
    },

    // ── Candidate portal token (generated when HR shares interview link) ────────
    candidateToken: {
      type: String,
      default: null,
    },
    candidateTokenExpiresAt: {
      type: Date,
      default: null,
    },

    // ── Proctoring (tab-switch / focus-loss events during candidate interview) ─
    proctoring: {
      tabSwitches:     { type: Number, default: 0 },
      focusLostEvents: { type: Number, default: 0 },
      flagged:         { type: Boolean, default: false },
      events: {
        type: [
          {
            type:      { type: String, enum: ['tab_switch', 'focus_lost', 'fullscreen_exit'] },
            timestamp: { type: Date, default: Date.now },
            _id: false,
          },
        ],
        default: [],
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
screeningSessionSchema.index({ jobId: 1, status: 1 });            // recruiter: sessions by job + state
screeningSessionSchema.index({ 'aiAnalysis.overallVerdict': 1 });  // filter by verdict
screeningSessionSchema.index({ candidateToken: 1 }, { sparse: true }); // fast token lookup; sparse skips null

module.exports = mongoose.model('ScreeningSession', screeningSessionSchema);
