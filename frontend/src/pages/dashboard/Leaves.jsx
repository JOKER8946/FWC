import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../api/axios';

const LEAVE_ALLOWANCE = { casual: 12, sick: 10, earned: 15 };
const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', cancelled: '#6b6b8a' };
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'compensatory', 'unpaid'];

export default function Leaves() {
  const qc = useQueryClient();
  const [form, setForm]         = useState({ leaveType: 'casual', fromDate: '', toDate: '', reason: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => API.get('/leaves').then(r => r.data),
  });

  const applyLeave = useMutation({
    mutationFn: (body) => API.post('/leaves', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['my-leaves']);
      setForm({ leaveType: 'casual', fromDate: '', toDate: '', reason: '' });
      setShowForm(false);
      setError('');
    },
    onError: (e) => setError(e.response?.data?.message || 'Failed to submit leave request.'),
  });

  const leaves = data?.data || [];

  // Compute used days from approved leaves this calendar year
  const thisYear = new Date().getFullYear();
  const usedByType = {};
  leaves.forEach(l => {
    if (l.status === 'approved' && new Date(l.fromDate).getFullYear() === thisYear) {
      usedByType[l.leaveType] = (usedByType[l.leaveType] || 0) + (l.totalDays || 1);
    }
  });

  const handleApply = () => {
    if (!form.fromDate || !form.toDate) return setError('Please select both from and to dates.');
    if (new Date(form.toDate) < new Date(form.fromDate)) return setError('To date cannot be before from date.');
    setError('');
    applyLeave.mutate(form);
  };

  const inp = { width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#e0e0f0', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' };
  const lbl = (t) => <div style={{ fontSize: 10.5, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t}</div>;

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Leave Management</h1>
      <p className="page-subtitle">Your leave balance and request history</p>

      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        {Object.entries(LEAVE_ALLOWANCE).map(([type, total]) => {
          const used      = usedByType[type] || 0;
          const remaining = total - used;
          return (
            <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10.5, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{type}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: remaining > 0 ? '#10b981' : '#f87171', fontFamily: 'Syne, sans-serif' }}>{remaining}</div>
              <div style={{ fontSize: 11, color: '#44445a', marginTop: 2 }}>{used} used / {total} total</div>
            </div>
          );
        })}
      </div>

      {/* Section header */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <span className="section-title">Leave History</span>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{ padding: '7px 14px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          {showForm ? 'Cancel' : '+ Apply for Leave'}
        </button>
      </div>

      {/* Apply form */}
      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              {lbl('Leave Type')}
              <select value={form.leaveType} onChange={e => set('leaveType', e.target.value)} style={inp}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              {lbl('From Date')}
              <input type="date" value={form.fromDate} onChange={e => set('fromDate', e.target.value)} style={inp} />
            </div>
            <div>
              {lbl('To Date')}
              <input type="date" value={form.toDate} onChange={e => set('toDate', e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              {lbl('Reason (optional)')}
              <input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Brief reason for leave…" style={inp} />
            </div>
          </div>
          {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#f87171' }}>{error}</div>}
          <button
            onClick={handleApply}
            disabled={applyLeave.isPending}
            style={{ marginTop: 14, padding: '8px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: applyLeave.isPending ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: applyLeave.isPending ? 0.7 : 1 }}
          >
            {applyLeave.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {/* History */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#44445a' }}>Loading leave history…</div>
      ) : leaves.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#44445a' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏖️</div>
          <p>No leave requests yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaves.map(l => {
            const sc = STATUS_COLOR[l.status] || '#7070a0';
            return (
              <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#e0e0f0', textTransform: 'capitalize' }}>
                    {l.leaveType} Leave · {l.totalDays} day{l.totalDays !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#555570', marginTop: 3 }}>
                    {l.fromDate?.slice(0, 10)} → {l.toDate?.slice(0, 10)}
                  </div>
                  {l.reason && <div style={{ fontSize: 11, color: '#44445a', marginTop: 2 }}>{l.reason}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: sc, padding: '3px 10px', background: `${sc}18`, borderRadius: 99, textTransform: 'capitalize', flexShrink: 0 }}>
                  {l.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
