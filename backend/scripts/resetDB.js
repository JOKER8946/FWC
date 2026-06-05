/**
 * Wipes the entire database and seeds a fresh admin + HR recruiter account.
 * Usage: node backend/scripts/resetDB.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');
const Employee = require('../models/Employee');

const reset = async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('MongoDB connected.');

  // ── Drop every collection ──────────────────────────────────────────────────
  const db   = mongoose.connection.db;
  const cols = await db.listCollections().toArray();

  if (cols.length === 0) {
    console.log('Database is already empty.');
  } else {
    for (const col of cols) {
      await db.dropCollection(col.name);
      console.log(`  ✗ Dropped: ${col.name}`);
    }
    console.log(`\nDropped ${cols.length} collection(s).\n`);
  }

  // ── Seed admin ─────────────────────────────────────────────────────────────
  const adminUser = await User.create({
    email: 'admin@fwchrms.com',
    passwordHash: 'Admin@1234',
    role: 'admin',
    isActive: true,
  });

  const adminEmployee = await Employee.create({
    userId: adminUser._id,
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@fwchrms.com',
    department: 'management',
    designation: 'System Administrator',
    dateOfJoining: new Date(),
    salary: 0,
  });

  adminUser.employeeId = adminEmployee._id;
  await adminUser.save();

  // ── Seed HR recruiter ──────────────────────────────────────────────────────
  const hrUser = await User.create({
    email: 'hr@fwchrms.com',
    passwordHash: 'Hr@123456',
    role: 'hr_recruiter',
    isActive: true,
  });

  const hrEmployee = await Employee.create({
    userId: hrUser._id,
    firstName: 'HR',
    lastName: 'FWC',
    email: 'hr@fwchrms.com',
    department: 'hr',
    designation: 'HR Recruiter',
    dateOfJoining: new Date(),
    salary: 0,
  });

  hrUser.employeeId = hrEmployee._id;
  await hrUser.save();

  console.log('✓ Fresh accounts created:\n');
  console.log('  Role:     Admin');
  console.log('  Email:    admin@fwchrms.com');
  console.log('  Password: Admin@1234\n');
  console.log('  Role:     HR Recruiter');
  console.log('  Email:    hr@fwchrms.com');
  console.log('  Password: Hr@123456\n');

  process.exit(0);
};

reset().catch(err => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
