import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../api/axios';

const ROLE_COLOR = {
  admin:           '#ef4444',
  senior_manager:  '#0ea5e9',
  hr_recruiter:    '#10b981',
  employee:        '#f59e0b',
};
const ROLE_LABEL = {
  admin:          'Admin',
  senior_manager: 'Manager',
  hr_recruiter:   'HR',
  employee:       'Employee',
};
const ALL_ROLES = ['admin', 'senior_manager', 'hr_recruiter', 'employee'];

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    role: 'employee', department: '', designation: '',
    salary: '', phone: '',
    dateOfJoining: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const req = ['firstName', 'lastName', 'email', 'password', 'department', 'designation', 'salary'];
    const missing = req.filter(k => !form[k]);
    if (missing.length) return setError(`Required: ${missing.join(', ')}`);
    setSaving(true); setError('');
    try {
      await API.post('/employees', { ...form, salary: Number(form.salary) });
      onCreated(); onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create user.');
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#e0e0f0', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' };
  const lbl = (t) => <div style={{ fontSize: 10.5, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Create New User</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>{lbl('First Name')}<input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Arjun" style={inp} /></div>
          <div>{lbl('Last Name')}<input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Sharma" style={inp} /></div>
          <div style={{ gridColumn: '1/-1' }}>{lbl('Email')}<input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="arjun@fwchrms.com" style={inp} /></div>
          <div>{lbl('Password')}<input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 chars" style={inp} /></div>
          <div>
            {lbl('Role')}
            <select value={form.role} onChange={e => set('role', e.target.value)} style={inp}>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div>{lbl('Department')}<input value={form.department} onChange={e => set('department', e.target.value)} placeholder="engineering" style={inp} /></div>
          <div>{lbl('Designation')}<input value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="Software Engineer" style={inp} /></div>
          <div>{lbl('Salary (₹/month)')}<input type="number" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="75000" style={inp} /></div>
          <div>{lbl('Phone')}<input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" style={inp} /></div>
          <div>{lbl('Date of Joining')}<input type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} style={inp} /></div>
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#7070a0', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const qc = useQueryClient();
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate,   setShowCreate]   = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['all-users', search, roleFilter, statusFilter],
    queryFn: () => {
      const params = { limit: 200 };
      if (search) params.search = search;
      return API.get('/employees', { params }).then(r => r.data);
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => API.patch(`/employees/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries(['all-users']),
  });

  const toggleActive = useMutation({
    mutationFn: (id) => API.patch(`/employees/${id}/toggle-active`),
    onSuccess: () => qc.invalidateQueries(['all-users']),
  });

  let users = data?.data || [];

  // Client-side filters
  if (roleFilter)   users = users.filter(u => u.userId?.role === roleFilter);
  if (statusFilter) users = users.filter(u =>
    statusFilter === 'active'   ? u.userId?.isActive :
    statusFilter === 'inactive' ? !u.userId?.isActive : true
  );

  const total    = data?.pagination?.total ?? 0;
  const active   = users.filter(u => u.userId?.isActive).length;
  const inactive = users.filter(u => !u.userId?.isActive).length;
  const roleCounts = ALL_ROLES.reduce((acc, r) => { acc[r] = users.filter(u => u.userId?.role === r).length; return acc; }, {});

  const inp = { padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e0e0f0', fontSize: 12.5, fontFamily: 'DM Sans, sans-serif', outline: 'none' };

  return (
    <div className="page-fade-in">
      <h1 className="page-title">User Management</h1>
      <p className="page-subtitle">Manage accounts, roles, and access control</p>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Users',  value: total,    sub: 'All accounts' },
          { label: 'Active',       value: active,   sub: 'Can log in' },
          { label: 'Inactive',     value: inactive, sub: 'Access revoked' },
          { label: 'Role Breakdown', value: `${roleCounts.admin}A · ${roleCounts.senior_manager}M · ${roleCounts.hr_recruiter}HR · ${roleCounts.employee}E`, sub: 'Admin · Mgr · HR · Emp' },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: label === 'Role Breakdown' ? 14 : undefined }}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" style={{ ...inp, width: 220 }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={inp}>
          <option value="">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inp}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || roleFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }} style={{ ...inp, color: '#f87171', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)' }}>Clear</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Create User
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#44445a' }}>Loading users…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
          <p>No users found.</p>
        </div>
      ) : (
        <div className="table-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 560 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px', gap: 12, padding: '4px 18px' }}>
            {['Name', 'Email', 'Department', 'Role', 'Status', 'Actions'].map(h => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
            ))}
          </div>

          {users.map(u => {
            const role     = u.userId?.role || 'employee';
            const isActive = u.userId?.isActive !== false;
            const rc       = ROLE_COLOR[role] || '#7070a0';
            return (
              <div key={u._id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px', gap: 12, alignItems: 'center', padding: '12px 18px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,0,0,0.08)'}`, borderRadius: 10, opacity: isActive ? 1 : 0.6 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#e0e0f0' }}>{u.firstName} {u.lastName}</div>
                  <div style={{ fontSize: 11, color: '#555570', marginTop: 2 }}>{u.designation}</div>
                </div>
                <div style={{ fontSize: 12.5, color: '#7070a0', wordBreak: 'break-all' }}>{u.email}</div>
                <div style={{ fontSize: 12.5, color: '#9090b0', textTransform: 'capitalize' }}>{u.department}</div>
                <div>
                  <select
                    value={role}
                    onChange={e => changeRole.mutate({ id: u._id, role: e.target.value })}
                    style={{ padding: '3px 8px', background: `${rc}12`, border: `1px solid ${rc}40`, borderRadius: 99, color: rc, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                  >
                    {ALL_ROLES.map(r => <option key={r} value={r} style={{ background: '#0d0d1a', color: '#e0e0f0' }}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#10b981' : '#ef4444', padding: '3px 9px', background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', borderRadius: 99 }}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={() => toggleActive.mutate(u._id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`, background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isActive ? '#f87171' : '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries(['all-users'])}
        />
      )}
    </div>
  );
}
