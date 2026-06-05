import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllRisks, runAnalysis, resolveRisk, retrainModel } from '../../api/flightRisk';
import './FlightRisk.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: '🔴 Critical', order: 4 },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: '🟠 High',     order: 3 },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '🟡 Medium',   order: 2 },
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '🟢 Low',      order: 1 },
};

const RiskBadge = ({ level }) => {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.low;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11,
      fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
      {cfg.label}
    </span>
  );
};

const ScoreBar = ({ score }) => {
  const color =
    score >= 86 ? '#ef4444' :
    score >= 61 ? '#f97316' :
    score >= 31 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3,
          transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28 }}>{score}</span>
    </div>
  );
};

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

// ── Signal breakdown bar ──────────────────────────────────────────────────────
const SignalRow = ({ label, value, max, unit = '%', inverted = false }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const danger = inverted ? pct < 40 : pct > 60;
  const color = danger ? '#ef4444' : pct > 30 ? '#f59e0b' : '#10b981';
  return (
    <div className="signal-row">
      <span className="signal-label">{label}</span>
      <div className="signal-bar-wrap">
        <div className="signal-bar-track">
          <div className="signal-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="signal-value" style={{ color }}>
          {value}{unit}
        </span>
      </div>
    </div>
  );
};

// ── Summary stats ─────────────────────────────────────────────────────────────
const SummaryCards = ({ risks }) => {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  risks.forEach(r => { if (counts[r.riskLevel] !== undefined) counts[r.riskLevel]++; });
  return (
    <div className="summary-cards">
      {Object.entries(LEVEL_CONFIG).reverse().map(([level, cfg]) => (
        <div key={level} className="summary-card" style={{ borderColor: `${cfg.color}30` }}>
          <div className="summary-count" style={{ color: cfg.color }}>{counts[level]}</div>
          <div className="summary-label">{cfg.label}</div>
        </div>
      ))}
    </div>
  );
};

