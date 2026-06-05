const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');

connectDB();

const app = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});

app.use((req, res, next) => { req.io = io; next(); });

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('join_room', (room) => socket.join(room));
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'HRMS API is running.' });
});

// ── Routes (each registered exactly once) ────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/employees',   require('./routes/employeeRoutes'));
app.use('/api/jobs',        require('./routes/jobRoutes'));
app.use('/api/resumes',     require('./routes/resumeRoutes'));
app.use('/api/policy',      require('./routes/policyRoutes'));
app.use('/api/flight-risk', require('./routes/flightRiskRoutes'));
app.use('/api/screening/candidate', require('./routes/candidateRoutes')); // public — must be BEFORE screeningRoutes
app.use('/api/screening',           require('./routes/screeningRoutes')); // authenticated
app.use('/api/attendance',  require('./routes/attendanceRoutes'));
app.use('/api/payroll',      require('./routes/payrollRoutes'));
app.use('/api/performance',  require('./routes/performanceRoutes'));
app.use('/api/leaves',       require('./routes/leaveRoutes'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `${field} already exists.` });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);
