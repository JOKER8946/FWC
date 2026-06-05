import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLOR = {
  draft:        '#f59e0b',
  submitted:    '#6366f1',
  acknowledged: '#10b981',
};

const METRICS_LABELS = [
  ['taskCompletionRate', 'Task Completion'],
  ['attendanceScore',    'Attendance'],
  ['qualityScore',       'Quality'],
  ['teamworkScore',      'Teamwork'],
  ['communicationScore', 'Communication'],
];

const scoreColor = (v) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';

// ── Score bar row ─────────────────────────────────────────────────────────────
function MetricBar({ label, value }) {
  const c = scoreColor(value);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#7070a0', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: c, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: '100%', background: c, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────────
function MyPerformance() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-performance'],
    queryFn: () => API.get('/performance/my').then(r => r.data),
  });

  const acknowledge = useMutation({
    mutationFn: (id) => API.patch(`/performance/${id}/acknowledge`),
    onSuccess: () => qc.invalidateQueries(['my-performance']),
  });

  const reviews = data?.data || [];

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#44445a' }}>Loading reviews…</div>;

  return (
    <div className="page-fade-in">
      <h1 className="page-title">My Performance</h1>
      <p className="page-subtitle">Review history and AI-generated summaries</p>

      {reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
          <p>No performance reviews yet. Your manager will create one after your first review cycle.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          {reviews.map(r => {
            const sc = STATUS_COLOR[r.status] || '#7070a0';
            return (
              <div key={r._id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#fff', fontSize: 15 }}>{r.reviewPeriod}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sc, padding: '2px 8px', background: `${sc}18`, borderRadius: 99, textTransform: 'capitalize', marginTop: 4, display: 'inline-block' }}>{r.status}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: scoreColor(r.metrics?.overallScore || 0), fontFamily: 'Syne, sans-serif' }}>
                      {r.metrics?.overallScore ?? '—'}<span style={{ fontSize: 12, color: '#555570' }}>/100</span>
                    </span>
                    {r.reviewedBy && (
                      <div style={{ fontSize: 11, color: '#44445a', marginTop: 2 }}>
                        by {r.reviewedBy.firstName} {r.reviewedBy.lastName}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 14 }}>
                  {METRICS_LABELS.map(([key, label]) => (
                    <MetricBar key={key} label={label} value={r.metrics?.[key] ?? 0} />
                  ))}
                </div>

                {r.aiSummary && (
                  <div style={{ fontSize: 12.5, color: '#9090b0', lineHeight: 1.6, padding: '10px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, borderLeft: '2px solid rgba(99,102,241,0.4)', marginBottom: r.aiRecommendations?.length > 0 ? 10 : 0 }}>
                    🧠 {r.aiSummary}
                  </div>
                )}

                {r.aiRecommendations?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {r.aiRecommendations.map((rec, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#7070a0', display: 'flex', gap: 8 }}>
                        <span style={{ color: '#6366f1' }}>→</span>{rec}
                      </div>
                    ))}
                  </div>
                )}

                {r.status === 'submitted' && (
                  <button
                    onClick={() => acknowledge.mutate(r._id)}
                    disabled={acknowledge.isPending}
                    style={{ marginTop: 14, padding: '7px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10b981', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    ✓ Acknowledge Review
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Create Review Modal ───────────────────────────────────────────────────────
function CreateReviewModal({ employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    employeeId: '', reviewPeriod: '',
    taskCompletionRate: 80, attendanceScore: 80, qualityScore: 80,
    teamworkScore: 80, communicationScore: 80, overallScore: 80,
    managerNotes: '',
  });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.employeeId || !form.reviewPeriod) return setError('Employee and review period are required.');
    setSaving(true); setError('');
    try {
      await API.post('/performance', {
        employeeId: form.employeeId,
        reviewPeriod: form.reviewPeriod,
        metrics: {
          taskCompletionRate: Number(form.taskCompletionRate),
          attendanceScore:    Number(form.attendanceScore),
          qualityScore:       Number(form.qualityScore),
          teamworkScore:      Number(form.teamworkScore),
          communicationScore: Number(form.communicationScore),
          overallScore:       Number(form.overallScore),
        },
        managerNotes: form.managerNotes || null,
      });
      onCreated(); onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create review.');
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#e0e0f0', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' };
  const lbl = (t) => <div style={{ fontSize: 10.5, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t}</div>;
  const slider = (key, label) => (
    <div key={key}>
      {lbl(`${label}: ${form[key]}`)}
      <input type="range" min="0" max="100" value={form[key]} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', accentColor: scoreColor(Number(form[key])) }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Create Performance Review</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Employee')}
            <select value={form.employeeId} onChange={e => set('employeeId', e.target.value)} style={inp}>
              <option value="">— Select employee —</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName} · {e.designation}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Review Period (e.g. Q2-2026)')}
            <input value={form.reviewPeriod} onChange={e => set('reviewPeriod', e.target.value)} placeholder="Q2-2026" style={inp} />
          </div>
          {METRICS_LABELS.map(([key, label]) => slider(key, label))}
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Overall Score')}
            <input type="range" min="0" max="100" value={form.overallScore} onChange={e => set('overallScore', e.target.value)}
              style={{ width: '100%', accentColor: scoreColor(Number(form.overallScore)) }} />
            <div style={{ fontSize: 12, color: scoreColor(Number(form.overallScore)), fontWeight: 700, textAlign: 'right' }}>{form.overallScore}/100</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            {lbl('Manager Notes')}
            <textarea value={form.managerNotes} onChange={e => set('managerNotes', e.target.value)}
              rows={3} placeholder="Observations, areas of improvement…"
              style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#7070a0', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Management view (admin / senior_manager) ──────────────────────────────────
function ManagePerformance() {
  const qc = useQueryClient();
  const [empFilter,    setEmpFilter]    = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate,   setShowCreate]   = useState(false);

  const { data: perfData, isLoading } = useQuery({
    queryKey: ['all-performance', empFilter, periodFilter, statusFilter],
    queryFn: () => {
      const params = {};
      if (empFilter)    params.employeeId   = empFilter;
      if (periodFilter) params.reviewPeriod = periodFilter;
      if (statusFilter) params.status       = statusFilter;
      return API.get('/performance', { params }).then(r => r.data);
    },
  });

  const { data: empData } = useQuery({
    queryKey: ['employees-for-perf'],
    queryFn: () => API.get('/employees', { params: { limit: 200 } }).then(r => r.data),
  });

  const reviews   = perfData?.data   || [];
  const employees = empData?.data    || [];
  const avgScore  = reviews.length ? Math.round(reviews.reduce((s, r) => s + (r.metrics?.overallScore || 0), 0) / reviews.length) : 0;

  const inp = { padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e0e0f0', fontSize: 12.5, fontFamily: 'DM Sans, sans-serif', outline: 'none' };

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Performance Reviews</h1>
      <p className="page-subtitle">Team performance across all review periods</p>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Reviews',     value: reviews.length,                                            sub: 'All periods' },
          { label: 'Avg Overall Score', value: reviews.length ? `${avgScore}/100` : '—',                 sub: 'Across team' },
          { label: 'Pending Ack.',      value: reviews.filter(r => r.status === 'submitted').length,     sub: 'Awaiting employee' },
          { label: 'Acknowledged',      value: reviews.filter(r => r.status === 'acknowledged').length,  sub: 'Completed' },
        ].map(({ label, value, sub }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={inp}>
          <option value="">All employees</option>
          {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <input value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} placeholder="Period (e.g. Q1-2026)" style={{ ...inp, width: 180 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inp}>
          <option value="">All statuses</option>
          {['draft','submitted','acknowledged'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(empFilter || periodFilter || statusFilter) && (
          <button onClick={() => { setEmpFilter(''); setPeriodFilter(''); setStatusFilter(''); }} style={{ ...inp, color: '#f87171', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)' }}>Clear</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Create Review
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#44445a' }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
          <p>No reviews found. Try adjusting filters or create a new review.</p>
        </div>
      ) : (
        <div className="table-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 540 }}>
          {reviews.map(r => {
            const sc = STATUS_COLOR[r.status] || '#7070a0';
            const emp = r.employeeId;
            return (
              <div key={r._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#e0e0f0' }}>{emp?.firstName} {emp?.lastName}</div>
                  <div style={{ fontSize: 11, color: '#555570', marginTop: 2, textTransform: 'capitalize' }}>{emp?.designation} · {emp?.department}</div>
                </div>
                <div style={{ fontSize: 13, color: '#9090b0' }}>{r.reviewPeriod}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor(r.metrics?.overallScore || 0) }}>
                  {r.metrics?.overallScore ?? '—'}<span style={{ fontSize: 11, color: '#555570' }}>/100</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sc, padding: '3px 9px', background: `${sc}18`, borderRadius: 99, textTransform: 'capitalize' }}>{r.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#44445a', lineHeight: 1.5 }}>
                  {r.managerNotes ? r.managerNotes.slice(0, 60) + (r.managerNotes.length > 60 ? '…' : '') : '—'}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {showCreate && (
        <CreateReviewModal
          employees={employees}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries(['all-performance'])}
        />
      )}
    </div>
  );
}

// ── Default export — role-aware ───────────────────────────────────────────────
export default function Performance() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'senior_manager';
  return isManager ? <ManagePerformance /> : <MyPerformance />;
}
