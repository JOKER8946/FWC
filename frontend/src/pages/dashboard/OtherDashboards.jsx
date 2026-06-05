import { Routes, Route } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from './DashboardLayout';
import ResumeScreener from './ResumeScreener';
import HRBot from './HRBot';
import ScreeningSessionsPage from './ScreeningSessions';
import CandidatePipelinePage from './CandidatePipeline';
import HiringAnalyticsPage from './HiringAnalytics';
import FlightRiskPage from './FlightRisk';
import Attendance from './Attendance';
import Payroll from './Payroll';
import HRPayroll from './HRPayroll';
import Performance from './Performance';
import Leaves from './Leaves';
import EmployeesPage from './Employees';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// ── SENIOR MANAGER ────────────────────────────────────────────────────────────
const MANAGER_NAV = [
  { label: 'Overview',        path: '/dashboard/manager',             icon: '⬡' },
  { label: 'My Team',         path: '/dashboard/manager/team',        icon: '👥' },
  { label: 'Attendance',      path: '/dashboard/manager/attendance',  icon: '📅' },
  { label: 'Performance',     path: '/dashboard/manager/performance', icon: '📈' },
  { label: 'Flight Risk',     path: '/dashboard/manager/flight-risk', icon: '⚠️' },
  { label: 'Leave Approvals', path: '/dashboard/manager/leaves',      icon: '✅' },
];

