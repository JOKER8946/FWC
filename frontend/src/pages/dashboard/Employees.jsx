import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, deactivateEmployee, getDepartments } from '../../api/employees';
import './Employees.css';

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = {
    active:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    resigned:   { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    terminated: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
    'on-leave': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  };
  const s = colors[status] || colors.active;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: '3px 10px', borderRadius: 99, textTransform: 'capitalize', letterSpacing: '0.03em' }}>
      {status}
    </span>
  );
};

// ── Avatar initials ───────────────────────────────────────────────────────────
const Avatar = ({ firstName, lastName, size = 36 }) => {
  const initials = `${firstName?.[0]||''}${lastName?.[0]||''}`.toUpperCase();
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6'];
  const color = colors[(firstName?.charCodeAt(0)||0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
};

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  firstName:'', lastName:'', email:'', phone:'', department:'',
  designation:'', salary:'', dateOfJoining:'', employmentType:'full-time',
  role:'employee', password:'',
};

function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(isEdit ? {
    firstName: employee.firstName, lastName: employee.lastName,
    phone: employee.phone||'', department: employee.department,
    designation: employee.designation, salary: employee.salary,
    dateOfJoining: employee.dateOfJoining?.slice(0,10),
    employmentType: employee.employmentType, role:'employee', password:'',
  } : EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isEdit) await updateEmployee(employee._id, form);
      else await createEmployee(form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-field">
              <label>First Name *</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} required placeholder="e.g. Ravi" />
            </div>
            <div className="form-field">
              <label>Last Name *</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} required placeholder="e.g. Kumar" />
            </div>
          </div>

          {!isEdit && (
            <div className="form-row">
              <div className="form-field">
                <label>Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="ravi@fwchrms.com" />
              </div>
              <div className="form-field">
                <label>Temp Password</label>
                <input name="password" value={form.password} onChange={handleChange} placeholder="Auto-generated if blank" />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
            </div>
            <div className="form-field">
              <label>Department *</label>
              <input name="department" value={form.department} onChange={handleChange} required placeholder="e.g. engineering" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Designation *</label>
              <input name="designation" value={form.designation} onChange={handleChange} required placeholder="e.g. Software Engineer" />
            </div>
            <div className="form-field">
              <label>Salary (₹) *</label>
              <input name="salary" type="number" value={form.salary} onChange={handleChange} required placeholder="800000" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Date of Joining *</label>
              <input name="dateOfJoining" type="date" value={form.dateOfJoining} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>Employment Type</label>
              <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
          </div>

          {!isEdit && (
            <div className="form-row">
              <div className="form-field">
                <label>Role</label>
                <select name="role" value={form.role} onChange={handleChange}>
                  <option value="employee">Employee</option>
                  <option value="hr_recruiter">HR Recruiter</option>
                  <option value="senior_manager">Senior Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          )}

          {error && <div className="modal-error">⚠ {error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm deactivate dialog ─────────────────────────────────────────────────
function ConfirmDialog({ employee, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Deactivate Employee</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: '#9090b0', fontSize: 14, padding: '16px 0' }}>
          Are you sure you want to deactivate <strong style={{ color: '#e0e0f0' }}>
          {employee.firstName} {employee.lastName}</strong>?
          Their account will be disabled immediately.
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Deactivate</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Employees Page ───────────────────────────────────────────────────────
export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [deptFilter, setDeptFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage]               = useState(1);
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', { search, deptFilter, statusFilter, page }],
    queryFn: () => getEmployees({
      search: search || undefined,
      department: deptFilter || undefined,
      status: statusFilter || undefined,
      page, limit: 15,
    }).then(r => r.data),
    keepPreviousData: true,
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDepartments().then(r => r.data.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateEmployee(id),
    onSuccess: () => { qc.invalidateQueries(['employees']); setDeactivateTarget(null); },
  });

  const handleSaved = () => {
    qc.invalidateQueries(['employees']);
    setShowModal(false);
    setEditTarget(null);
  };

  const employees = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="emp-page page-fade-in">
      {/* Header */}
      <div className="emp-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">
            {pagination.total ?? '—'} total members across all departments
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
          + Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="emp-filters">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search by name, email, designation..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select className="filter-select" value={deptFilter}
          onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
          <option value="">All Departments</option>
          {(deptData||[]).map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className="filter-select" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on-leave">On Leave</option>
          <option value="resigned">Resigned</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      <div className="emp-table-wrap">
        {isLoading ? (
          <div className="emp-loading">Loading employees...</div>
        ) : isError ? (
          <div className="emp-error">Failed to load employees.</div>
        ) : employees.length === 0 ? (
          <div className="emp-empty">
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p>No employees found. Add your first employee!</p>
          </div>
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Joined</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp._id}>
                  <td>
                    <div className="emp-identity">
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} />
                      <div>
                        <div className="emp-name">{emp.firstName} {emp.lastName}</div>
                        <div className="emp-email">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="dept-chip">{emp.department}</span>
                  </td>
                  <td className="emp-designation">{emp.designation}</td>
                  <td className="emp-date">
                    {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                  </td>
                  <td>
                    <span className="type-chip">{emp.employmentType}</span>
                  </td>
                  <td><StatusBadge status={emp.status} /></td>
                  <td>
                    <div className="action-btns">
                      <button className="action-btn edit-btn"
                        onClick={() => { setEditTarget(emp); setShowModal(true); }}
                        title="Edit">✏️</button>
                      <button className="action-btn del-btn"
                        onClick={() => setDeactivateTarget(emp)}
                        title="Deactivate"
                        disabled={emp.status === 'terminated'}>🚫</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="emp-pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}>← Prev</button>
          <span className="page-info">Page {pagination.page} of {pagination.totalPages}</span>
          <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p+1)}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <EmployeeModal
          employee={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
      {deactivateTarget && (
        <ConfirmDialog
          employee={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMutation.mutate(deactivateTarget._id)}
        />
      )}
    </div>
  );
}
