/**
 * Seeds realistic data: 3 developer employees + attendance/payroll/performance/leaves
 * Usage: node backend/scripts/seedData.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User        = require('../models/User');
const Employee    = require('../models/Employee');
const Attendance  = require('../models/Attendance');
const Leave       = require('../models/Leave');
const Payroll     = require('../models/Payroll');
const Performance = require('../models/Performance');

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addHours = (d, h) => new Date(d.getTime() + h * 3_600_000);
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const midnight = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const timeOn = (day, h, m = 0) => { const r = new Date(day); r.setHours(h, m, 0, 0); return r; };

const workingDays = (daysBack) => {
  const days = [];
  const today = midnight(new Date());
  for (let i = 1; i <= daysBack; i++) {
    const d = addDays(today, -i);
    if (!isWeekend(d)) days.push(d);
  }
  return days;
};

// ── Dev account definitions ───────────────────────────────────────────────────
const DEVS = [
  {
    email: 'dev1@fwchrms.com', password: 'Admin@1234',
    firstName: 'Arjun',  lastName: 'Sharma', phone: '9876543210',
    department: 'engineering', designation: 'Backend Developer',
    salary: 75_000, dojOffset: -365,
    absentRate: 0.05, lateRate: 0.08, wfhRate: 0.05,
  },
  {
    email: 'dev2@fwchrms.com', password: 'Admin@1234',
    firstName: 'Priya',  lastName: 'Nair',   phone: '9876543211',
    department: 'engineering', designation: 'Frontend Developer',
    salary: 68_000, dojOffset: -240,
    absentRate: 0.04, lateRate: 0.15, wfhRate: 0.08,
  },
  {
    email: 'dev3@fwchrms.com', password: 'Admin@1234',
    firstName: 'Rahul',  lastName: 'Gupta',  phone: '9876543212',
    department: 'engineering', designation: 'Full Stack Developer',
    salary: 72_000, dojOffset: -180,
    absentRate: 0.06, lateRate: 0.10, wfhRate: 0.12,
  },
];

const MONTHS = ['Mar-2026', 'Apr-2026', 'May-2026'];

// ── Payroll builder ───────────────────────────────────────────────────────────
const buildPayroll = (salary, month, empId, adminId) => {
  const hra       = Math.round(salary * 0.40);
  const transport = 2_000;
  const internet  = 1_000;
  const medical   = 1_250;
  const pf        = Math.round(salary * 0.12);
  const tax       = Math.round(salary * 0.08);
  const netPay    = salary + hra + transport + internet + medical - pf - tax;
  return {
    employeeId:  empId,
    month,
    basicSalary: salary,
    allowances:  { hra, transport, internet, medical, other: 0 },
    deductions:  { pf, tax, loanRepayment: 0, other: 0 },
    netPay,
    status:      month === 'May-2026' ? 'processed' : 'paid',
    processedBy: adminId,
    processedAt: new Date(),
  };
};

// ── Performance data ──────────────────────────────────────────────────────────
const PERF = {
  'dev1@fwchrms.com': [
    {
      reviewPeriod: 'Q1-2026', status: 'submitted',
      metrics: { taskCompletionRate: 92, attendanceScore: 95, qualityScore: 88, teamworkScore: 90, communicationScore: 85, overallScore: 90 },
      managerNotes: 'Arjun consistently delivers backend features on time. Strong ownership over the API layer. Recommend for senior promotion track.',
      aiSummary: 'High performer with strong technical delivery and reliability. Minor gap in cross-team communication.',
      aiRecommendations: ['Mentor junior team members', 'Lead one architecture review per quarter'],
    },
    {
      reviewPeriod: 'Q2-2026', status: 'draft',
      metrics: { taskCompletionRate: 89, attendanceScore: 94, qualityScore: 91, teamworkScore: 88, communicationScore: 87, overallScore: 90 },
      managerNotes: 'Maintaining high standards. Took initiative on database optimization this quarter.',
      aiSummary: 'Continued strong performance with improved documentation practices.',
      aiRecommendations: ['Own the backend service migration plan', 'Cross-train on frontend observability'],
    },
  ],
  'dev2@fwchrms.com': [
    {
      reviewPeriod: 'Q1-2026', status: 'submitted',
      metrics: { taskCompletionRate: 85, attendanceScore: 80, qualityScore: 88, teamworkScore: 92, communicationScore: 90, overallScore: 87 },
      managerNotes: 'Priya has excellent design sense and delivers polished UI. Attendance has dipped — needs improvement.',
      aiSummary: 'Strong frontend delivery quality. Attendance pattern is a moderate concern — 15% late arrivals noted.',
      aiRecommendations: ['Set up morning sync habit', 'Explore component design system ownership'],
    },
    {
      reviewPeriod: 'Q2-2026', status: 'draft',
      metrics: { taskCompletionRate: 88, attendanceScore: 84, qualityScore: 90, teamworkScore: 93, communicationScore: 91, overallScore: 89 },
      managerNotes: 'Improved attendance this quarter. Took ownership of the design system migration.',
      aiSummary: 'Positive trajectory — attendance improving, quality consistently high.',
      aiRecommendations: ['Document component library', 'Lead next onboarding UI sprint'],
    },
  ],
  'dev3@fwchrms.com': [
    {
      reviewPeriod: 'Q1-2026', status: 'submitted',
      metrics: { taskCompletionRate: 80, attendanceScore: 85, qualityScore: 82, teamworkScore: 86, communicationScore: 84, overallScore: 83 },
      managerNotes: 'Rahul is ramping up well for someone 6 months in. Full-stack exposure is a plus. Needs to reduce PR revision cycles.',
      aiSummary: 'Good onboarding trajectory. Full-stack breadth valuable but depth in key areas needs development.',
      aiRecommendations: ['Pair with Arjun on backend performance topics', 'Reduce PR revision cycles'],
    },
    {
      reviewPeriod: 'Q2-2026', status: 'draft',
      metrics: { taskCompletionRate: 83, attendanceScore: 87, qualityScore: 85, teamworkScore: 88, communicationScore: 86, overallScore: 86 },
      managerNotes: 'Steady improvement across all metrics. Taking more initiative on design decisions.',
      aiSummary: 'Consistent improvement. On track for expanded responsibility in Q3.',
      aiRecommendations: ['Own a feature end-to-end', 'Participate in architecture discussions'],
    },
  ],
};

// ── Leave data ────────────────────────────────────────────────────────────────
const LEAVES = {
  'dev1@fwchrms.com': [
    { leaveType: 'casual', fromOff: -60, toOff: -59, reason: 'Family function',   status: 'approved' },
    { leaveType: 'sick',   fromOff: -28, toOff: -28, reason: 'Fever',             status: 'approved' },
  ],
  'dev2@fwchrms.com': [
    { leaveType: 'earned', fromOff: -45, toOff: -43, reason: 'Planned vacation',   status: 'approved' },
    { leaveType: 'sick',   fromOff: -10, toOff:  -9, reason: 'Not feeling well',   status: 'pending'  },
  ],
  'dev3@fwchrms.com': [
    { leaveType: 'casual', fromOff: -20, toOff: -20, reason: 'Personal work',      status: 'approved' },
    { leaveType: 'earned', fromOff:   6, toOff:   8, reason: 'Pre-planned travel', status: 'pending'  },
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────────
const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('MongoDB connected.\n');

  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) throw new Error('Admin user not found — run resetDB.js first.');

  // ── Ensure manager exists ──────────────────────────────────────────────────
  let managerUser = await User.findOne({ email: 'manager@fwchrms.com' });
  if (!managerUser) {
    console.log('Creating manager@fwchrms.com…');
    managerUser = await User.create({
      email: 'manager@fwchrms.com',
      passwordHash: 'Admin@1234',
      role: 'senior_manager',
      isActive: true,
    });
    const mEmp = await Employee.create({
      userId: managerUser._id,
      firstName: 'Dev', lastName: 'Manager',
      email: 'manager@fwchrms.com', phone: '9876540001',
      department: 'engineering', designation: 'Engineering Manager',
      dateOfJoining: addDays(new Date(), -730), salary: 120_000,
    });
    managerUser.employeeId = mEmp._id;
    await managerUser.save();
  }
  const managerEmp = await Employee.findById(managerUser.employeeId);
  console.log(`✓ Manager: ${managerEmp.firstName} ${managerEmp.lastName}`);

  // ── Create 3 dev accounts ─────────────────────────────────────────────────
  const created = [];
  for (const dev of DEVS) {
    let u = await User.findOne({ email: dev.email });
    if (u) {
      console.log(`  (exists) ${dev.email}`);
      const e = await Employee.findById(u.employeeId);
      created.push({ user: u, emp: e, dev });
      continue;
    }
    u = await User.create({ email: dev.email, passwordHash: dev.password, role: 'employee', isActive: true });
    const e = await Employee.create({
      userId: u._id,
      firstName: dev.firstName, lastName: dev.lastName,
      email: dev.email, phone: dev.phone,
      department: dev.department, designation: dev.designation,
      managerId: managerEmp._id,
      dateOfJoining: addDays(new Date(), dev.dojOffset),
      employmentType: 'full-time', salary: dev.salary,
    });
    u.employeeId = e._id;
    await u.save();
    created.push({ user: u, emp: e, dev });
    console.log(`✓ Created ${dev.email}  →  ${dev.firstName} ${dev.lastName}`);
  }

  // ── Attendance — 90 working days back ─────────────────────────────────────
  console.log('\nSeeding attendance…');
  const days = workingDays(90);
  const allWithAtt = [
    { emp: managerEmp, dev: { absentRate: 0.03, lateRate: 0.05, wfhRate: 0.10, dojOffset: -730 } },
    ...created,
  ];

  for (const { emp, dev } of allWithAtt) {
    let n = 0;
    for (const day of days) {
      if (day < emp.dateOfJoining) continue;
      const r = Math.random();
      let status, checkIn = null, checkOut = null, hoursWorked = 0;

      if (r < dev.absentRate) {
        status = 'absent';
      } else if (r < dev.absentRate + dev.lateRate) {
        status = 'late';
        const h = rand(9, 10), m = h === 9 ? rand(31, 59) : rand(0, 30);
        checkIn = timeOn(day, h, m);
        checkOut = addHours(checkIn, rand(7, 9));
        hoursWorked = parseFloat(((checkOut - checkIn) / 3_600_000).toFixed(2));
      } else if (r < dev.absentRate + dev.lateRate + dev.wfhRate) {
        status = 'wfh';
        checkIn = timeOn(day, rand(9, 10), rand(0, 30));
        checkOut = addHours(checkIn, rand(7, 9));
        hoursWorked = parseFloat(((checkOut - checkIn) / 3_600_000).toFixed(2));
      } else {
        status = 'present';
        checkIn = Math.random() < 0.5
          ? timeOn(day, 8, rand(45, 59))
          : timeOn(day, 9, rand(0, 28));
        checkOut = addHours(checkIn, rand(8, 10));
        hoursWorked = parseFloat(((checkOut - checkIn) / 3_600_000).toFixed(2));
      }

      try {
        await Attendance.create({
          employeeId: emp._id, date: day,
          checkIn, checkOut, status, hoursWorked,
          markedVia: status === 'absent' ? 'manual' : 'portal',
        });
        n++;
      } catch (_) { /* skip duplicate */ }
    }
    console.log(`  ✓ ${emp.firstName} ${emp.lastName}: ${n} records`);
  }

  // ── Payroll — last 3 months ───────────────────────────────────────────────
  console.log('\nSeeding payroll…');
  for (const { emp, dev } of created) {
    for (const month of MONTHS) {
      try {
        const p = buildPayroll(dev.salary, month, emp._id, adminUser._id);
        await Payroll.create(p);
        console.log(`  ✓ ${emp.firstName} ${emp.lastName} — ${month} — Net ₹${p.netPay.toLocaleString('en-IN')}`);
      } catch (_) {
        console.log(`  (skip) ${emp.firstName} — ${month} already exists`);
      }
    }
  }

  // ── Performance reviews ───────────────────────────────────────────────────
  console.log('\nSeeding performance reviews…');
  for (const { emp, dev } of created) {
    for (const rv of (PERF[dev.email] || [])) {
      try {
        await Performance.create({
          employeeId: emp._id, reviewPeriod: rv.reviewPeriod,
          reviewedBy: managerEmp._id, metrics: rv.metrics,
          managerNotes: rv.managerNotes, aiSummary: rv.aiSummary,
          aiRecommendations: rv.aiRecommendations,
          aiGeneratedAt: new Date(), status: rv.status,
        });
        console.log(`  ✓ ${emp.firstName} — ${rv.reviewPeriod} (${rv.status})`);
      } catch (_) {
        console.log(`  (skip) ${emp.firstName} — ${rv.reviewPeriod} already exists`);
      }
    }
  }

  // ── Leave requests ────────────────────────────────────────────────────────
  console.log('\nSeeding leave requests…');
  const today = new Date();
  for (const { emp, dev } of created) {
    for (const lv of (LEAVES[dev.email] || [])) {
      const from  = addDays(today, lv.fromOff);
      const to    = addDays(today, lv.toOff);
      const total = lv.toOff - lv.fromOff + 1;
      try {
        await Leave.create({
          employeeId: emp._id,
          leaveType: lv.leaveType,
          fromDate: from, toDate: to, totalDays: total,
          reason: lv.reason, status: lv.status,
          approvedBy:  lv.status === 'approved' ? managerEmp._id : null,
          approvedAt:  lv.status === 'approved' ? new Date() : null,
        });
        console.log(`  ✓ ${emp.firstName} — ${lv.leaveType} (${lv.status})`);
      } catch (e) {
        console.log(`  (skip) ${emp.firstName} leave: ${e.message}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' Seed complete! New accounts:');
  console.log('  dev1@fwchrms.com / Admin@1234  →  Arjun Sharma  (Backend Developer)');
  console.log('  dev2@fwchrms.com / Admin@1234  →  Priya Nair    (Frontend Developer)');
  console.log('  dev3@fwchrms.com / Admin@1234  →  Rahul Gupta   (Full Stack Developer)');
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(0);
};

seed().catch(err => {
  console.error('Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
