const crypto          = require('crypto');
const ScreeningSession = require('../models/ScreeningSession');
const Resume           = require('../models/Resume');
const Job              = require('../models/Job');
const { generateContent } = require('../services/geminiService');
const {
  MAX_TURNS,
  buildFollowUpPrompt,
  buildAnalysisPrompt,
  parseAnalysis,
} = require('../utils/interviewHelpers');

// ── Internal helper: run analysis and save to session ────────────────────────
const runAnalysis = async (session) => {
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
  return session;
};

// ── Internal helper: token validation ────────────────────────────────────────
const findSessionByToken = async (token) => {
  const session = await ScreeningSession.findOne({ candidateToken: token });
  if (!session) return { error: 404, message: 'Invalid or expired interview link.' };
  if (new Date() > new Date(session.candidateTokenExpiresAt)) {
    return { error: 410, message: 'This interview link has expired. Please contact HR.' };
  }
  return { session };
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Generate a shareable candidate interview link (authenticated — HR only)
// @route   POST /api/screening/:id/generate-link
// @access  Admin, HR Recruiter
//
// We return the *path* and *token* separately rather than a fully-qualified
// URL. The candidate's browser already knows what origin it loaded the HR
// dashboard from, so the frontend composes the final link using
// `${window.location.origin}/interview/${token}`. This works on localhost,
// staging, prod, and preview deploys without any env-var coordination.
// ─────────────────────────────────────────────────────────────────────────────
const buildInterviewLinkPayload = (token, expiresAt, alreadyGenerated = false) => ({
  // Relative path the frontend can prefix with its own origin.
  interviewPath: `/interview/${token}`,
  // Token alone — useful for callers that want to embed it in emails / QR codes.
  token,
  // Pre-composed for convenience. This is what the API used to return; the
  // frontend still builds its own from `window.location.origin` to dodge the
  // localhost bug, but the field is kept so any third-party consumer doesn't
  // break. The frontend will overwrite it on receipt.
  interviewUrl: `${process.env.CLIENT_URL || ''}/interview/${token}`,
  expiresAt,
  alreadyGenerated,
});

const generateCandidateLink = async (req, res) => {
  try {
    const session = await ScreeningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    if (['completed', 'abandoned'].includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Cannot generate a link for a completed or abandoned session.' });
    }

    // Idempotent — return existing valid token
    if (session.candidateToken && new Date() < new Date(session.candidateTokenExpiresAt)) {
      return res.status(200).json({
        success: true,
        data: buildInterviewLinkPayload(session.candidateToken, session.candidateTokenExpiresAt, true),
      });
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expiry  = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    session.candidateToken          = token;
    session.candidateTokenExpiresAt = expiry;
    await session.save();

    res.status(200).json({
      success: true,
      data: buildInterviewLinkPayload(token, expiry, false),
    });
  } catch (err) {
    console.error('generateCandidateLink error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Fetch session data for candidate (public — token authenticated)
// @route   GET /api/screening/candidate/:token
// @access  Public (token-gated)
// ─────────────────────────────────────────────────────────────────────────────
const getCandidateSession = async (req, res) => {
  try {
    const { error, message, session } = await findSessionByToken(req.params.token);
    if (error) return res.status(error).json({ success: false, message });

    const resume = await Resume.findById(session.resumeId)
      .select('+candidateInfo originalFileName blindScore')
      .lean();
    const job = await Job.findById(session.jobId).select('title department requirements').lean();

    const sessionComplete = session.status === 'completed';

    // Safe payload — never expose the token or raw resume text
    res.status(200).json({
      success: true,
      data: {
        sessionId:           session._id,
        sessionComplete,
        status:              session.status,
        mode:                session.mode,
        conversationHistory: session.conversationHistory,
        aiAnalysis:          sessionComplete ? session.aiAnalysis : null,
        proctoring: {
          tabSwitches:     session.proctoring?.tabSwitches || 0,
          focusLostEvents: session.proctoring?.focusLostEvents || 0,
          flagged:         session.proctoring?.flagged || false,
        },
        job: {
          title:       job?.title,
          department:  job?.department,
          requirements: (job?.requirements || []).slice(0, 6),
        },
        candidateName: resume?.candidateInfo?.name || 'Candidate',
      },
    });
  } catch (err) {
    console.error('getCandidateSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Candidate sends an answer — Gemini generates next question
// @route   POST /api/screening/candidate/:token/message
// @access  Public (token-gated)
// ─────────────────────────────────────────────────────────────────────────────
const candidateSendMessage = async (req, res) => {
  try {
    const { message, transcript } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required.' });

    const { error, message: errMsg, session } = await findSessionByToken(req.params.token);
    if (error) return res.status(error).json({ success: false, message: errMsg });

    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This interview is already completed.' });
    }

    const job = await Job.findById(session.jobId);

    // 1. Add candidate message. `transcript` is the raw Web-Speech-API output
    //    for voice turns; we persist it alongside `message` for the analysis
    //    stage and HR review. For text turns it's null.
    session.conversationHistory.push({
      role: 'candidate',
      message: message.trim(),
      transcript: transcript?.trim() || null,
      timestamp: new Date(),
    });

    const turnCount  = session.conversationHistory.filter(t => t.role === 'candidate').length;
    const isLastTurn = turnCount >= MAX_TURNS;

    // 2. Generate AI follow-up
    const followUpQuestion = await generateContent(
      buildFollowUpPrompt(job, session.conversationHistory, turnCount)
    );

    // 3. Add AI message
    session.conversationHistory.push({
      role: 'ai',
      message: followUpQuestion,
      timestamp: new Date(),
    });

    // 4. Auto-complete + analyze on last turn
    if (isLastTurn) {
      await runAnalysis(session); // saves session internally
    } else {
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: {
        aiMessage:  followUpQuestion,
        turnCount,
        isLastTurn,
        status:     session.status,
        aiAnalysis: isLastTurn ? session.aiAnalysis : null,
      },
    });
  } catch (err) {
    console.error('candidateSendMessage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    End interview early + generate analysis
// @route   POST /api/screening/candidate/:token/end
// @access  Public (token-gated)
// ─────────────────────────────────────────────────────────────────────────────
const candidateEndSession = async (req, res) => {
  try {
    const { error, message, session } = await findSessionByToken(req.params.token);
    if (error) return res.status(error).json({ success: false, message });

    if (session.status === 'completed') {
      return res.status(200).json({ success: true, data: { aiAnalysis: session.aiAnalysis, status: 'completed' } });
    }

    await runAnalysis(session);

    res.status(200).json({
      success: true,
      data: { aiAnalysis: session.aiAnalysis, status: session.status },
    });
  } catch (err) {
    console.error('candidateEndSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Record a proctoring event (tab switch / focus lost)
// @route   POST /api/screening/candidate/:token/proctoring-event
// @access  Public (token-gated)
// ─────────────────────────────────────────────────────────────────────────────
const recordProctoringEvent = async (req, res) => {
  try {
    const { type, timestamp } = req.body;
    if (!['tab_switch', 'focus_lost', 'fullscreen_exit'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid proctoring event type.' });
    }

    const { error, message, session } = await findSessionByToken(req.params.token);
    if (error) return res.status(error).json({ success: false, message });

    // Increment counters
    if (type === 'tab_switch')       session.proctoring.tabSwitches++;
    else if (type === 'focus_lost')  session.proctoring.focusLostEvents++;
    else if (type === 'fullscreen_exit') {
      session.proctoring.focusLostEvents++; // treat as focus loss for flagging threshold
    }

    // Push event to log
    session.proctoring.events.push({ type, timestamp: timestamp ? new Date(timestamp) : new Date() });

    // Flag session if threshold reached
    const totalViolations = session.proctoring.tabSwitches + session.proctoring.focusLostEvents;
    if (totalViolations >= 3) session.proctoring.flagged = true;

    await session.save();

    res.status(200).json({
      success: true,
      data: {
        flagged:         session.proctoring.flagged,
        totalViolations,
        tabSwitches:     session.proctoring.tabSwitches,
        focusLostEvents: session.proctoring.focusLostEvents,
      },
    });
  } catch (err) {
    console.error('recordProctoringEvent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  generateCandidateLink,
  getCandidateSession,
  candidateSendMessage,
  candidateEndSession,
  recordProctoringEvent,
};
