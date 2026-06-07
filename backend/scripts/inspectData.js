/**
 * Inspect-only diagnostic. Lists every job, every resume, and every
 * screening session currently in the database so we know what to seed.
 * Usage: node backend/scripts/inspectData.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Job              = require('../models/Job');
const Resume           = require('../models/Resume');
const ScreeningSession = require('../models/ScreeningSession');
const User             = require('../models/User');

const show = async () => {
  const jobs  = await Job.find().select('title department status').lean();
  const users = await User.find().select('email role').lean();
  const resumes = await Resume.find()
    .select('originalFileName blindScore status jobId candidateInfo')
    .populate('jobId', 'title')
    .lean();
  const sessions = await ScreeningSession.find()
    .select('status jobId resumeId aiAnalysis proctoring startedAt completedAt durationSeconds')
    .populate('jobId',     'title')
    .populate('resumeId',  'originalFileName')
    .lean();

  console.log('\n=== USERS ===');
  users.forEach(u => console.log(`  ${u.role.padEnd(7)} ${u.email}`));

  console.log('\n=== JOBS ===');
  jobs.forEach(j => console.log(`  [${j.status}] ${j.title} (${j.department})`));

  console.log('\n=== RESUMES ===');
  resumes.forEach(r => console.log(
    `  score=${String(r.blindScore).padEnd(4)} status=${r.status.padEnd(20)} ` +
    `job=${(r.jobId?.title || '—').padEnd(30)} file=${r.originalFileName}` +
    (r.candidateInfo?.name ? `  name=${r.candidateInfo.name}` : '')
  ));

  console.log('\n=== SCREENING SESSIONS ===');
  sessions.forEach(s => {
    const v = s.aiAnalysis?.overallVerdict || '—';
    console.log(
      `  [${s.status.padEnd(11)}] verdict=${v.padEnd(8)} ` +
      `job=${(s.jobId?.title || '—').padEnd(30)} ` +
      `resume=${s.resumeId?.originalFileName || '—'} ` +
      `dur=${s.durationSeconds ? s.durationSeconds + 's' : '—'}`
    );
  });

  console.log(`\nTotals: ${jobs.length} jobs, ${resumes.length} resumes, ${sessions.length} sessions\n`);
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await show();
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('inspect failed:', e.message);
    process.exit(1);
  }
})();
