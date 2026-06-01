const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },

    // ── File Storage ─────────────────────────────────────────────────────────
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true, // cloud storage URL (S3 / Cloudinary / local)
    },
    rawText: {
      type: String,
      default: null,
      // Full extracted text from pdf-parse — fed to Gemini for scoring
    },

    // ── AI Blind Scoring (personal identifiers stripped) ─────────────────────
    // Recruiters see ONLY these fields during initial review phase
    blindScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    skillsMatch: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    experienceMatch: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    aiEvaluation: {
      strengths: { type: [String], default: [] },
      gaps: { type: [String], default: [] },
      redFlags: { type: [String], default: [] },
      recommendation: {
        type: String,
        enum: ['strong_hire', 'consider', 'reject', null],
        default: null,
      },
    },

    // ── Candidate PII — hidden until shortlisting stage ───────────────────────
    // Select: false ensures this subdoc is never returned unless .select('+candidateInfo')
    candidateInfo: {
      name: { type: String, trim: true, default: null },
      email: { type: String, lowercase: true, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      location: { type: String, trim: true, default: null },
    },

    // ── Workflow State ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'screened', 'shortlisted', 'rejected', 'interview_scheduled'],
      default: 'uploaded',
    },
    screeningSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScreeningSession',
      default: null,
    },
    screenedAt: {
      type: Date,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // HR Recruiter
      required: true,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
resumeSchema.index({ jobId: 1 });
resumeSchema.index({ status: 1 });
resumeSchema.index({ blindScore: -1 });                   // sort candidates by score descending
resumeSchema.index({ jobId: 1, status: 1 });              // recruiter: all screened resumes for a job
resumeSchema.index({ jobId: 1, blindScore: -1 });         // recruiter: ranked shortlist per job
resumeSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('Resume', resumeSchema);
