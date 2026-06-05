import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function UnauthorizedPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080810', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      gap: '16px', fontFamily: 'DM Sans, sans-serif', padding: '24px',
    }}>
      <div style={{
        fontSize: 64, lineHeight: 1,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>403</div>
      <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>
        Access Denied
      </h1>
      <p style={{ color: '#555570', fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 320 }}>
        Your role <strong style={{ color: '#6366f1' }}>{user?.role}</strong> does
        not have permission to access this page.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={() => navigate(-1)} style={{
          padding: '10px 20px', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: '#9090b0', cursor: 'pointer', fontSize: 13,
        }}>Go back</button>
        <button onClick={handleLogout} style={{
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', borderRadius: 8, color: '#fff',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>Sign out</button>
      </div>
    </div>
  );
}
