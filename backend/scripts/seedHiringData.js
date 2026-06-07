/**
 * Seeds hiring-pipeline data: realistic resumes + screening sessions across
 * the two open jobs, so the Candidate Pipeline and Hiring Analytics pages
 * show meaningful numbers.
 *
 * What it does:
 *   1. Removes every Resume with originalFileName === 'Jnyan_resume.pdf'
 *      and any ScreeningSession linked to those resumes.
 *   2. Removes duplicate resumes (same file uploaded twice — keeps the
 *      higher-scored one per (fileName, jobId) pair).
 *   3. Adds ~16 new candidate resumes spread across both jobs, with a
 *      realistic mix of: screened-only, shortlisted, interview_scheduled,
 *      and rejected.
 *   4. Adds ~6 completed ScreeningSessions with varied AI verdicts so the
 *      analytics page has a real histogram, funnel, and verdict breakdown.
 *
 * Idempotent — safe to re-run.
 * Usage: node backend/scripts/seedHiringData.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Job              = require('../models/Job');
const Resume           = require('../models/Resume');
const ScreeningSession = require('../models/ScreeningSession');
const User             = require('../models/User');

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Candidate names sourced from common Indian + global names — no real people.
const CANDIDATES = [
  { name: 'Aarav Mehta',      email: 'aarav.mehta@example.com',     phone: '+91 98101 11001', location: 'Bengaluru, India' },
  { name: 'Diya Iyer',        email: 'diya.iyer@example.com',       phone: '+91 98101 11002', location: 'Chennai, India'   },
  { name: 'Rohan Verma',      email: 'rohan.verma@example.com',     phone: '+91 98101 11003', location: 'Pune, India'      },
  { name: 'Ananya Singh',     email: 'ananya.singh@example.com',    phone: '+91 98101 11004', location: 'Hyderabad, India' },
  { name: 'Kabir Kapoor',     email: 'kabir.kapoor@example.com',    phone: '+91 98101 11005', location: 'Mumbai, India'    },
  { name: 'Meera Reddy',      email: 'meera.reddy@example.com',     phone: '+91 98101 11006', location: 'Bengaluru, India' },
  { name: 'Vikram Joshi',     email: 'vikram.joshi@example.com',    phone: '+91 98101 11007', location: 'Delhi, India'     },
  { name: 'Sara Khan',        email: 'sara.khan@example.com',       phone: '+91 98101 11008', location: 'Bengaluru, India' },
  { name: 'Aditya Rao',       email: 'aditya.rao@example.com',      phone: '+91 98101 11009', location: 'Pune, India'      },
  { name: 'Priya Bhatt',      email: 'priya.bhatt@example.com',     phone: '+91 98101 11010', location: 'Bengaluru, India' },
  { name: 'Arjun Nair',       email: 'arjun.nair@example.com',      phone: '+91 98101 11011', location: 'Kochi, India'     },
  { name: 'Neha Pillai',      email: 'neha.pillai@example.com',     phone: '+91 98101 11012', location: 'Bengaluru, India' },
  { name: 'Rahul Saxena',     email: 'rahul.saxena@example.com',    phone: '+91 98101 11013', location: 'Noida, India'     },
  { name: 'Tanya Bose',       email: 'tanya.bose@example.com',      phone: '+91 98101 11014', location: 'Kolkata, India'   },
  { name: 'Karan Malhotra',   email: 'karan.malhotra@example.com',  phone: '+91 98101 11015', location: 'Gurgaon, India'   },
  { name: 'Riya Choudhary',   email: 'riya.choudhary@example.com',  phone: '+91 98101 11016', location: 'Jaipur, India'    },
  { name: 'Ishaan Kulkarni',  email: 'ishaan.kulkarni@example.com', phone: '+91 98101 11017', location: 'Bengaluru, India' },
  { name: 'Pooja Deshmukh',   email: 'pooja.deshmukh@example.com',  phone: '+91 98101 11018', location: 'Mumbai, India'    },
];

// AI-evaluation snippets — pulled from real screening patterns so the
// pipeline detail panel and analytics look authentic.
const EVAL_POOL = {
  strong_hire: {
    strengths: [
      'Deep production experience with the exact stack listed in the JD',
      'Demonstrated system-design thinking at scale',
      'Open-source contributions in adjacent areas',
    ],
    gaps: ['Limited exposure to on-call rotation practices'],
    redFlags: [],
    reasoning: 'Candidate aligns strongly with the role\'s core requirements and brings complementary experience in observability and CI/CD.',
  },
  consider: {
    strengths: [
      'Solid fundamentals in core CS topics',
      'Good communication in prior interview rounds',
      'Willingness to learn new stacks',
    ],
    gaps: [
      'No hands-on experience with the primary database technology',
      'Less than 2 years in a production environment',
    ],
    redFlags: [],
    reasoning: 'Candidate shows potential but has gaps in two key requirements. Worth a screening interview to assess learning velocity.',
  },
  reject: {
    strengths: ['Clear communication style'],
    gaps: [
      'Limited relevant industry experience',
      'Skills profile is misaligned with the JD',
    ],
    redFlags: ['Frequent short tenures (under 12 months) at last 2 roles'],
    reasoning: 'Resume does not demonstrate the depth required for this role. Recommend considering for a more junior position instead.',
  },
};

const buildAiEvaluation = (rec) => {
  const e = EVAL_POOL[rec];
  const skills    = rec === 'strong_hire' ? rand(82, 95) : rec === 'consider' ? rand(58, 76) : rand(28, 50);
  const exp       = rec === 'strong_hire' ? rand(80, 94) : rec === 'consider' ? rand(50, 72) : rand(25, 48);
  const overall   = Math.round((skills + exp) / 2 + (rec === 'strong_hire' ? 4 : rec === 'consider' ? 0 : -3));
  return {
    skillsMatch:        skills,
    experienceMatch:    exp,
    blindScore:         Math.max(0, Math.min(100, overall)),
    aiEvaluation: {
      ...e,
      recommendation: rec,
    },
  };
};

const buildAnalysis = (verdict) => {
  // 0–100, with verdict shaping the band
  const band = verdict === 'advance' ? [72, 92] : verdict === 'hold' ? [55, 72] : [30, 58];
  return {
    aiAnalysis: {
      communicationScore: rand(...band),
      technicalScore:     rand(...band),
      confidenceScore:    rand(...band),
      overallVerdict:     verdict,
      summary:            verdict === 'advance'
        ? 'Candidate demonstrated strong technical depth, clear communication, and confident problem-solving. Recommended to advance to the next round.'
        : verdict === 'hold'
        ? 'Candidate met baseline expectations but lacked depth in one or two areas. Borderline — hold for a second opinion.'
        : 'Candidate struggled to articulate key concepts and did not demonstrate the experience level required. Recommend rejecting.',
      keyInsights:        verdict === 'advance'
        ? ['Strong system design instincts', 'Comfortable with ambiguity', 'Clear ownership history']
        : verdict === 'hold'
        ? ['Adequate fundamentals', 'Needs mentoring on production concerns', 'Communication is clear but concise']
        : ['Vague answers on core topics', 'Limited recent hands-on work', 'Did not engage with follow-up probes'],
    },
  };
};

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const hrUser = await User.findOne({ role: 'hr_recruiter' });
    if (!hrUser) throw new Error('No HR user found. Run `node scripts/resetDB.js` first.');
    const hrId = hrUser._id;

    const jobs = await Job.find({ status: 'open' });
    if (jobs.length === 0) throw new Error('No open jobs. Create at least one job in the dashboard first.');
    console.log(`Found ${jobs.length} open job(s):`);
    jobs.forEach(j => console.log(`  - ${j.title} (${j.department})`));

    // 1. Remove all Jnyan_resume.pdf rows and their sessions.
    const jnyanResumes = await Resume.find({ originalFileName: /Jnyan_resume\.pdf$/i });
    const jnyanIds     = jnyanResumes.map(r => r._id);
    if (jnyanIds.length) {
      const sessDel = await ScreeningSession.deleteMany({ resumeId: { $in: jnyanIds } });
      const resDel  = await Resume.deleteMany({ _id: { $in: jnyanIds } });
      console.log(`Removed ${resDel.deletedCount} Jnyan_resume.pdf row(s) and ${sessDel.deletedCount} linked session(s).`);
    } else {
      console.log('No Jnyan_resume.pdf rows to remove.');
    }

    // 2. De-duplicate by (originalFileName, jobId) — keep the higher-scored.
    const dupes = await Resume.aggregate([
      { $sort: { blindScore: -1 } },
      { $group: { _id: { file: '$originalFileName', job: '$jobId' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    for (const d of dupes) {
      const [, ...rest] = d.ids;
      await Resume.deleteMany({ _id: { $in: rest } });
      console.log(`De-duplicated ${d._id.file} → kept 1, removed ${rest.length}.`);
    }

    // 3. Add a healthy mix of candidates across both jobs.
    // We design distribution by job so the analytics show variety:
    //   - 8 candidates per open job
    //   - mix of statuses: 2 rejected, 1 screened-only, 2 shortlisted,
    //     3 interview_scheduled (of which 4 will get a completed session)
    const PER_JOB = 8;
    const STATUS_MIX = [
      'rejected', 'rejected',
      'screened',
      'shortlisted', 'shortlisted',
      'interview_scheduled', 'interview_scheduled', 'interview_scheduled',
    ];

    const createdResumes = [];
    for (const job of jobs) {
      console.log(`\nSeeding ${PER_JOB} candidates for "${job.title}"…`);
      for (let i = 0; i < PER_JOB; i++) {
        const c      = CANDIDATES[(jobs.indexOf(job) * PER_JOB + i) % CANDIDATES.length];
        const status = STATUS_MIX[i];
        // map status → recommendation for AI evaluation
        const rec = status === 'rejected' ? 'reject'
                  : status === 'screened' ? pick(['consider', 'reject'])
                  : status === 'shortlisted' ? 'strong_hire'
                  : pick(['strong_hire', 'consider']);
        const ev = buildAiEvaluation(rec);

        const resume = await Resume.create({
          jobId: job._id,
          originalFileName: `${c.name.replace(/\s+/g, '_')}_Resume.pdf`,
          fileUrl: `/uploads/seed/${c.name.replace(/\s+/g, '_')}_Resume.pdf`,
          rawText: 'Seeded resume — placeholder text.',
          blindScore:        ev.blindScore,
          skillsMatch:       ev.skillsMatch,
          experienceMatch:   ev.experienceMatch,
          aiEvaluation:      ev.aiEvaluation,
          candidateInfo: {
            name:     c.name,
            email:    c.email,
            phone:    c.phone,
            location: c.location,
          },
          status,
          screeningSessionId: null,
          screenedAt:         daysAgo(rand(1, 30)),
          uploadedBy:         hrId,
          createdAt:          daysAgo(rand(1, 45)),
        });
        createdResumes.push(resume);
        console.log(`  + ${resume.candidateInfo.name.padEnd(22)} score=${String(ev.blindScore).padEnd(3)} status=${status}`);
      }
    }

    // 4. Build screening sessions for the interview_scheduled candidates.
    // We assign verdicts to make the analytics show a realistic split:
    //   40% advance, 35% hold, 25% reject.
    const interviewReady = createdResumes.filter(r => r.status === 'interview_scheduled');
    const verdictMix = [];
    interviewReady.forEach((_, i) => {
      const r = i / interviewReady.length;
      verdictMix.push(r < 0.40 ? 'advance' : r < 0.75 ? 'hold' : 'reject');
    });

    console.log(`\nCreating ${interviewReady.length} screening session(s)…`);
    for (let i = 0; i < interviewReady.length; i++) {
      const r = interviewReady[i];
      const verdict = verdictMix[i];
      const job     = jobs.find(j => String(j._id) === String(r.jobId));
      const startedAt   = daysAgo(rand(1, 14));
      const durationMin = rand(8, 22);
      const completedAt = new Date(startedAt.getTime() + durationMin * 60 * 1000);
      const analysis    = buildAnalysis(verdict).aiAnalysis;
      const flagged     = Math.random() < 0.18;
      const sessions = await ScreeningSession.create({
        resumeId: r._id,
        jobId:    r.jobId,
        mode:     'text',
        status:   'completed',
        startedAt,
        completedAt,
        durationSeconds: durationMin * 60,
        conversationHistory: [],
        aiAnalysis: analysis,
        proctoring: {
          tabSwitches:     flagged ? rand(2, 4) : rand(0, 1),
          focusLostEvents: flagged ? rand(1, 2) : 0,
          flagged,
          events: [],
        },
      });
      await Resume.findByIdAndUpdate(r._id, { screeningSessionId: sessions._id });
      console.log(`  · ${r.candidateInfo.name.padEnd(22)} verdict=${verdict.padEnd(8)} dur=${durationMin}m${flagged ? '  ⚠ flagged' : ''}`);
    }

    console.log('\n✅ Hiring data seeded.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('seed failed:', e);
    process.exit(1);
  }
})();