// ── Resolve modal ─────────────────────────────────────────────────────────────
function ResolveModal({ risk, onClose, onResolved }) {
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const handleResolve = async () => {
    setLoading(true);
    try {
      await resolveRisk(risk._id, { actionTaken: action });
      onResolved();
    } finally { setLoading(false); }
  };
  const emp = risk.employeeId;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Mark as Resolved</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: '#9090b0', fontSize: 13, marginBottom: 16 }}>
          Document the retention action taken for <strong style={{ color: '#e0e0f0' }}>
          {emp?.firstName} {emp?.lastName}</strong>:
        </p>
        <textarea
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="e.g. Scheduled 1-on-1 and initiated salary review. Employee confirmed interest in staying."
          rows={4}
          style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e0e0f0',
            fontSize: 13, fontFamily: 'DM Sans, sans-serif', resize: 'vertical', outline: 'none' }}
        />
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-success" onClick={handleResolve} disabled={loading || !action.trim()}>
            {loading ? 'Saving...' : '✓ Mark Resolved'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Employee detail panel ─────────────────────────────────────────────────────
function DetailPanel({ risk, onClose, onResolve }) {
  if (!risk) return (
    <div className="detail-empty">
      <div style={{ fontSize: 40, opacity: 0.3 }}>⚠️</div>
      <p>Select an employee to view their risk analysis</p>
    </div>
  );

  const emp = risk.employeeId;
  const s   = risk.signals || {};
  const cfg = LEVEL_CONFIG[risk.riskLevel] || LEVEL_CONFIG.low;

  return (
    <div className="detail-panel">
      {/* Employee header */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar firstName={emp?.firstName} lastName={emp?.lastName} size={44} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0f0' }}>
              {emp?.firstName} {emp?.lastName}
            </div>
            <div style={{ fontSize: 12, color: '#555570', marginTop: 2 }}>
              {emp?.designation} · {emp?.department}
            </div>
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      {/* Risk score ring */}
      <div className="risk-score-display" style={{ borderColor: `${cfg.color}30` }}>
        <div className="risk-score-number" style={{ color: cfg.color }}>{risk.riskScore}</div>
        <div className="risk-score-label">Risk Score</div>
        <RiskBadge level={risk.riskLevel} />
        <div style={{ fontSize: 11, color: '#44445a', marginTop: 6 }}>
          Analysed: {new Date(risk.calculatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* AI Insight */}
      <div className="insight-box">
        <div className="insight-label">🧠 Neural Network Insight</div>
        <p className="insight-text">{risk.aiInsight}</p>
      </div>

      {/* Signal breakdown */}
      <div className="signals-section">
        <div className="signals-title">Risk Signal Breakdown</div>
        <SignalRow label="Attendance Drop"   value={s.attendanceDropPercent || 0}  max={100} unit="%" />
        <SignalRow label="Days Since Hike"   value={s.daysSinceLastHike || 0}       max={730} unit="d" />
        <SignalRow label="Days Since Promo"  value={s.daysSinceLastPromotion || 0}  max={730} unit="d" />
        <SignalRow label="Absences (30d)"    value={s.recentAbsenceCount || 0}      max={10}  unit="" />
        <div className="signal-row">
          <span className="signal-label">Perf. Trend</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: s.performanceTrend === 'declining' ? 'rgba(239,68,68,0.12)' : s.performanceTrend === 'improving' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
            color: s.performanceTrend === 'declining' ? '#ef4444' : s.performanceTrend === 'improving' ? '#10b981' : '#9090b0',
          }}>{s.performanceTrend || 'unknown'}</span>
        </div>
        <div className="signal-row">
          <span className="signal-label">Leave Spike</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: s.leaveFrequencyIncreased ? '#ef4444' : '#10b981' }}>
            {s.leaveFrequencyIncreased ? '⚠ Yes' : '✓ No'}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!risk.isResolved ? (
        <button className="btn-resolve" onClick={() => onResolve(risk)}>
          ✓ Mark Action Taken & Resolve
        </button>
      ) : (
        <div className="resolved-box">
          <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            ✓ Resolved
          </div>
          {risk.actionTaken && (
            <p style={{ fontSize: 12, color: '#9090b0', lineHeight: 1.5 }}>{risk.actionTaken}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FlightRiskPage() {
  const qc = useQueryClient();
  const [selected, setSelected]     = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [resolveTarget, setResolveTarget] = useState(null);
  const [running, setRunning]       = useState(false);
  const [runMsg, setRunMsg]         = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['flight-risks', filterLevel],
    queryFn: () => getAllRisks({ riskLevel: filterLevel || undefined, resolved: false }).then(r => r.data),
  });

  const handleRunAnalysis = async () => {
    setRunning(true); setRunMsg('');
    try {
      const res = await runAnalysis();
      setRunMsg(`✓ ${res.data.message}`);
      qc.invalidateQueries(['flight-risks']);
      setSelected(null);
    } catch (err) {
      setRunMsg(`⚠ ${err.response?.data?.message || 'Analysis failed.'}`);
    } finally { setRunning(false); }
  };

  const risks = data?.data || [];

  // Update selected panel when data refreshes
  const selectedRisk = selected
    ? risks.find(r => r._id === selected._id) || selected
    : null;

  return (
    <div className="fr-root page-fade-in">
      {/* Left panel */}
      <div className="fr-left">
        <div className="fr-topbar">
          <div>
            <h1 className="page-title">Flight Risk Predictor</h1>
            <p className="page-subtitle">Feedforward Neural Network · 8 signals · 6000 iterations</p>
          </div>
          <button className="btn-run" onClick={handleRunAnalysis} disabled={running}>
            {running ? (
              <><span className="btn-spinner" /> Analysing...</>
            ) : '▶ Run Analysis'}
          </button>
        </div>

        {runMsg && (
          <div className={`run-msg ${runMsg.startsWith('✓') ? 'success' : 'error'}`}>
            {runMsg}
          </div>
        )}

        {/* Summary */}
        {risks.length > 0 && <SummaryCards risks={risks} />}

        {/* Filter */}
        <div className="fr-filters">
          {['', 'critical', 'high', 'medium', 'low'].map(level => (
            <button key={level}
              className={`filter-chip ${filterLevel === level ? 'active' : ''}`}
              onClick={() => setFilterLevel(level)}>
              {level === '' ? 'All' : LEVEL_CONFIG[level]?.label}
            </button>
          ))}
        </div>

        {/* Employee grid */}
        {isLoading ? (
          <div className="fr-loading">Running neural network inference...</div>
        ) : isError ? (
          <div className="fr-error">Failed to load risk data.</div>
        ) : risks.length === 0 ? (
          <div className="fr-empty">
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
            <p>No risk records yet.</p>
            <p style={{ fontSize: 12, marginTop: 4, color: '#44445a' }}>
              Click "Run Analysis" to score all active employees.
            </p>
          </div>
        ) : (
          <div className="fr-grid">
            {risks.map(risk => {
              const emp = risk.employeeId;
              const cfg = LEVEL_CONFIG[risk.riskLevel] || LEVEL_CONFIG.low;
              return (
                <div key={risk._id}
                  className={`fr-card ${selected?._id === risk._id ? 'selected' : ''}`}
                  style={{ '--risk-color': cfg.color }}
                  onClick={() => setSelected(risk)}>
                  <div className="fr-card-left">
                    <Avatar firstName={emp?.firstName} lastName={emp?.lastName} size={38} />
                    <div>
                      <div className="fr-name">{emp?.firstName} {emp?.lastName}</div>
                      <div className="fr-dept">{emp?.department} · {emp?.designation}</div>
                    </div>
                  </div>
                  <div className="fr-card-right">
                    <RiskBadge level={risk.riskLevel} />
                    <div style={{ marginTop: 8 }}>
                      <ScoreBar score={risk.riskScore} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right detail panel */}
      <div className="fr-right">
        <DetailPanel
          risk={selectedRisk}
          onClose={() => setSelected(null)}
          onResolve={setResolveTarget}
        />
      </div>

      {resolveTarget && (
        <ResolveModal
          risk={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={() => {
            setResolveTarget(null);
            qc.invalidateQueries(['flight-risks']);
          }}
        />
      )}
    </div>
  );
}
