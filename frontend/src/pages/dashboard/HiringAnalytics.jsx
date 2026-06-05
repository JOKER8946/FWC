import { useState, useEffect } from 'react';
import API from '../../api/axios';

// ── CSS bar chart primitives ──────────────────────────────────────────────────

function HBar({ label, value, max, color = '#6366f1', sublabel }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}{sublabel ? <span style={{ fontSize: 11, color: '#44445a', fontWeight: 400 }}> {sublabel}</span> : ''}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = '#a5b4fc', icon }) {
  return (
    <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 130 }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#44445a', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, marginTop: 28 }}>
      {children}
    </div>
  );
}

// ── Score histogram helper ────────────────────────────────────────────────────
const BUCKETS = [
  { label: '0–19',   min: 0,  max: 19 },
  { label: '20–39',  min: 20, max: 39 },
  { label: '40–59',  min: 40, max: 59 },
  { label: '60–79',  min: 60, max: 79 },
  { label: '80–100', min: 80, max: 100 },
];

function ScoreHistogram({ scores, color = '#6366f1' }) {
  const bucketCounts = BUCKETS.map(b => ({
    ...b,
    count: scores.filter(s => s >= b.min && s <= b.max).length,
  }));
  const maxCount = Math.max(...bucketCounts.map(b => b.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {bucketCounts.map(b => {
        const h = maxCount > 0 ? Math.round((b.count / maxCount) * 72) : 0;
        return (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#44445a', fontWeight: 700 }}>{b.count}</span>
            <div style={{ width: '100%', height: h || 3, background: b.count > 0 ? color : 'rgba(255,255,255,0.05)', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
            <span style={{ fontSize: 10, color: '#44445a' }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut-like verdict mini-bars ──────────────────────────────────────────────
function VerdictBreakdown({ verdicts }) {
  const counts = { advance: 0, hold: 0, reject: 0 };
  verdicts.forEach(v => { if (counts[v] !== undefined) counts[v]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const styles = {
    advance: { color: '#10b981', label: 'Advance' },
    hold:    { color: '#f59e0b', label: 'Hold'    },
    reject:  { color: '#ef4444', label: 'Reject'  },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(counts).map(([k, v]) => (
        <HBar
          key={k}
          label={styles[k].label}
          value={v}
          max={total || 1}
          color={styles[k].color}
          sublabel={total > 0 ? `(${Math.round((v / total) * 100)}%)` : ''}
        />
      ))}
      <div style={{ fontSize: 11, color: '#44445a', textAlign: 'right', marginTop: 2 }}>{total} total decisions</div>
    </div>
  );
}

// ── Per-job breakdown table ───────────────────────────────────────────────────
function JobBreakdownTable({ resumes, sessions }) {
  const sessionByResume = {};
  sessions.forEach(s => {
    const rid = s.resumeId?._id || s.resumeId;
    if (rid) sessionByResume[rid] = s;
  });

  const jobMap = {};
  resumes.forEach(r => {
    const jid = r.jobId?._id || r.jobId;
    const jt  = r.jobId?.title || 'Unknown';
    if (!jid) return;
    if (!jobMap[jid]) jobMap[jid] = { title: jt, total: 0, shortlisted: 0, interviewed: 0, advance: 0, scores: [] };
    const j = jobMap[jid];
    j.total++;
    if (r.blindScore != null) j.scores.push(r.blindScore);
    if (['shortlisted', 'interview_scheduled'].includes(r.status)) j.shortlisted++;
    const sess = sessionByResume[r._id];
    if (sess?.status === 'completed') {
      j.interviewed++;
      if (sess.aiAnalysis?.overallVerdict === 'advance') j.advance++;
    }
  });

  const rows = Object.values(jobMap).sort((a, b) => b.total - a.total);
  if (rows.length === 0) return <div style={{ fontSize: 13, color: '#44445a', padding: '12px 0' }}>No jobs with applications yet.</div>;

  const th = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' };
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <tr>
            <th style={th}>Job</th>
            <th style={th}>Applied</th>
            <th style={th}>Shortlisted</th>
            <th style={th}>Interviewed</th>
            <th style={th}>Advanced</th>
            <th style={th}>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((j, i) => {
            const avg = j.scores.length ? Math.round(j.scores.reduce((a, b) => a + b, 0) / j.scores.length) : null;
            return (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 600, color: '#e2e8f0' }}>{j.title}</td>
                <td style={{ ...td, color: '#7070a0' }}>{j.total}</td>
                <td style={{ ...td, color: '#10b981' }}>{j.shortlisted}</td>
                <td style={{ ...td, color: '#a5b4fc' }}>{j.interviewed}</td>
                <td style={{ ...td, color: '#10b981', fontWeight: 600 }}>{j.advance}</td>
                <td style={{ ...td }}>
                  {avg != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, maxWidth: 60, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${avg}%`, height: '100%', background: '#6366f1', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>{avg}</span>
                    </div>
                  ) : <span style={{ color: '#44445a' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function HiringFunnel({ steps }) {
  const max = steps[0]?.count || 1;
  const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#10b981'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => {
        const w = max > 0 ? Math.max(Math.round((step.count / max) * 100), step.count > 0 ? 5 : 0) : 0;
        const convRate = i > 0 && steps[i - 1].count > 0
          ? Math.round((step.count / steps[i - 1].count) * 100)
          : null;

        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 100, fontSize: 12, color: '#7070a0', textAlign: 'right', flexShrink: 0 }}>{step.label}</div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', background: COLORS[i] || '#6366f1', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width 0.6s ease', opacity: step.count === 0 ? 0.3 : 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    {step.count}
                  </span>
                </div>
              </div>
            </div>
            {convRate != null && (
              <div style={{ width: 44, fontSize: 11, color: convRate >= 50 ? '#10b981' : '#f59e0b', fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>
                {convRate}%
              </div>
            )}
            {convRate == null && <div style={{ width: 44 }} />}
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 10, color: '#44445a', marginTop: 2 }}>
        ↑ conversion from previous stage
      </div>
    </div>
  );
}

// ── Time-to-hire estimate ─────────────────────────────────────────────────────
function avgDays(sessions) {
  const completed = sessions.filter(s => s.status === 'completed' && s.startedAt && s.completedAt);
  if (completed.length === 0) return null;
  const totalMs = completed.reduce((acc, s) => acc + (new Date(s.completedAt) - new Date(s.startedAt)), 0);
  return Math.round(totalMs / completed.length / 1000 / 60); // avg minutes
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HiringAnalyticsPage() {
  const [resumes,  setResumes]  = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/resumes').then(r => r.data.data || []),
      API.get('/screening').then(r => r.data.data || []),
    ])
      .then(([res, sess]) => { setResumes(res); setSessions(sess); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#44445a' }}>Loading analytics…</div>;

  // ── Compute metrics ────────────────────────────────────────────────────────
  const total        = resumes.length;
  const aiScored     = resumes.filter(r => r.blindScore != null).length;
  const shortlisted  = resumes.filter(r => ['shortlisted','interview_scheduled'].includes(r.status)).length;
  const rejected     = resumes.filter(r => r.status === 'rejected').length;
  const interviewed  = sessions.filter(s => s.status === 'completed').length;
  const decisions    = sessions.filter(s => s.aiAnalysis?.overallVerdict).length;
  const advanced     = sessions.filter(s => s.aiAnalysis?.overallVerdict === 'advance').length;

  const scores       = resumes.filter(r => r.blindScore != null).map(r => r.blindScore);
  const avgScore     = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const avgInterviewMin = avgDays(sessions);

  const commScores   = sessions.filter(s => s.aiAnalysis?.communicationScore != null).map(s => s.aiAnalysis.communicationScore);
  const techScores   = sessions.filter(s => s.aiAnalysis?.technicalScore != null).map(s => s.aiAnalysis.technicalScore);
  const confScores   = sessions.filter(s => s.aiAnalysis?.confidenceScore != null).map(s => s.aiAnalysis.confidenceScore);

  const verdicts     = sessions.filter(s => s.aiAnalysis?.overallVerdict).map(s => s.aiAnalysis.overallVerdict);

  const funnelSteps = [
    { label: 'Applied',      count: total       },
    { label: 'AI Scored',    count: aiScored    },
    { label: 'Shortlisted',  count: shortlisted },
    { label: 'Interviewed',  count: interviewed },
    { label: 'Advanced',     count: advanced    },
  ];

  const avgOf = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const wrap = { padding: '28px 24px', color: '#e2e8f0', fontFamily: 'Inter, Segoe UI, system-ui, sans-serif', maxWidth: 900, margin: '0 auto' };
  const card = { background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 22px' };

  return (
    <div style={wrap} className="page-fade-in">
      <h1 className="page-title">Hiring Analytics</h1>
      <p className="page-subtitle">Live metrics from resume screening and AI interviews</p>

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <p>No data yet. Upload resumes and create screening sessions to see analytics.</p>
        </div>
      )}

      {total > 0 && (
        <>
          {/* KPI row */}
          <SectionTitle>Key Metrics</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard icon="📄" label="Applications"  value={total}      color="#a5b4fc" sub="Total resumes uploaded" />
            <StatCard icon="🤖" label="AI Scored"     value={aiScored}   color="#a5b4fc" sub={`${total > 0 ? Math.round(aiScored/total*100) : 0}% coverage`} />
            <StatCard icon="✓"  label="Shortlisted"   value={shortlisted} color="#10b981" sub="Ready for interview" />
            <StatCard icon="🎤" label="Interviewed"   value={interviewed} color="#f59e0b" sub="Sessions completed" />
            <StatCard icon="🚀" label="Advanced"      value={advanced}   color="#10b981" sub={`of ${decisions} decisions`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 12 }}>
            {avgScore != null && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#6366f1' }}>{avgScore}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Avg AI Blind Score</div>
                  <div style={{ fontSize: 11, color: '#44445a' }}>out of 100</div>
                </div>
                <div style={{ flex: 1 }}>
                  <ScoreHistogram scores={scores} color="#6366f1" />
                </div>
              </div>
            )}
            {avgInterviewMin != null && (
              <div style={{ ...card }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>{avgInterviewMin}m</div>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Avg Interview Duration</div>
                <div style={{ fontSize: 11, color: '#44445a' }}>across {interviewed} completed sessions</div>
              </div>
            )}
            <div style={{ ...card }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#ef4444' }}>{rejected}</div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Rejected</div>
              <div style={{ fontSize: 11, color: '#44445a' }}>{total > 0 ? Math.round(rejected/total*100) : 0}% reject rate</div>
            </div>
          </div>

          {/* Hiring funnel */}
          <SectionTitle>Hiring Funnel</SectionTitle>
          <div style={card}>
            <HiringFunnel steps={funnelSteps} />
          </div>

          {/* Interview scores */}
          {interviewed > 0 && (
            <>
              <SectionTitle>Interview Score Averages</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Communication', scores: commScores, color: '#a5b4fc' },
                  { label: 'Technical',     scores: techScores, color: '#67e8f9' },
                  { label: 'Confidence',    scores: confScores, color: '#6ee7b7' },
                ].map(({ label, scores: sc, color }) => (
                  <div key={label} style={card}>
                    <div style={{ fontSize: 30, fontWeight: 800, color, marginBottom: 4 }}>
                      {avgOf(sc) ?? '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 10 }}>Avg {label}</div>
                    <ScoreHistogram scores={sc} color={color} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Verdict breakdown */}
          {decisions > 0 && (
            <>
              <SectionTitle>Interview Verdicts</SectionTitle>
              <div style={card}>
                <VerdictBreakdown verdicts={verdicts} />
              </div>
            </>
          )}

          {/* Per-job breakdown */}
          <SectionTitle>Per-Job Breakdown</SectionTitle>
          <JobBreakdownTable resumes={resumes} sessions={sessions} />
        </>
      )}
    </div>
  );
}
