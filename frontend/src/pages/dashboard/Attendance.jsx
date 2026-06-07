import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';
import AttendanceCalendar from '../../components/AttendanceCalendar';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
const fmtHours = (h) => h ? `${h}h` : '—';

const STATUS_COLOR = {
  present:    '#10b981',
  late:       '#f59e0b',
  absent:     '#ef4444',
  wfh:        '#6366f1',
  'half-day': '#a78bfa',
  holiday:    '#555570',
};

const badge = (status) => ({
  display: 'inline-block',
  background: `${STATUS_COLOR[status] || '#555570'}18`,
  color: STATUS_COLOR[status] || '#555570',
  borderRadius: 20, padding: '3px 10px',
  fontSize: 11, fontWeight: 700,
  textTransform: 'capitalize',
});

// ── Check-in / Check-out card ─────────────────────────────────────────────────
function CheckInCard({ onRefresh }) {
  const [record,   setRecord]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    try {
      const res = await API.get('/attendance/today');
      setRecord(res.data.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action) => {
    setActing(true); setMsg('');
    try {
      const res = await API.post(`/attendance/${action}`);
      setMsg(res.data.message);
      setRecord(res.data.data);
      if (onRefresh) onRefresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Something went wrong.');
    } finally { setActing(false); }
  };

  if (loading) return (
    <div className="stat-card" style={{ minHeight: 110 }}>
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-line medium" style={{ marginTop: 14, height: 28 }} />
      <div className="skeleton skeleton-line short" style={{ marginTop: 10 }} />
    </div>
  );

  const checkedIn  = !!record?.checkIn;
  const checkedOut = !!record?.checkOut;
  const now = new Date();
  const hour = now.getHours(), min = now.getMinutes();
  const willBeLate = hour > 9 || (hour === 9 && min > 30);

  return (
    <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        Today · {fmtDate(new Date())}
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#44445a', marginBottom: 4 }}>Status</div>
          <span style={badge(record?.status || 'absent')}>
            {record?.status || 'Absent'}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#44445a', marginBottom: 4 }}>Check-in</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: checkedIn ? '#10b981' : '#44445a' }}>
            {fmtTime(record?.checkIn)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#44445a', marginBottom: 4 }}>Check-out</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: checkedOut ? '#a5b4fc' : '#44445a' }}>
            {fmtTime(record?.checkOut)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#44445a', marginBottom: 4 }}>Hours Worked</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            {fmtHours(record?.hoursWorked)}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!checkedIn && (
          <button
            onClick={() => doAction('check-in')}
            disabled={acting}
            style={{ background: acting ? 'rgba(16,185,129,0.3)' : '#10b981', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {acting ? 'Processing…' : '🟢 Check In'}
          </button>
        )}
        {checkedIn && !checkedOut && (
          <button
            onClick={() => doAction('check-out')}
            disabled={acting}
            style={{ background: acting ? 'rgba(239,68,68,0.3)' : '#ef4444', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {acting ? 'Processing…' : '🔴 Check Out'}
          </button>
        )}
        {checkedOut && (
          <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
            ✓ Attendance recorded for today
          </div>
        )}
        {!checkedIn && willBeLate && (
          <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ After 09:30 — will be marked Late</span>
        )}
      </div>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#7070a0' }}>{msg}</div>
      )}
    </div>
  );
}

// ── Calendar moved to <AttendanceCalendar /> in components/AttendanceCalendar.jsx
// (full month grid with prev/next, year jump, holiday + event markers)

// ── Manager / Admin: team today panel ────────────────────────────────────────
function TeamTodayPanel() {
  const [data,        setData]       = useState(null);
  const [dateStr,     setDateStr]    = useState(new Date().toISOString().slice(0, 10));
  const [loading,     setLoading]    = useState(true);
  const [markModal,   setMarkModal]  = useState(null); // employee record to mark
  const [markForm,    setMarkForm]   = useState({ status: 'present', checkIn: '', checkOut: '' });
  const [saving,      setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/attendance/summary', { params: { date: dateStr } });
      setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);

  const handleMark = async () => {
    if (!markModal) return;
    setSaving(true);
    try {
      const body = {
        employeeId: markModal._id,
        date: dateStr,
        status: markForm.status,
        checkIn:  markForm.checkIn  ? `${dateStr}T${markForm.checkIn}` : null,
        checkOut: markForm.checkOut ? `${dateStr}T${markForm.checkOut}` : null,
      };
      await API.post('/attendance/mark', body);
      setMarkModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark attendance.');
    } finally { setSaving(false); }
  };

  const summary = data?.summary || {};
  const records = data?.records || [];
  const total   = data?.totalEmployees || 0;

  // Map existing records by employeeId for quick lookup
  const recordByEmp = {};
  records.forEach(r => {
    const eid = r.employeeId?._id || r.employeeId;
    if (eid) recordByEmp[eid] = r;
  });

  const inp = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#e2e8f0', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%' };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Team Attendance
        </div>
        <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
          style={{ ...inp, width: 'auto', fontSize: 12 }} />
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['Present', summary.present || 0, '#10b981'], ['Late', summary.late || 0, '#f59e0b'], ['Absent', summary.absent || 0, '#ef4444'], ['WFH', summary.wfh || 0, '#6366f1']].map(([l, v, c]) => (
          <div key={l} style={{ background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 72 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: c, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
          </div>
        ))}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 72 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7070a0' }}>{total}</div>
          <div style={{ fontSize: 10, color: '#44445a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
        </div>
      </div>

      {/* Records table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#44445a' }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#44445a' }}>No attendance records for this date.</div>
      ) : (
        <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <tr>
                {['Employee', 'Department', 'Status', 'Check-in', 'Check-out', 'Hours', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const emp = r.employeeId;
                return (
                  <tr key={r._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                      {emp?.firstName} {emp?.lastName}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#7070a0' }}>{emp?.department || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><span style={badge(r.status)}>{r.status}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#10b981', fontWeight: 600 }}>{fmtTime(r.checkIn)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#a5b4fc', fontWeight: 600 }}>{fmtTime(r.checkOut)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#e2e8f0' }}>{fmtHours(r.hoursWorked)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => { setMarkModal(emp); setMarkForm({ status: r.status, checkIn: r.checkIn ? fmtTime(r.checkIn) : '', checkOut: r.checkOut ? fmtTime(r.checkOut) : '' }); }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7070a0', padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                      >Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark attendance modal */}
      {markModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setMarkModal(null)}>
          <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                Mark Attendance · {markModal.firstName} {markModal.lastName}
              </div>
              <button onClick={() => setMarkModal(null)} style={{ background: 'none', border: 'none', color: '#7070a0', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Status</div>
                <select value={markForm.status} onChange={e => setMarkForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp }}>
                  {['present', 'absent', 'late', 'half-day', 'wfh', 'holiday'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Check-in Time</div>
                <input type="time" value={markForm.checkIn} onChange={e => setMarkForm(f => ({ ...f, checkIn: e.target.value }))} style={{ ...inp }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Check-out Time</div>
                <input type="time" value={markForm.checkOut} onChange={e => setMarkForm(f => ({ ...f, checkOut: e.target.value }))} style={{ ...inp }} />
              </div>
              <button onClick={handleMark} disabled={saving}
                style={{ background: saving ? 'rgba(99,102,241,0.3)' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: 10, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdminOrManager = role === 'admin' || role === 'senior_manager';

  const [records,  setRecords]  = useState([]);
  const [refresh,  setRefresh]  = useState(0);

  useEffect(() => {
    API.get('/attendance/my')
      .then(r => setRecords(r.data.data || []))
      .catch(() => {});
  }, [refresh]);

  return (
    <div className="page-fade-in">
      <h1 className="page-title">Attendance</h1>
      <p className="page-subtitle">
        {isAdminOrManager ? 'Track your attendance and monitor your team' : 'Track your daily attendance'}
      </p>

      {/* Check-in / Check-out card (all roles) */}
      <CheckInCard onRefresh={() => setRefresh(r => r + 1)} />

      {/* Personal calendar — full month grid with holiday + event markers */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        My Attendance Calendar
      </div>
      <AttendanceCalendar records={records} />

      {/* Team panel — managers and admins only */}
      {isAdminOrManager && <TeamTodayPanel />}
    </div>
  );
}
