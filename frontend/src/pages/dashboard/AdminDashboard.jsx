import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from './DashboardLayout';
import EmployeesPage from './Employees';
import PolicyDocs from './PolicyDocs';
import FlightRiskPage from './FlightRisk';
import Attendance from './Attendance';
import HRPayroll from './HRPayroll';
import Performance from './Performance';
import UserManagement from './UserManagement';
import ResumeScreener from './ResumeScreener';
import ScreeningSessionsPage from './ScreeningSessions';
import CandidatePipelinePage from './CandidatePipeline';
import HiringAnalyticsPage from './HiringAnalytics';
import HRBot from './HRBot';
import { LeaveApprovals } from './OtherDashboards';
import MoneyAmount from '../../components/MoneyAmount';
import API from '../../api/axios';

const NAV = [
  { label: 'Overview',          path: '/dashboard/admin',              icon: '⬡'  },
  // ── Recruitment (HR features)
  { label: 'Resume Screener',   path: '/dashboard/admin/resumes',      icon: '🤖' },
  { label: 'Candidate Pipeline',path: '/dashboard/admin/pipeline',     icon: '🎯' },
  { label: 'AI Interviews',     path: '/dashboard/admin/screening',    icon: '🎤' },
  { label: 'Hiring Analytics',  path: '/dashboard/admin/analytics',    icon: '📊' },
  // ── Core HRMS
  { label: 'Employees',         path: '/dashboard/admin/employees',    icon: '👥' },
  { label: 'Attendance',        path: '/dashboard/admin/attendance',   icon: '📅' },
  { label: 'Payroll',           path: '/dashboard/admin/payroll',      icon: '💰' },
  { label: 'Performance',       path: '/dashboard/admin/performance',  icon: '📈' },
  { label: 'Flight Risk',       path: '/dashboard/admin/flight-risk',  icon: '⚠️' },
  { label: 'Leave Approvals',   path: '/dashboard/admin/leaves',       icon: '✅' },
  // ── Admin-only
  { label: 'User Management',   path: '/dashboard/admin/users',        icon: '🔑' },
  { label: 'Policy Docs',       path: '/dashboard/admin/policy',       icon: '📋' },
  { label: 'HR Assistant',      path: '/dashboard/admin/hr-bot',       icon: '💬' },
];

