import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/auth/ProtectedRoute';

import LoginPage               from './pages/LoginPage';
import UnauthorizedPage        from './pages/UnauthorizedPage';
import CandidateInterviewPage  from './pages/CandidateInterviewPage';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import { ManagerDashboard, RecruiterDashboard, EmployeeDashboard }
  from './pages/dashboard/OtherDashboards';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

const RoleRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  const routes = {
    admin:          '/dashboard/admin',
    senior_manager: '/dashboard/manager',
    hr_recruiter:   '/dashboard/recruiter',
    employee:       '/dashboard/employee',
  };
  return <Navigate to={routes[user?.role] || '/login'} replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<RoleRedirect />} />
            </Route>

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={['senior_manager']} />}>
              <Route path="/dashboard/manager/*" element={<ManagerDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={['hr_recruiter']} />}>
              <Route path="/dashboard/recruiter/*" element={<RecruiterDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={['employee']} />}>
              <Route path="/dashboard/employee/*" element={<EmployeeDashboard />} />
            </Route>

            {/* Public candidate interview route — no auth required */}
            <Route path="/interview/:token" element={<CandidateInterviewPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
