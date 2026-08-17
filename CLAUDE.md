# CLAUDE.md

AI-powered HRMS (Human Resource Management System) built for the FWC AI/ML hackathon. Monorepo: `backend/` (Node + Express + MongoDB REST API) and `frontend/` (React 19 + Vite SPA). Features: blind resume screening, AI interviews + proctoring, flight-risk neural network, HR policy RAG chatbot — all using Google Gemini. Four roles: Admin, Senior Manager, HR Recruiter, Employee.

## Commands
- Backend: `cd backend && npm run dev` (nodemon) or `npm start` — runs on port 5000.
- Frontend: `cd frontend && npm run dev` (Vite) / `npm run build` / `npm run lint` — runs on port 5173.
- Seed DB: `node backend/scripts/resetDB.js` then `node backend/scripts/seedData.js`.

## Root
- `README.md` — full project docs: features, tech stack, setup, deployment, complete API reference.
- `render.yaml` — Render.com blueprint defining backend web service + frontend static site.
- `.gitignore` — git ignore rules.

## backend/ — Node.js + Express REST API
- `server.js` — Express app entry: CORS, Socket.io, route registration, error handling, env sanity check.
- `package.json` — backend dependencies (express, mongoose, gemini SDKs, brain.js, multer, socket.io).
- `.env.example` — template for env vars (MONGO_URI, JWT_SECRET, GEMINI_API_KEY, CLIENT_URL, PORT).
- `.npmrc` — npm config.
- `rsq.http` — REST client request samples for manual API testing.

### backend/config/
- `db.js` — MongoDB connection via Mongoose (forces IPv4, sets timeout).
- `multer.js` — Multer file-upload config; ensures uploads dir exists, names files.

### backend/middleware/
- `auth.js` — `protect` (verifies JWT) and `authorize(...roles)` (RBAC) middleware.

### backend/models/ — Mongoose schemas
- `index.js` — central model registry / exports.
- `User.js` — user accounts (email, hashed password, role).
- `Employee.js` — employee profile (department, salary, manager, etc.).
- `Attendance.js` — daily check-in/check-out records.
- `Payroll.js` — payslip records (status pending→processed→paid).
- `Performance.js` — performance reviews with AI-generated summaries.
- `Leave.js` — leave requests (apply/approve/reject/cancel).
- `Job.js` — job postings.
- `Resume.js` — uploaded resumes with AI screening scores.
- `ResumeChunk.js` — embedded text chunks of resumes for RAG retrieval.
- `ScreeningSession.js` — AI interview sessions (transcript, proctoring, token, analysis).
- `FlightRisk.js` — per-employee churn risk assessments (NN output).
- `PolicyDocument.js` — uploaded HR policy PDFs.
- `RagChunk.js` — embedded policy-document chunks for the RAG chatbot.

### backend/controllers/ — business logic per domain
- `authController.js` — register, login, get profile, change password, logout.
- `employeeController.js` — employee CRUD, stats, departments, role/active toggles.
- `attendanceController.js` — check-in/out, history, company summary, manual marking.
- `payrollController.js` — payslip CRUD, summary, status updates.
- `performanceController.js` — review CRUD + AI summary, employee acknowledge.
- `leaveController.js` — apply for leave, approve/reject/cancel.
- `jobController.js` — job posting list/create/update.
- `resumeController.js` — resume upload, AI screening, shortlist/reject.
- `screeningController.js` — HR-managed interview sessions: create, link, message, end + analysis.
- `candidateController.js` — public token-gated candidate portal (fetch session, answer, proctoring, transcribe).
- `flightRiskController.js` — run/retrain Brain.js NN, list/resolve risk assessments.
- `policyController.js` — policy PDF upload + chunk + embed, RAG chatbot query, toggle/delete.
- `ragBotController.js` — RAG chatbot logic for policy Q&A.

### backend/routes/ — Express routers (with RBAC middleware)
- `authRoutes.js` — `/api/auth` endpoints.
- `employeeRoutes.js` — `/api/employees` endpoints.
- `attendanceRoutes.js` — `/api/attendance` endpoints.
- `payrollRoutes.js` — `/api/payroll` endpoints.
- `performanceRoutes.js` — `/api/performance` endpoints.
- `leaveRoutes.js` — `/api/leaves` endpoints.
- `jobRoutes.js` — `/api/jobs` endpoints.
- `resumeRoutes.js` — `/api/resumes` endpoints.
- `screeningRoutes.js` — `/api/screening` authenticated HR endpoints.
- `candidateRoutes.js` — `/api/screening/candidate` public token endpoints (registered before screeningRoutes).
- `flightRiskRoutes.js` — `/api/flight-risk` endpoints.
- `policyRoutes.js` — `/api/policy` endpoints.

### backend/services/
- `geminiService.js` — Gemini API wrapper: generateContent/embedContent with model fallback chain; audio transcription.
- `flightRiskNN.js` — Brain.js neural network: train/load/predict employee flight risk.

### backend/utils/
- `chunkText.js` — splits text into overlapping chunks for RAG retrieval.
- `extractPdfText.js` — extracts raw text from PDF files (pdf-parse).
- `generateSyntheticData.js` — generates labeled synthetic training data for the flight-risk NN.
- `generateToken.js` — signs JWTs for a given user ID.
- `interviewHelpers.js` — interview turn limits + transcript formatting helpers.