function AdminOverview() {
  const navigate = useNavigate();

  const { data: empStats }      = useQuery({ queryKey: ['emp-stats'],      queryFn: () => API.get('/employees/stats').then(r => r.data.data) });
  const { data: todayAtt }      = useQuery({ queryKey: ['att-today'],      queryFn: () => API.get('/attendance/summary').then(r => r.data.data) });
  const { data: riskData }      = useQuery({ queryKey: ['risk-overview'],  queryFn: () => API.get('/flight-risk').then(r => r.data) });
  const { data: payrollSummary} = useQuery({ queryKey: ['payroll-summary'],queryFn: () => API.get('/payroll/summary').then(r => r.data.data) });
  const { data: resumeData }    = useQuery({ queryKey: ['admin-resumes'],  queryFn: () => API.get('/resumes').then(r => r.data).catch(() => ({ data: [] })) });
  const { data: sessionData }   = useQuery({ queryKey: ['admin-sessions'], queryFn: () => API.get('/screening').then(r => r.data).catch(() => ({ data: [] })) });

  const highRisk      = (riskData?.data || []).filter(r => ['high','critical'].includes(r.riskLevel)).length;
  const resumes       = resumeData?.data || [];
  const sessions      = sessionData?.data || [];
  const shortlisted   = resumes.filter(r => ['shortlisted','interview_scheduled'].includes(r.status)).length;
  const interviewsDone = sessions.filter(s => s.status === 'completed').length;

  const topStats = [
    { label: 'Total Employees',    value: empStats?.total ?? '—',       sub: `${empStats?.active ?? '—'} active` },
    { label: 'Present Today',      value: todayAtt?.summary?.present ?? '—', sub: 'via attendance log' },
    { label: 'Payroll This Month', valueNode: <MoneyAmount value={payrollSummary?.totalNetPay} scope="global" key="admin-dashboard" />, sub: payrollSummary ? `${payrollSummary.paidCount} paid · ${payrollSummary.pendingCount} pending` : 'No data yet' },
    { label: 'Flight Risks',       value: highRisk || '—',              sub: 'High + Critical' },
  ];

  const recruitingStats = [
    { label: 'Resumes Uploaded',   value: resumes.length || '—',        sub: `${shortlisted} shortlisted` },
    { label: 'Screened by AI',     value: resumes.filter(r => r.blindScore != null).length || '—', sub: 'Blind scoring done' },
    { label: 'Interviews Done',    value: interviewsDone || '—',        sub: `${sessions.filter(s => s.aiAnalysis?.overallVerdict === 'advance').length} advanced` },
  ];

  const quickActions = [
    { icon: '👥', label: 'Manage Employees',   path: '/dashboard/admin/employees'  },
    { icon: '🔑', label: 'User Management',    path: '/dashboard/admin/users'      },
    { icon: '🤖', label: 'Screen Resumes',     path: '/dashboard/admin/resumes'    },
    { icon: '🎤', label: 'AI Interviews',      path: '/dashboard/admin/screening'  },
    { icon: '⚠️', label: 'Flight Risk',        path: '/dashboard/admin/flight-risk'},
    { icon: '📋', label: 'Policy Docs',        path: '/dashboard/admin/policy'     },
    { icon: '💰', label: 'Payroll',            path: '/dashboard/admin/payroll'    },
    { icon: '📈', label: 'Performance',        path: '/dashboard/admin/performance'},
  ];

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Command Center</h1>
      <p className="page-subtitle">Company-wide overview · Full administrative access</p>

      {/* Core HRMS stats */}
      <div className="stat-grid">
        {topStats.map(({ label, value, valueNode, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{valueNode ?? value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Recruitment pipeline stats */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <span className="section-title">Recruitment Pipeline</span>
        <button className="section-action" onClick={() => navigate('/dashboard/admin/analytics')}>
          Full analytics →
        </button>
      </div>
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        {recruitingStats.map(({ label, value, valueNode, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{valueNode ?? value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Department breakdown */}
      {empStats?.byDept?.length > 0 && (
        <>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <span className="section-title">Department Breakdown</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {empStats.byDept.map(d => (
              <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#7070a0', width: 120, textTransform: 'capitalize' }}>{d._id}</span>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                  <div style={{ width: `${(d.count / empStats.total) * 100}%`, height: '100%', background: '#6366f1', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: '#9090b0', width: 24 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick actions */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <span className="section-title">Quick Actions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {quickActions.map(({ icon, label, path }) => (
          <button key={label} onClick={() => navigate(path)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, color: '#c0c0e0', fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
              textAlign: 'left' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <DashboardLayout navItems={NAV} accentColor="#6366f1" roleName="Admin">
      <Routes>
        <Route index              element={<AdminOverview />} />
        {/* Recruitment */}
        <Route path="resumes"     element={<ResumeScreener />} />
        <Route path="pipeline"    element={<CandidatePipelinePage />} />
        <Route path="screening"   element={<ScreeningSessionsPage />} />
        <Route path="analytics"   element={<HiringAnalyticsPage />} />
        {/* Core HRMS */}
        <Route path="employees"   element={<EmployeesPage />} />
        <Route path="attendance"  element={<Attendance />} />
        <Route path="payroll"     element={<HRPayroll />} />
        <Route path="performance" element={<Performance />} />
        <Route path="flight-risk" element={<FlightRiskPage />} />
        <Route path="leaves"      element={<LeaveApprovals />} />
        {/* Admin-only */}
        <Route path="users"       element={<UserManagement />} />
        <Route path="policy"      element={<PolicyDocs />} />
        <Route path="hr-bot"      element={<HRBot />} />
      </Routes>
    </DashboardLayout>
  );
}
