const ScreeningSession = require('../models/ScreeningSession');
const Resume           = require('../models/Resume');
const Job              = require('../models/Job');
const { generateContent } = require('../services/geminiService');
const {
  MAX_TURNS,
  buildOpeningPrompt,
  buildFollowUpPrompt,
  buildAnalysisPrompt,
  parseAnalysis,
} = require('../utils/interviewHelpers');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new screening session + generate opening question
// @route   POST /api/screening/create
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const createSession = async (req, res) => {
  try {
    const { resumeId, mode = 'text' } = req.body;
    if (!resumeId) return res.status(400).json({ success: false, message: 'resumeId required.' });

    const resume = await Resume.findById(resumeId).populate('jobId');
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });

    const job = resume.jobId;

    // Check for existing active session
    const existing = await ScreeningSession.findOne({
      resumeId, status: { $in: ['scheduled', 'in_progress'] },
    }).select('-candidateToken -candidateTokenExpiresAt');
    if (existing) {
      return res.status(200).json({ success: true, message: 'Existing session resumed.', data: existing });
    }

    const openingQuestion = await generateContent(buildOpeningPrompt(job, resume));

    const session = await ScreeningSession.create({
      resumeId,
      jobId: job?._id,
      mode,
      status: 'in_progress',
      startedAt: new Date(),
      conversationHistory: [{ role: 'ai', message: openingQuestion, timestamp: new Date() }],
    });

    await Resume.findByIdAndUpdate(resumeId, {
      status: 'interview_scheduled',
      screeningSessionId: session._id,
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    console.error('createSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Send candidate message → get AI follow-up (HR proxy mode)
// @route   POST /api/screening/:id/message
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { message, transcript } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required.' });

    const session = await ScreeningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    if (session.status === 'completed') return res.status(400).json({ success: false, message: 'Session already completed.' });

    const job = await Job.findById(session.jobId);

    session.conversationHistory.push({
      role: 'candidate',
      message: message.trim(),
      transcript: transcript || null,
      timestamp: new Date(),
    });

    const turnCount  = session.conversationHistory.filter(t => t.role === 'candidate').length;
    const isLastTurn = turnCount >= MAX_TURNS;

    const followUpQuestion = await generateContent(
      buildFollowUpPrompt(job, session.conversationHistory, turnCount)
    );

    session.conversationHistory.push({
      role: 'ai',
      message: followUpQuestion,
      timestamp: new Date(),
    });

    if (isLastTurn) session.status = 'completed';
    await session.save();

    res.status(200).json({
      success: true,
      data: { aiMessage: followUpQuestion, turnCount, isLastTurn, status: session.status },
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    End session + generate full AI analysis
// @route   POST /api/screening/:id/end
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const endSession = async (req, res) => {
  try {
    const session = await ScreeningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    const job         = await Job.findById(session.jobId);
    const analysisRaw = await generateContent(buildAnalysisPrompt(job, session.conversationHistory));
    const analysis    = parseAnalysis(analysisRaw);

    const completedAt = new Date();
    session.status          = 'completed';
    session.completedAt     = completedAt;
    session.durationSeconds = Math.round((completedAt - new Date(session.startedAt)) / 1000);
    session.aiAnalysis = {
      communicationScore: analysis.communicationScore,
      technicalScore:     analysis.technicalScore,
      confidenceScore:    analysis.confidenceScore,
      keyInsights:        analysis.keyInsights || [],
      overallVerdict:     analysis.overallVerdict || 'hold',
      summary:            analysis.summary || '',
    };
    await session.save();

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    console.error('endSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get session by ID
// @route   GET /api/screening/:id
// ─────────────────────────────────────────────────────────────────────────────
const getSession = async (req, res) => {
  try {
    const session = await ScreeningSession.findById(req.params.id)
      .select('-candidateToken -candidateTokenExpiresAt')
      .populate('resumeId', 'originalFileName blindScore aiEvaluation')
      .populate('jobId', 'title department requirements');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    res.status(200).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all sessions (optionally filtered by jobId)
// @route   GET /api/screening?jobId=xxx
// ─────────────────────────────────────────────────────────────────────────────
const getSessions = async (req, res) => {
  try {
    const { jobId } = req.query;
    const query = jobId ? { jobId } : {};
    const sessions = await ScreeningSession.find(query)
      .select('-candidateToken -candidateTokenExpiresAt')
      .populate('resumeId', 'originalFileName blindScore')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createSession, sendMessage, endSession, getSession, getSessions };
