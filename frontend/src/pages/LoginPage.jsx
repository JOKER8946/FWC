import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const ROLE_ROUTES = {
  admin:          '/dashboard/admin',
  senior_manager: '/dashboard/manager',
  hr_recruiter:   '/dashboard/recruiter',
  employee:       '/dashboard/employee',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Both fields are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email.trim(), form.password);
      navigate(ROLE_ROUTES[user.role] || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Animated background grid */}
      <div className="login-grid" aria-hidden="true" />

      {/* Glowing orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#grad)" />
              <path d="M7 14h14M14 7l7 7-7 7" stroke="#fff" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="brand-name">FWC HRMS</h1>
            <p className="brand-sub">AI-Powered HR Platform</p>
          </div>
        </div>

        <h2 className="login-heading">Welcome back</h2>
        <p className="login-subheading">Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {/* Email */}
          <div className="field-group">
            <label className="field-label" htmlFor="email">Email address</label>
            <div className="field-wrap">
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                id="email" name="email" type="email"
                className="field-input"
                placeholder="admin@fwchrms.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="field-wrap">
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password" name="password"
                type={showPass ? 'text' : 'password'}
                className="field-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <button type="button" className="field-toggle"
                onClick={() => setShowPass(s => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Signing in...
              </span>
            ) : (
              <>
                Sign in
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Role hint chips */}
        <div className="role-hints">
          <p className="hints-label">Demo accounts</p>
          <div className="hints-chips">
            {[
              { role: 'Admin', email: 'admin@fwchrms.com', color: '#6366f1' },
              { role: 'Manager', email: 'manager@fwchrms.com', color: '#0ea5e9' },
              { role: 'Recruiter', email: 'hr@fwchrms.com', color: '#10b981' },
              { role: 'Employee', email: 'employee@fwchrms.com', color: '#f59e0b' },
            ].map(({ role, email, color }) => (
              <button key={role} className="hint-chip"
                style={{ '--chip-color': color }}
                onClick={() => setForm({ email, password: 'Admin@1234' })}>
                <span className="chip-dot" />
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="login-footer">FWC IT Services Pvt. Ltd. · HRMS v1.0</p>
    </div>
  );
}
