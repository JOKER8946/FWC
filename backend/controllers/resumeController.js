const fs = require('fs');
const Resume = require('../models/Resume');
const ResumeChunk = require('../models/ResumeChunk');
const Job = require('../models/Job');
const chunkText = require('../utils/chunkText');
const extractPdfText = require('../utils/extractPdfText');
const { scoreResumeWithRAG } = require('../services/geminiService');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload resume PDF, chunk it, run keyword RAG + Gemini blind scoring
// @route   POST /api/resumes/upload
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const uploadAndScreen = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
  }

  const { jobId } = req.body;
  if (!jobId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'jobId is required.' });
  }

  try {
    // ── 1. Find the job for its requirements ──────────────────────────────────
    const job = await Job.findById(jobId);
    if (!job) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // ── 2. Extract text from PDF ──────────────────────────────────────────────
    const pdfBuffer = fs.readFileSync(req.file.path);
    const rawText = await extractPdfText(pdfBuffer);

    if (!rawText || rawText.trim().length < 50) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({ success: false, message: 'Could not extract text from this PDF. Ensure it is not a scanned image.' });
    }

    // ── 3. Create resume record (status: processing) ──────────────────────────
    const resume = await Resume.create({
      jobId,
      originalFileName: req.file.originalname,
      fileUrl: req.file.path,
      rawText,
      uploadedBy: req.user._id,
      status: 'processing',
    });

    // ── 4. Chunk the raw text ─────────────────────────────────────────────────
    const chunks = chunkText(rawText, 600, 100);
    const chunkDocs = chunks.map((content, i) => ({
      resumeId: resume._id,
      jobId,
      chunkIndex: i,
      content,
      charCount: content.length,
    }));

    await ResumeChunk.insertMany(chunkDocs);

    // ── 5. Keyword RAG + Gemini blind scoring ─────────────────────────────────
    const geminiResult = await scoreResumeWithRAG(
      resume._id,
      job.title,
      job.requirements,
      rawText
    );

    // ── 6. Update resume with scores (candidateInfo stays hidden) ────────────
    resume.blindScore       = geminiResult.blindScore;
    resume.skillsMatch      = geminiResult.skillsMatch;
    resume.experienceMatch  = geminiResult.experienceMatch;
    resume.aiEvaluation = {
      strengths:      geminiResult.strengths      || [],
      gaps:           geminiResult.gaps           || [],
      redFlags:       geminiResult.redFlags       || [],
      recommendation: geminiResult.recommendation || 'consider',
      reasoning:      geminiResult.reasoning      || '',
    };
    resume.candidateInfo = {
      name:     geminiResult.candidateInfo?.name     || 'Not found',
      email:    geminiResult.candidateInfo?.email    || 'Not found',
      phone:    geminiResult.candidateInfo?.phone    || 'Not found',
      location: geminiResult.candidateInfo?.location || 'Not found',
    };
    resume.status     = 'screened';
    resume.screenedAt = new Date();
    await resume.save();

    // ── 7. Respond — candidateInfo excluded from response ────────────────────
    res.status(201).json({
      success: true,
      message: 'Resume screened successfully.',
      data: {
        _id:              resume._id,
        jobId:            resume.jobId,
        originalFileName: resume.originalFileName,
        blindScore:       resume.blindScore,
        skillsMatch:      resume.skillsMatch,
        experienceMatch:  resume.experienceMatch,
        aiEvaluation:     resume.aiEvaluation,
        status:           resume.status,
        screenedAt:       resume.screenedAt,
        chunksCreated:    chunkDocs.length,
      },
    });
  } catch (err) {
    // Cleanup file if something went wrong
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('uploadAndScreen error:', err);
    res.status(500).json({ success: false, message: err.message || 'Screening failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all resumes for a job, sorted by blindScore desc
// @route   GET /api/resumes?jobId=xxx
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const getResumes = async (req, res) => {
  try {
    const { jobId, status } = req.query;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId query param required.' });

    const query = { jobId };
    if (status) query.status = status;

    // candidateInfo excluded by default — recruiter sees blind scores only
    const resumes = await Resume.find(query)
      .select('-candidateInfo -rawText')
      .sort({ blindScore: -1 })
      .lean();

    res.status(200).json({ success: true, count: resumes.length, data: resumes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single resume (still no candidateInfo unless shortlisted)
// @route   GET /api/resumes/:id
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const getResume = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).select('-rawText');
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });

    // Only reveal candidateInfo if shortlisted or beyond
    const revealPII = ['shortlisted', 'interview_scheduled'].includes(resume.status);
    if (!revealPII) resume.candidateInfo = undefined;

    res.status(200).json({ success: true, data: resume });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Shortlist a resume — reveals candidateInfo to recruiter
// @route   PATCH /api/resumes/:id/shortlist
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const shortlistResume = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });

    resume.status = 'shortlisted';
    await resume.save();

    // Now reveal candidateInfo
    res.status(200).json({
      success: true,
      message: 'Resume shortlisted. Candidate identity revealed.',
      data: resume, // full document including candidateInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Reject a resume
// @route   PATCH /api/resumes/:id/reject
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const rejectResume = async (req, res) => {
  try {
    const resume = await Resume.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    ).select('-rawText -candidateInfo');

    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });
    res.status(200).json({ success: true, message: 'Resume rejected.', data: resume });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all jobs (for the recruiter's job selector dropdown)
// @route   GET /api/resumes/jobs
// @access  HR Recruiter, Admin
// ─────────────────────────────────────────────────────────────────────────────
const getJobsForScreener = async (req, res) => {
  try {
    const jobs = await Job.find({ status: 'open' })
      .select('title department requirements status applicationsCount')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadAndScreen,
  getResumes,
  getResume,
  shortlistResume,
  rejectResume,
  getJobsForScreener,
};
