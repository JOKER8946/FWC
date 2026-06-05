/**
 * Run once to seed the initial admin account.
 * Usage: node backend/scripts/seedAdmin.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected.');

  const existing = await User.findOne({ email: 'admin@fwchrms.com' });
  if (existing) {
    console.log('Admin already exists. Skipping.');
    process.exit(0);
  }

  const user = await User.create({
    email: 'admin@fwchrms.com',
    passwordHash: 'Admin@1234',   // bcrypt hook hashes this automatically
    role: 'admin',
    isActive: true,
  });

  const employee = await Employee.create({
    userId: user._id,
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@fwchrms.com',
    department: 'management',
    designation: 'System Administrator',
    dateOfJoining: new Date(),
    salary: 0,
  });

  user.employeeId = employee._id;
  await user.save();

  console.log('✓ Admin seeded successfully.');
  console.log('  Email:    admin@fwchrms.com');
  console.log('  Password: Admin@1234');
  console.log('  Change this password immediately after first login!');
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
