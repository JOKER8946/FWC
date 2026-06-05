import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../api/axios';

const STATUS_COLOR = {
  paid:      '#10b981',
  processed: '#6366f1',
  pending:   '#f59e0b',
  'on-hold': '#ef4444',
};

const NEXT_STATUS = { pending: 'processed', processed: 'paid', 'on-hold': 'pending' };
const NEXT_LABEL  = { pending: '→ Process', processed: '→ Mark Paid', 'on-hold': '→ Reopen' };

// ── Add Payslip Modal ─────────────────────────────────────────────────────────
function AddPayslipModal({ employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    employeeId: '', month: '',
    basicSalary: '', hra: '', transport: '2000',
    internet: '1000', medical: '1250', pf: '', tax: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const basic = Number(form.basicSalary) || 0;
  const hra   = Number(form.hra)  || Math.round(basic * 0.4);
  const tran  = Number(form.transport) || 2000;
  const inet  = Number(form.internet)  || 1000;
  const med   = Number(form.medical)   || 1250;
  const pf    = Number(form.pf)  || Math.round(basic * 0.12);
  const tax   = Number(form.tax) || Math.round(basic * 0.08);
  const gross = basic + hra + tran + inet + med;
  const net   = gross - pf - tax;

  const submit = async () => {
    if (!form.employeeId || !form.month || !form.basicSalary)
      return setError('Employee, month, and basic salary are required.');
    setSaving(true); setError('');
    try {
      await API.post('/payroll', {
        employeeId: form.employeeId, month: form.month,
        basicSalary: basic,
        allowances: { hra, transport: tran, internet: inet, medical: med, other: 0 },
        deductions:  { pf, tax, loanRepayment: 0, other: 0 },
        netPay: net, status: 'pending',
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create payslip.');
      setSaving(false);
    }
  };

  const input = {
    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, color: '#e0e0f0', fontSize: 13,
    fontFamily: 'DM Sans, sans-serif', outline: 'none',
  };
  const lbl = (t) => (
    <div style={{ fontSize: 10.5, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 'min(500px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Add Payslip</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Employee')}
            <select value={form.employeeId} onChange={e => set('employeeId', e.target.value)} style={input}>
              <option value="">— Select employee —</option>
              {employees.map(e => (
                <option key={e._id} value={e._id}>{e.firstName} {e.lastName} · {e.designation}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Month (e.g. Jun-2026)')}
            <input value={form.month} onChange={e => set('month', e.target.value)} placeholder="Jun-2026" style={input} />
          </div>
          <div>
            {lbl('Basic Salary (₹)')}
            <input type="number" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} placeholder="75000" style={input} />
          </div>
          <div>
            {lbl('HRA (auto: 40% of basic)')}
            <input type="number" value={form.hra} onChange={e => set('hra', e.target.value)} placeholder={basic ? Math.round(basic * 0.4) : '30000'} style={input} />
          </div>
          <div>
            {lbl('Transport Allowance (₹)')}
            <input type="number" value={form.transport} onChange={e => set('transport', e.target.value)} style={input} />
          </div>
          <div>
            {lbl('Internet Allowance (₹)')}
            <input type="number" value={form.internet} onChange={e => set('internet', e.target.value)} style={input} />
          </div>
          <div>
            {lbl('Medical Allowance (₹)')}
            <input type="number" value={form.medical} onChange={e => set('medical', e.target.value)} style={input} />
          </div>
          <div>
            {lbl('PF Deduction (auto: 12%)')}
            <input type="number" value={form.pf} onChange={e => set('pf', e.target.value)} placeholder={basic ? Math.round(basic * 0.12) : '9000'} style={input} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Tax / TDS (auto: 8%)')}
            <input type="number" value={form.tax} onChange={e => set('tax', e.target.value)} placeholder={basic ? Math.round(basic * 0.08) : '6000'} style={input} />
          </div>
        </div>

        {basic > 0 && (
          <div style={{ marginTop: 16, padding: 14, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#9090b0', marginBottom: 5 }}>
              <span>Gross Pay</span><span>₹{gross.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#f87171', marginBottom: 5 }}>
              <span>Total Deductions</span><span>₹{(pf + tax).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#10b981' }}>
              <span>Net Pay</span><span>₹{net.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#7070a0', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Payslip'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HRPayroll() {
  const qc = useQueryClient();
  const [monthFilter,  setMonthFilter]  = useState('');
  const [empFilter,    setEmpFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd,      setShowAdd]      = useState(false);

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['hr-payroll', monthFilter, empFilter, statusFilter],
    queryFn: () => {
      const params = {};
      if (monthFilter)  params.month      = monthFilter;
      if (empFilter)    params.employeeId = empFilter;
      if (statusFilter) params.status     = statusFilter;
      return API.get('/payroll', { params }).then(r => r.data);
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ['all-employees-for-payroll'],
    queryFn: () => API.get('/employees', { params: { limit: 200 } }).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => API.patch(`/payroll/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries(['hr-payroll']),
  });

  const payslips  = payrollData?.data  || [];
  const employees = employeesData?.data || [];

  const totalNet     = payslips.reduce((s, p) => s + (p.netPay || 0), 0);
  const pendingCount = payslips.filter(p => p.status === 'pending').length;
  const paidCount    = payslips.filter(p => p.status === 'paid').length;
  const uniqueEmps   = new Set(payslips.map(p => String(p.employeeId?._id || p.employeeId))).size;

  const inputSt = {
    padding: '7px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    color: '#e0e0f0', fontSize: 12.5, fontFamily: 'DM Sans, sans-serif', outline: 'none',
  };

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Payroll Management</h1>
      <p className="page-subtitle">Process and manage employee payslips</p>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Net Pay',  value: `₹${totalNet.toLocaleString('en-IN')}`, sub: `${payslips.length} payslip${payslips.length !== 1 ? 's' : ''}` },
          { label: 'Pending',        value: pendingCount,  sub: 'Awaiting processing' },
          { label: 'Paid',           value: paidCount,     sub: 'Disbursed' },
          { label: 'Employees',      value: uniqueEmps,    sub: 'In current view' },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          placeholder="Month (e.g. May-2026)"
          style={{ ...inputSt, width: 180 }}
        />
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={inputSt}>
          <option value="">All employees</option>
          {employees.map(e => (
            <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputSt}>
          <option value="">All statuses</option>
          {['pending','processed','paid','on-hold'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(monthFilter || empFilter || statusFilter) && (
          <button
            onClick={() => { setMonthFilter(''); setEmpFilter(''); setStatusFilter(''); }}
            style={{ ...inputSt, color: '#f87171', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            Clear
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          + Add Payslip
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#44445a' }}>Loading payroll data…</div>
      ) : payslips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
          <p>No payslips found. Try adjusting the filters or add a new one.</p>
        </div>
      ) : (
        <div className="table-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 560 }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 148px', gap: 12, padding: '4px 18px' }}>
            {['Employee', 'Month', 'Basic', 'Net Pay', 'Status', ''].map(h => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
            ))}
          </div>

          {payslips.map(p => {
            const emp = p.employeeId;
            const sc  = STATUS_COLOR[p.status] || '#7070a0';
            return (
              <div key={p._id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 148px',
                gap: 12, alignItems: 'center', padding: '12px 18px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#e0e0f0' }}>
                    {emp?.firstName} {emp?.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: '#555570', marginTop: 2, textTransform: 'capitalize' }}>
                    {emp?.designation || '—'} · {emp?.department || '—'}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#9090b0' }}>{p.month}</div>
                <div style={{ fontSize: 12.5, color: '#7070a0' }}>
                  ₹{p.basicSalary?.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                  ₹{p.netPay?.toLocaleString('en-IN')}
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sc, padding: '3px 9px', background: `${sc}18`, borderRadius: 99, textTransform: 'capitalize' }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.status !== 'paid' && NEXT_STATUS[p.status] && (
                    <button
                      onClick={() => updateStatus.mutate({ id: p._id, status: NEXT_STATUS[p.status] })}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                    >
                      {NEXT_LABEL[p.status]}
                    </button>
                  )}
                  {p.status === 'pending' && (
                    <button
                      onClick={() => updateStatus.mutate({ id: p._id, status: 'on-hold' })}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Hold
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {showAdd && (
        <AddPayslipModal
          employees={employees}
          onClose={() => setShowAdd(false)}
          onCreated={() => qc.invalidateQueries(['hr-payroll'])}
        />
      )}
    </div>
  );
}
