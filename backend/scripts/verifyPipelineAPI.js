/**
 * Verifies the two API calls the pipeline + analytics pages make, by invoking
 * the controller functions directly with a fake Express req/res. No HTTP
 * server required — this is a contract check.
 *
 * Usage: node backend/scripts/verifyPipelineAPI.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const { getResumes } = require('../controllers/resumeController');
const { getSessions } = require('../controllers/screeningController');

// Fake Express req/res — just enough to satisfy both controllers.
const fakeReq = (query = {}, user = { _id: 'seed', role: 'hr_recruiter' }) => ({ query, user });
const fakeRes = () => {
  const r = {
    statusCode: 200,
    body: null,
    status(c) { r.statusCode = c; return r; },
    json(b) { r.body = b; return r; },
  };
  return r;
};

const show = (label, res) => {
  const data = res.body?.data || [];
  console.log(`\n${label}: ${res.statusCode} → ${data.length} row(s)`);
  if (data.length === 0) {
    console.log('  (empty)');
  } else {
    data.slice(0, 4).forEach(r => {
      const job = typeof r.jobId === 'object' ? r.jobId?.title : '—';
      const name = r.candidateInfo?.name || '🔒 hidden';
      console.log(`  · ${String(r.blindScore).padEnd(3)} | ${r.status.padEnd(20)} | ${(job || '—').padEnd(22)} | ${name}`);
    });
    if (data.length > 4) console.log(`  … and ${data.length - 4} more`);
  }
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // ── 1. The old call that the pages were making: no jobId ──
    const r1 = await new Promise((resolve, reject) => {
      const req = fakeReq({});           // ← no jobId
      const res = fakeRes();
      res.json = b => { res.body = b; resolve(res); };
      getResumes(req, res).catch(reject);
    });
    show('GET /api/resumes (no jobId — what the Pipeline + Analytics pages call)', r1);

    // ── 2. The original "with jobId" call still works ──
    const Job = require('../models/Job');
    const job = await Job.findOne({ status: 'open' });
    if (job) {
      const r2 = await new Promise((resolve, reject) => {
        const req = fakeReq({ jobId: job._id.toString() });
        const res = fakeRes();
        res.json = b => { res.body = b; resolve(res); };
        getResumes(req, res).catch(reject);
      });
      show(`GET /api/resumes?jobId=<AIML Engineer>`, r2);
    }

    // ── 3. Sessions endpoint (no param) ──
    const r3 = await new Promise((resolve, reject) => {
      const req = fakeReq({});
      const res = fakeRes();
      res.json = b => { res.body = b; resolve(res); };
      getSessions(req, res).catch(reject);
    });
    show('GET /api/screening (no jobId)', r3);

    // ── 4. Sanity: candidateInfo present + jobId populated ──
    const sample = r1.body.data.find(r => r.candidateInfo?.name);
    if (sample) {
      const hasCandidateInfo = !!sample.candidateInfo?.name;
      const jobIdPopulated   = typeof sample.jobId === 'object' && !!sample.jobId?.title;
      console.log('\nSanity checks on a shortlisted sample row:');
      console.log(`  candidateInfo present:  ${hasCandidateInfo ? '✅' : '❌'}`);
      console.log(`  jobId populated (.title): ${jobIdPopulated   ? '✅' : '❌'}`);
    } else {
      console.log('\n⚠ No sample row had a populated candidateInfo — check seed data.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('verify failed:', e);
    process.exit(1);
  }
})();