function ManagerOverview() {
  const { user } = useAuth();

  const { data: teamData,  isLoading: loadingTeam  } = useQuery({
    queryKey: ['manager-team'],
    queryFn: () => API.get('/employees', { params: { limit: 100 } }).then(r => r.data),
  });
  const { data: riskData,  isLoading: loadingRisk  } = useQuery({
    queryKey: ['manager-risks'],
    queryFn: () => API.get('/flight-risk').then(r => r.data),
  });
  const { data: leaveData, isLoading: loadingLeave } = useQuery({
    queryKey: ['manager-leaves'],
    queryFn: () => API.get('/leaves?status=pending').then(r => r.data).catch(() => ({ data: [] })),
  });
  const { data: attData } = useQuery({
    queryKey: ['manager-att-today'],
    queryFn: () => API.get('/attendance/summary').then(r => r.data.data).catch(() => null),
  });

  const isLoading = loadingTeam || loadingRisk || loadingLeave;

  const teamCount     = teamData?.pagination?.total ?? '—';
  const highRisk      = (riskData?.data || []).filter(r => ['high','critical'].includes(r.riskLevel)).length;
  const pendingLeaves = leaveData?.data?.length ?? '—';
  const presentToday  = attData?.summary?.present ?? '—';

  if (isLoading) return (
    <>
      <h1 className="page-title">Team Dashboard</h1>
      <p className="page-subtitle">Your department's performance at a glance</p>
      <div className="stat-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" style={{ height: 32, marginTop: 10 }} />
            <div className="skeleton skeleton-line medium" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Team Dashboard</h1>
      <p className="page-subtitle">Your department's performance at a glance</p>
      <div className="stat-grid">
        {[
          { label: 'Team Members',      value: teamCount,    sub: 'Active employees' },
          { label: 'Present Today',     value: presentToday, sub: 'via attendance log' },
          { label: 'Pending Approvals', value: pendingLeaves, sub: 'Leave requests' },
          { label: 'At-Risk Members',   value: highRisk || '—', sub: 'High + Critical risk' },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaveApprovals() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['all-leaves'],
    queryFn: () => API.get('/leaves').then(r => r.data).catch(() => ({ data: [] })),
  });

  const leaves = data?.data || [];
  const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

  const handleAction = async (id, action) => {
    try {
      await API.patch(`/leaves/${id}/${action}`);
      qc.invalidateQueries(['all-leaves']);
    } catch {
      alert(`Action ${action} failed — leave API endpoint not yet connected.`);
    }
  };

  if (isLoading) return <div style={{ padding: 40, color: '#44445a', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Leave Approvals</h1>
      <p className="page-subtitle">Review and action team leave requests</p>
      {leaves.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <p>No leave requests pending. All clear!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {leaves.map(l => (
            <div key={l._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: '#e0e0f0' }}>
                  {l.employeeId?.firstName || 'Employee'} · {l.leaveType} Leave
                </div>
                <div style={{ fontSize: 11, color: '#555570', marginTop: 3 }}>
                  {l.fromDate?.slice(0,10)} → {l.toDate?.slice(0,10)} · {l.totalDays} day(s)
                </div>
                {l.reason && <div style={{ fontSize: 11, color: '#7070a0', marginTop: 2 }}>{l.reason}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[l.status], padding: '2px 8px',
                  background: `${statusColor[l.status]}18`, borderRadius: 99, textTransform: 'capitalize' }}>
                  {l.status}
                </span>
                {l.status === 'pending' && (
                  <>
                    <button onClick={() => handleAction(l._id, 'approve')}
                      style={{ padding: '5px 12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: 6, color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => handleAction(l._id, 'reject')}
                      style={{ padding: '5px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 6, color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      ✗ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ManagerDashboard() {
  return (
    <DashboardLayout navItems={MANAGER_NAV} accentColor="#0ea5e9" roleName="Senior Manager">
      <Routes>
        <Route index             element={<ManagerOverview />} />
        <Route path="team"       element={<EmployeesPage />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="performance" element={<Performance />} />
        <Route path="flight-risk" element={<FlightRiskPage />} />
        <Route path="leaves"     element={<LeaveApprovals />} />
      </Routes>
    </DashboardLayout>
  );
}

// ── HR RECRUITER ──────────────────────────────────────────────────────────────
const RECRUITER_NAV = [
  { label: 'Overview',           path: '/dashboard/recruiter',             icon: '⬡'  },
  { label: 'Resume Screener',    path: '/dashboard/recruiter/resumes',     icon: '🤖' },
  { label: 'Candidate Pipeline', path: '/dashboard/recruiter/pipeline',    icon: '📋' },
  { label: 'Screening Sessions', path: '/dashboard/recruiter/screening',   icon: '🎤' },
  { label: 'Analytics',          path: '/dashboard/recruiter/analytics',   icon: '📊' },
  { label: 'Payroll',            path: '/dashboard/recruiter/payroll',     icon: '💰' },
];

function RecruiterOverview() {
  const { data: resumeData,  isLoading: loadingResumes  } = useQuery({
    queryKey: ['recruiter-resumes'],
    queryFn: () => API.get('/resumes').then(r => r.data).catch(() => ({ data: [] })),
  });
  const { data: sessionData, isLoading: loadingSessions } = useQuery({
    queryKey: ['recruiter-sessions'],
    queryFn: () => API.get('/screening').then(r => r.data).catch(() => ({ data: [] })),
  });
  const { data: jobData,     isLoading: loadingJobs     } = useQuery({
    queryKey: ['recruiter-jobs'],
    queryFn: () => API.get('/resumes/jobs').then(r => r.data).catch(() => ({ data: [] })),
  });

  const resumes  = resumeData?.data  || [];
  const sessions = sessionData?.data || [];
  const jobs     = jobData?.data     || [];

  if (loadingResumes || loadingSessions || loadingJobs) return (
    <>
      <h1 className="page-title">Recruitment Hub</h1>
      <p className="page-subtitle">AI-powered hiring pipeline</p>
      <div className="stat-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" style={{ height: 32, marginTop: 10 }} />
            <div className="skeleton skeleton-line medium" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </>
  );

  const screened    = resumes.filter(r => r.blindScore != null).length;
  const shortlisted = resumes.filter(r => ['shortlisted','interview_scheduled'].includes(r.status)).length;
  const completed   = sessions.filter(s => s.status === 'completed').length;
  const advanced    = sessions.filter(s => s.aiAnalysis?.overallVerdict === 'advance').length;

  const funnelSteps = [
    { label: 'Applied',     value: resumes.length, color: '#6366f1'  },
    { label: 'Shortlisted', value: shortlisted,    color: '#10b981'  },
    { label: 'Interviewed', value: completed,       color: '#f59e0b'  },
    { label: 'Advanced',    value: advanced,        color: '#10b981'  },
  ];
  const funnelMax = resumes.length || 1;

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Recruitment Hub</h1>
      <p className="page-subtitle">AI-powered hiring pipeline</p>

      <div className="stat-grid">
        {[
          { label: 'Job Postings',   value: jobs.length ?? '—',   sub: 'Active roles' },
          { label: 'Screened',       value: screened,              sub: `of ${resumes.length} uploaded` },
          { label: 'Shortlisted',    value: shortlisted,           sub: 'Ready for interview' },
          { label: 'Interviews Done',value: completed,             sub: `${advanced} advanced` },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Mini funnel */}
      {resumes.length > 0 && (
        <div style={{ marginTop: 20, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Hiring Funnel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelSteps.map(step => {
              const pct = Math.round((step.value / funnelMax) * 100);
              return (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 82, fontSize: 12, color: '#7070a0', textAlign: 'right', flexShrink: 0 }}>{step.label}</span>
                  <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: step.color, borderRadius: 4, minWidth: step.value > 0 ? 28 : 0, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width 0.5s ease' }}>
                      {step.value > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{step.value}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI features + quick links */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 16, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981', marginBottom: 8 }}>🤖 AI Features Active</div>
          <div style={{ fontSize: 12.5, color: '#9090b0', lineHeight: 1.7 }}>
            ✓ Blind resume scoring via RAG + Gemini<br />
            ✓ PII hidden until shortlisting<br />
            ✓ Dynamic AI interviews<br />
            ✓ Server-side voice transcription<br />
            ✓ Proctoring: tab-switch detection
          </div>
        </div>
        <div style={{ padding: 16, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc', marginBottom: 10 }}>⚡ Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '→ Screen new resumes',     path: '/dashboard/recruiter/resumes'   },
              { label: '→ View candidate pipeline', path: '/dashboard/recruiter/pipeline'  },
              { label: '→ Start AI interview',      path: '/dashboard/recruiter/screening' },
              { label: '→ Full analytics report',   path: '/dashboard/recruiter/analytics' },
            ].map(({ label, path }) => (
              <a key={path} href={path} style={{ fontSize: 12.5, color: '#7070a0', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = '#a5b4fc'}
                onMouseLeave={e => e.target.style.color = '#7070a0'}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecruiterDashboard() {
  return (
    <DashboardLayout navItems={RECRUITER_NAV} accentColor="#10b981" roleName="HR Recruiter">
      <Routes>
        <Route index              element={<RecruiterOverview />} />
        <Route path="resumes"     element={<ResumeScreener />} />
        <Route path="pipeline"    element={<CandidatePipelinePage />} />
        <Route path="screening"   element={<ScreeningSessionsPage />} />
        <Route path="analytics"   element={<HiringAnalyticsPage />} />
        <Route path="payroll"     element={<HRPayroll />} />
      </Routes>
    </DashboardLayout>
  );
}

// ── EMPLOYEE ──────────────────────────────────────────────────────────────────
const EMPLOYEE_NAV = [
  { label: 'My Dashboard', path: '/dashboard/employee',             icon: '⬡' },
  { label: 'Attendance',   path: '/dashboard/employee/attendance',  icon: '📅' },
  { label: 'Leave',        path: '/dashboard/employee/leaves',      icon: '🏖️' },
  { label: 'Payslips',     path: '/dashboard/employee/payslips',    icon: '💰' },
  { label: 'Performance',  path: '/dashboard/employee/performance', icon: '📈' },
  { label: 'HR Assistant', path: '/dashboard/employee/hr-bot',      icon: '🤖' },
];

function EmployeeOverview() {
  const { data: myStats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => API.get('/employees/me/stats').then(r => r.data.data),
  });

  const fmt = (n) => n != null ? n : '—';
  const fmtCurrency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

  return (
    <div className="page-fade-in">
      <h1 className="page-title">My Workspace</h1>
      <p className="page-subtitle">Your personal HR dashboard</p>
      <div className="stat-grid">
        {[
          { label: 'Days Present',      value: fmt(myStats?.daysPresent),     sub: 'This month' },
          { label: 'Pending Leaves',    value: fmt(myStats?.pendingLeaves),   sub: 'Awaiting approval' },
          { label: 'Last Net Pay',      value: fmtCurrency(myStats?.lastNetPay), sub: myStats?.lastPayMonth || 'No payslip yet' },
          { label: 'Performance Score', value: myStats?.performanceScore != null ? `${myStats.performanceScore}/100` : '—', sub: myStats?.reviewPeriod || 'No review yet' },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: 16, background: 'rgba(245,158,11,0.04)',
        border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>
          🤖 HR Policy Assistant
        </div>
        <div style={{ fontSize: 12.5, color: '#9090b0' }}>
          Ask me anything about company policies, leave rules, or benefits — powered by RAG + Gemini.
        </div>
        <a href="/dashboard/employee/hr-bot"
          style={{ display: 'inline-block', marginTop: 10, padding: '6px 14px',
            background: 'rgba(245,158,11,0.12)', borderRadius: 7, color: '#f59e0b',
            fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          Open HR Assistant →
        </a>
      </div>
    </div>
  );
}

export function EmployeeDashboard() {
  return (
    <DashboardLayout navItems={EMPLOYEE_NAV} accentColor="#f59e0b" roleName="Employee">
      <Routes>
        <Route index             element={<EmployeeOverview />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves"     element={<Leaves />} />
        <Route path="payslips"   element={<Payroll />} />
        <Route path="performance" element={<Performance />} />
        <Route path="hr-bot"     element={<HRBot />} />
      </Routes>
    </DashboardLayout>
  );
}

export default ManagerDashboard;
