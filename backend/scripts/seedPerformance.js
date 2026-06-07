/**
 * Seeds the Performance collection with realistic reviews for *every* employee
 * across 3 periods (Q4-2025, Q1-2026, Q2-2026) so both the employee view
 * ("My Performance") and the management view ("Performance Reviews") have
 * meaningful data to display.
 *
 * What it does:
 *   1. Wipes every existing Performance document (idempotent).
 *   2. For each employee in the DB, creates 3 reviews — one per period.
 *   3. Realistic per-employee metrics with a slight upward trend over time
 *      (people improve; the dashboards should reflect growth).
 *   4. AI-generated summaries + recommendations that read like real Gemini
 *      output (we don't call Gemini here — just bake in plausible strings
 *      that the existing AI fields expect).
 *   5. Mixed statuses: oldest period = acknowledged, middle = submitted
 *      (awaiting employee), newest = draft (manager hasn't finished yet).
 *
 * Re-runnable: every run wipes the previous seed and rebuilds.
 * Usage: node backend/scripts/seedPerformance.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Performance = require('../models/Performance');
const Employee    = require('../models/Employee');
const User        = require('../models/User');

// ── Helpers ──────────────────────────────────────────────────────────────────
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build a metrics object whose per-axis scores cluster around a "true" score
// with a small spread, so the dashboard bars feel natural rather than uniform.
const buildMetrics = (trueScore) => {
  const jitter = (s) => Math.max(0, Math.min(100, s + rand(-8, 8)));
  const taskCompletionRate = jitter(trueScore);
  const attendanceScore    = jitter(trueScore);
  const qualityScore       = jitter(trueScore);
  const teamworkScore      = jitter(trueScore);
  const communicationScore = jitter(trueScore);
  // overallScore tracks the average with a small bias (managers tend to
  // round up the headline number slightly).
  const overallScore = Math.max(0, Math.min(100,
    Math.round((taskCompletionRate + attendanceScore + qualityScore + teamworkScore + communicationScore) / 5) + 1
  ));
  return { taskCompletionRate, attendanceScore, qualityScore, teamworkScore, communicationScore, overallScore };
};

// A small library of manager-notes seeds by score band — the field on the
// schema is `managerNotes`, a free-text string.
const NOTES_BY_BAND = (band, period) => {
  if (band === 'high') return [
    `Consistently exceeds expectations in ${period}. Has taken ownership of two cross-team initiatives and unblocked the team multiple times.`,
    `Strong performance across the board this ${period}. Code quality and review turnaround are noticeably above team average.`,
    `Top contributor in ${period}. Mentor figure for newer teammates; would benefit from stretch assignments to keep growth trajectory.`,
  ];
  if (band === 'mid') return [
    `Solid ${period} performance. Meets most targets and shows steady improvement on the quality dimension.`,
    `Consistent contributor in ${period}. Recommend clearer goal-setting next quarter to push from "good" to "great".`,
    `Reliable ${period} output. Attendance is exemplary; encourage more visible project leadership to broaden impact.`,
  ];
  return [
    `${period} has been a development cycle. Targets missed on a few key deliverables; recommend a structured improvement plan.`,
    `Below expectations in ${period}. Attendance has been inconsistent and code reviews show the need for more senior pairing.`,
    `Performance dipped in ${period} due to competing priorities. Schedule a re-baseline meeting and consider a focused mentorship pairing.`,
  ];
};

const SUMMARY_BY_BAND = (band) => {
  if (band === 'high') return 'Consistently exceeds role expectations. Demonstrates strong ownership, technical depth, and a positive influence on team velocity. Recommend stretch projects and a fast-track to senior scope.';
  if (band === 'mid')  return 'Meets the core expectations of the role. Strengths in delivery and dependability; opportunity to grow in cross-functional influence and longer-horizon planning.';
  return 'Below target on multiple dimensions this cycle. A structured improvement plan with weekly 1:1s, paired work, and clearly defined success metrics is recommended for the next review period.';
};

const RECS_BY_BAND = (band) => {
  if (band === 'high') return [
    'Enroll in the senior-staff mentorship cohort',
    'Take ownership of one cross-team initiative next quarter',
    'Lead a knowledge-sharing session on a topic of expertise',
  ];
  if (band === 'mid') return [
    'Define 2–3 SMART goals with the manager for next quarter',
    'Pick one stretch project to broaden scope',
    'Schedule a mid-cycle check-in at the half-quarter mark',
  ];
  return [
    'Draft a 30-60-90 day improvement plan with explicit weekly milestones',
    'Pair with a senior teammate for the next 2 sprints',
    'Block focus time on the highest-leverage deliverable each day',
  ];
};

const bandFor = (score) => score >= 85 ? 'high' : score >= 70 ? 'mid' : 'low';

// Each employee gets a "true" baseline score (consistent across periods with
// a small upward trend). This makes growth visible across the 3 quarters.
const PROFILES = {
  'Super Admin':     { base: 88, delta: +1, managerEmail: 'manager@fwchrms.com' },
  'HR FWC':          { base: 85, delta: +1, managerEmail: 'manager@fwchrms.com' },
  'Senior Manager':  { base: 92, delta:  0, managerEmail: 'admin@fwchrms.com'    },
  'John Employee':   { base: 72, delta: +2, managerEmail: 'manager@fwchrms.com' },
  'Arjun Sharma':    { base: 86, delta: +2, managerEmail: 'manager@fwchrms.com' },
  'Priya Nair':      { base: 80, delta: +2, managerEmail: 'manager@fwchrms.com' },
  'Rahul Gupta':     { base: 75, delta: +1, managerEmail: 'manager@fwchrms.com' },
  'Thejaswini MD':   { base: 90, delta: +1, managerEmail: 'manager@fwchrms.com' },
};

const PERIODS = [
  { label: 'Q4-2025', status: 'acknowledged' },
  { label: 'Q1-2026', status: 'submitted'    },
  { label: 'Q2-2026', status: 'draft'        },
];

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Wipe existing reviews.
    const before = await Performance.countDocuments();
    await Performance.deleteMany({});
    console.log(`Wiped ${before} existing review(s).`);

    // 2. Load all employees + their managers.
    const employees = await Employee.find().populate('userId');
    const managers  = await Employee.find().populate('userId');
    const managerByEmail = {};
    for (const m of managers) {
      const email = m.userId?.email;
      if (email) managerByEmail[email] = m;
    }
    if (employees.length === 0) {
      throw new Error('No employees found. Run `node scripts/resetDB.js` then `node scripts/seedData.js` first.');
    }

    let total = 0;
    for (const emp of employees) {
      const profile = PROFILES[emp.firstName + ' ' + emp.lastName] || {
        base: 75 + rand(0, 10), delta: 1, managerEmail: 'manager@fwchrms.com',
      };
      const reviewer = managerByEmail[profile.managerEmail];
      if (!reviewer) {
        console.warn(`  ⚠ No manager with email ${profile.managerEmail} for ${emp.firstName} — using admin`);
      }
      const reviewerId = reviewer?._id || emp._id;

      console.log(`\n${emp.firstName} ${emp.lastName}:`);
      for (let pIdx = 0; pIdx < PERIODS.length; pIdx++) {
        const period = PERIODS[pIdx];
        const score = Math.max(40, Math.min(99, profile.base + profile.delta * pIdx));
        const metrics = buildMetrics(score);
        const band = bandFor(score);
        const created = await Performance.create({
          employeeId:   emp._id,
          reviewedBy:   reviewerId,
          reviewPeriod: period.label,
          metrics,
          managerNotes: pick(NOTES_BY_BAND(band, period.label)),
          aiSummary:    SUMMARY_BY_BAND(band),
          aiRecommendations: RECS_BY_BAND(band),
          aiGeneratedAt: new Date(Date.now() - (PERIODS.length - pIdx) * 30 * 24 * 60 * 60 * 1000),
          status: period.status,
        });
        total++;
        console.log(`  · ${period.label.padEnd(8)} ${period.status.padEnd(13)} overall=${String(metrics.overallScore).padStart(2)} band=${band}`);
      }
    }

    console.log(`\n✅ Seeded ${total} performance review(s) across ${employees.length} employees × ${PERIODS.length} periods.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('seed failed:', e);
    process.exit(1);
  }
})();
