import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Full-screen loader shown while session is being rehydrated ────────────────
const SessionLoader = () => (
  <div style={{
    height: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0a0a0f', flexDirection: 'column', gap: '16px'
  }}>
    <div style={{
      width: 40, height: 40, border: '3px solid #1a1a2e',
      borderTop: '3px solid #6366f1', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: '#4a4a6a', fontSize: 13, fontFamily: 'monospace' }}>
      Verifying session...
    </p>
  </div>
);

// ── ProtectedRoute ─────────────────────────────────────────────────────────────
// Blocks any unauthenticated user and sends them to /login
export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <SessionLoader />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// ── RoleRoute ──────────────────────────────────────────────────────────────────
// Blocks authenticated users whose role doesn't match.
// Usage: <RoleRoute roles={['admin', 'senior_manager']} />
export const RoleRoute = ({ roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <SessionLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
};
