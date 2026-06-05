import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './DashboardLayout.css';

export default function DashboardLayout({ navItems, accentColor, roleName, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="dash-root" style={{ '--accent': accentColor }}>

      {/* ── Mobile backdrop ─────────────────────────────────────────────── */}
      <div
        className={`dash-mobile-backdrop ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`dash-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="var(--accent)" />
              <path d="M7 14h14M14 7l7 7-7 7" stroke="#fff" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <span className="sidebar-brand-name">FWC HRMS</span>
              <span className="sidebar-role-badge">{roleName}</span>
            </div>
          )}
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {collapsed
                ? <path d="M9 18l6-6-6-6" />
                : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map(({ label, icon, path }) => (
            <NavLink key={path} to={path} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="link-icon">{icon}</span>
              {!collapsed && <span className="link-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: accentColor }}>
            {initials}
          </div>
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">{user?.firstName} {user?.lastName}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="dash-main">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>☰</button>
        {children}
      </main>
    </div>
  );
}