### backend/ml_models/
- `flight_risk_nn.json` — saved Brain.js neural network weights.

### backend/scripts/ — DB seed & diagnostic scripts
- `resetDB.js` — wipes DB, seeds fresh admin + HR accounts.
- `seedAdmin.js` — seeds the initial admin account only.
- `seedData.js` — seeds 3 dev employees with 90 days of attendance/payroll/performance/leave data.
- `seedHiringData.js` — seeds resumes + screening sessions for the hiring pipeline.
- `seedPerformance.js` — seeds performance reviews for all employees across 3 periods.
- `inspectData.js` — diagnostic; lists jobs, resumes, screening sessions in DB.
- `verifyPipelineAPI.js` — contract check; invokes pipeline/analytics controllers with fake req/res.

### backend/uploads/resumes/
- Stored uploaded resume PDFs (runtime artifacts).

## frontend/ — React 19 + Vite SPA
- `index.html` — HTML entry point.
- `package.json` — frontend deps (react, react-router 7, tanstack query, axios, socket.io-client, tailwind).
- `vite.config.js` — Vite build config.
- `vercel.json` — Vercel SPA rewrite config.
- `eslint.config.js`, `postcss.config.cjs`, `tailwind.config.cjs` — lint/CSS tooling config.
- `.env.example` — template (VITE_API_URL).

### frontend/public/
- `favicon.svg`, `icons.svg` — static SVG assets.

### frontend/src/
- `main.jsx` — React app bootstrap / render root.
- `App.jsx` — root component: router, role-based routes, QueryClient, AuthProvider.
- `App.css`, `index.css` — global styles / design system.

#### frontend/src/api/ — Axios API helpers
- `axios.js` — configured Axios instance with JWT interceptor + base URL.
- `auth.js` — auth API calls (login, register, me, logout).
- `employees.js` — employee API calls.
- `candidate.js` — raw (no-JWT) Axios for the public candidate portal.
- `screening.js` — HR screening-session API calls.
- `resumes.js` — resume screening API calls.
- `flightRisk.js` — flight-risk API calls.
- `policy.js` — policy docs + RAG chatbot API calls.

#### frontend/src/context/
- `AuthContext.jsx` — global auth state (JWT, user), login/logout, session rehydration.

#### frontend/src/components/
- `AttendanceCalendar.jsx` — calendar with holidays/events highlighting.
- `MoneyAmount.jsx` — money value wrapper with 👁/🙈 privacy-toggle.
- `auth/ProtectedRoute.jsx` — `ProtectedRoute` + `RoleRoute` route guards.

#### frontend/src/hooks/
- `useMoneyVisibility.js` — shared show/hide state for many MoneyAmount children.
- `useSpeechRecognition.js` — Web Speech API speech-to-text hook.
- `useSpeechSynthesis.js` — Web Speech API text-to-speech hook.

#### frontend/src/data/
- `calendarData.js` — Indian public holidays + company events for 2025–2027.

#### frontend/src/pages/ — top-level pages
- `LoginPage.jsx` / `.css` — login screen.
- `UnauthorizedPage.jsx` — 403 / access-denied page.
- `CandidateInterviewPage.jsx` / `.css` — public token-gated candidate AI interview portal (voice + proctoring).

#### frontend/src/pages/dashboard/ — role-specific dashboard pages
- `DashboardLayout.jsx` / `.css` — shared dashboard shell (sidebar, nav).
- `AdminDashboard.jsx` — admin dashboard root + routes.
- `OtherDashboards.jsx` — Manager, Recruiter, and Employee dashboard roots + routes.
- `Employees.jsx` / `.css` — employee management.
- `Attendance.jsx` — attendance check-in/out + team view.
- `Payroll.jsx` — employee payroll view.
- `HRPayroll.jsx` — HR/admin full payroll management.
- `Performance.jsx` — performance reviews (view/create/acknowledge).
- `Leaves.jsx` — leave management.
- `ResumeScreener.jsx` / `.css` — AI blind resume screening.
- `CandidatePipeline.jsx` — hiring pipeline tracking.
- `HiringAnalytics.jsx` — hiring funnel analytics.
- `ScreeningSessions.jsx` / `.css` — manage AI interview sessions + generate candidate links.
- `FlightRisk.jsx` / `.css` — employee flight-risk dashboard (NN predictions).
- `HRBot.jsx` / `.css` — HR policy RAG chatbot UI.
- `PolicyDocs.jsx` / `.css` — policy document upload/management.
- `UserManagement.jsx` — admin-only user account management.

## Key architecture notes
- **Auth:** JWT issued on login → Axios interceptor attaches it → `protect` verifies → `authorize(...roles)` enforces RBAC per route.
- **Gemini fallback chain:** `geminiService.js` tries `gemini-2.5-flash` → `-flash-lite` → `gemini-2.0-flash` → `gemini-1.5-flash`, catching 404/429/503 with back-off.
- **RAG pipeline:** PDFs chunked → embedded via Gemini → stored as vectors in MongoDB → cosine-similarity search at query time → top chunks injected into prompt.
- **Candidate portal:** HR generates token-gated link (48h expiry); candidate opens `/interview/:token` with no login; voice transcribed server-side via Gemini; proctoring events recorded silently.
