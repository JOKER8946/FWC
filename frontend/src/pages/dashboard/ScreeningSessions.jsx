import { useState, useEffect } from 'react';
import { getSessions, getSession, createSession, generateCandidateLink } from '../../api/screening';
import './ScreeningSessions.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

const StatusBadge = ({ status }) => {
  const map = {
    in_progress: { label: '🔴 Live',      bg: 'rgba(239,68,68,0.15)',   color: '#ef4444'  },
    completed:   { label: '✓ Completed',  bg: 'rgba(16,185,129,0.12)',  color: '#10b981'  },
    scheduled:   { label: '📅 Scheduled', bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc'  },
    abandoned:   { label: '✗ Abandoned',  bg: 'rgba(107,114,128,0.12)', color: '#6b7280'  },
  };
  const s = map[status] || { label: status, bg: 'rgba(255,255,255,0.06)', color: '#7070a0' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  );
};

const VerdictBadge = ({ verdict }) => {
  if (!verdict) return null;
  const map = {
    advance: { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Advance'  },
    hold:    { bg: 'rgba(245,158,11,0.15)',   color: '#f59e0b', label: 'Hold'     },
    reject:  { bg: 'rgba(239,68,68,0.15)',    color: '#ef4444', label: 'Reject'   },
  };
  const v = map[verdict] || { bg: 'rgba(255,255,255,0.06)', color: '#7070a0', label: verdict };
  return (
    <span style={{ background: v.bg, color: v.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
      {v.label}
    </span>
  );
};

const ScoreChip = ({ label, value, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
    <span style={{ fontSize: 16, fontWeight: 800, color: color || '#a5b4fc' }}>{value ?? '—'}</span>
    <span style={{ fontSize: 10, color: '#7070a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
  </div>
);

const ProctoringBadge = ({ proctoring }) => {
  if (!proctoring) return null;
  const total = (proctoring.tabSwitches || 0) + (proctoring.focusLostEvents || 0);
  if (total === 0) return <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓ Clean</span>;
  return (
    <span style={{ fontSize: 11, color: proctoring.flagged ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
      {proctoring.flagged ? '🚩 Flagged' : '⚠'} {total} switch{total !== 1 ? 'es' : ''}
    </span>
  );
};

// ── Shared modal styles ───────────────────────────────────────────────────────

const MODAL_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const PANEL_STYLE = {
  background: '#13131f', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
};

// ── Create Session Modal ──────────────────────────────────────────────────────

function StartSessionModal({ onClose, onCreated }) {
  const [jobs,        setJobs]       = useState([]);
  const [resumes,     setResumes]    = useState([]);
  const [selectedJob, setJob]        = useState('');
  const [selectedResume, setResume]  = useState('');
  const [loading,     setLoading]    = useState(false);
  const [jobsLoaded,  setJobsLoaded] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadJobs = async () => {
    if (jobsLoaded) return;
    try {
      const { default: api } = await import('../../api/axios');
      const res = await api.get('/resumes/jobs');
      setJobs(res.data.data || []);
      setJobsLoaded(true);
    } catch { /* non-critical: leave the previous list in place */ }
  };

  const loadResumes = async (jobId) => {
    if (!jobId) { setResumes([]); return; }
    try {
      const { default: api } = await import('../../api/axios');
      const res = await api.get('/resumes', { params: { jobId, status: 'shortlisted' } });
      setResumes(res.data.data || []);
    } catch { /* non-critical: leave the previous list in place */ }
  };

  const handleJobChange = (e) => {
    setJob(e.target.value);
    setResume('');
    loadResumes(e.target.value);
  };

  const handleCreate = async () => {
    if (!selectedResume) return;
    setLoading(true);
    setCreateError('');
    try {
      const res = await createSession({ resumeId: selectedResume, mode: 'text' });
      onCreated(res.data.data);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create session. Please try again.');
    } finally { setLoading(false); }
  };

  const sel  = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '9px 12px', fontSize: 13.5, outline: 'none', marginTop: 6 };
  const lbl  = { fontSize: 12, color: '#7070a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={MODAL_STYLE} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={PANEL_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>New Screening Session</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7070a0', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={lbl}>Job Posting</div>
            <select style={sel} value={selectedJob} onChange={handleJobChange} onFocus={loadJobs}>
              <option value="">Select a job…</option>
              {jobs.map(j => <option key={j._id} value={j._id}>{j.title} · {j.department}</option>)}
            </select>
          </div>

          <div>
            <div style={lbl}>Shortlisted Candidate</div>
            <select style={sel} value={selectedResume} onChange={e => setResume(e.target.value)} disabled={!selectedJob}>
              <option value="">
                {!selectedJob ? 'Select a job first' : resumes.length === 0 ? 'No shortlisted candidates' : 'Select a candidate…'}
              </option>
              {resumes.map(r => <option key={r._id} value={r._id}>{r.originalFileName} · Score: {r.blindScore}/100</option>)}
            </select>
          </div>

          <p style={{ fontSize: 12, color: '#44445a', lineHeight: 1.5 }}>
            After creating the session, open the detail panel to generate a shareable link for the candidate.
          </p>

          {createError && (
            <div style={{ padding: '9px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12.5, color: '#f87171' }}>
              {createError}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !selectedResume}
            style={{
              background: loading || !selectedResume ? 'rgba(99,102,241,0.3)' : '#6366f1',
              border: 'none', borderRadius: 8, color: '#fff',
              padding: 11, fontSize: 14, fontWeight: 600,
              cursor: loading || !selectedResume ? 'not-allowed' : 'pointer', marginTop: 4,
            }}
          >
            {loading ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session Detail Panel ──────────────────────────────────────────────────────

function SessionDetailPanel({ session, onClose, onLinkGenerated }) {
  const [genLoading, setGenLoading] = useState(false);
  const [linkUrl,    setLinkUrl]    = useState(null);
  const [copied,     setCopied]     = useState(false);
  const [linkError,  setLinkError]  = useState('');

  const handleGenLink = async () => {
    setGenLoading(true);
    setLinkError('');
    try {
      const res = await generateCandidateLink(session._id);
      const { interviewPath, interviewUrl, token } = res.data.data;

      // Build the share URL on the *frontend* so it always matches the
      // candidate's browser origin (works on localhost, staging, prod, and
      // preview deploys without env-var coordination). Fall back to the
      // server-provided URL only if the path is missing.
      const url = interviewPath
        ? `${window.location.origin}${interviewPath}`
        : interviewUrl;
      if (!url) throw new Error('Server did not return a usable interview link.');

      // Keep the raw token around in case a future caller wants to embed it
      // in a QR code or email template.
      setLinkUrl(url);
      if (onLinkGenerated) onLinkGenerated(session._id, url, token);
    } catch (err) {
      setLinkError(err.response?.data?.message || err.message || 'Failed to generate link. Please try again.');
    } finally { setGenLoading(false); }
  };

  const handleCopy = () => {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const a = session.aiAnalysis || {};
  const p = session.proctoring || {};
  const isCompleted = session.status === 'completed';
  const canGenLink  = !['completed', 'abandoned'].includes(session.status);

  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 };

  return (
    <div style={MODAL_STYLE} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...PANEL_STYLE, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              {session.resumeId?.originalFileName || 'Session Detail'}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={session.status} />
              {isCompleted && <VerdictBadge verdict={a.overallVerdict} />}
              {isCompleted && <ProctoringBadge proctoring={p} />}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7070a0', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Info rows */}
        <div style={{ marginBottom: 20 }}>
          <div style={row}><span style={{ color: '#7070a0' }}>Job</span><span style={{ color: '#e2e8f0', fontWeight: 500 }}>{session.jobId?.title || '—'}</span></div>
          <div style={row}><span style={{ color: '#7070a0' }}>Mode</span><span style={{ color: '#e2e8f0', fontWeight: 500 }}>⌨ Text</span></div>
          <div style={row}><span style={{ color: '#7070a0' }}>Started</span><span style={{ color: '#e2e8f0' }}>{session.startedAt ? `${fmtDate(session.startedAt)} ${fmtTime(session.startedAt)}` : '—'}</span></div>
          {isCompleted && <div style={row}><span style={{ color: '#7070a0' }}>Duration</span><span style={{ color: '#e2e8f0' }}>{session.durationSeconds ? `${Math.round(session.durationSeconds / 60)} min` : '—'}</span></div>}
          <div style={row}><span style={{ color: '#7070a0' }}>Turns</span><span style={{ color: '#e2e8f0' }}>{session.conversationHistory?.length || 0} messages</span></div>
        </div>

        {/* Generate / copy link */}
        {canGenLink && (
          <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              🔗 Candidate Interview Link
            </div>
            {linkUrl ? (
              <>
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 11.5, color: '#a5b4fc', wordBreak: 'break-all', marginBottom: 10, fontFamily: 'monospace', textDecoration: 'underline', textDecorationColor: 'rgba(165,180,252,0.4)' }}
                >
                  {linkUrl}
                </a>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleCopy}
                    style={{ background: copied ? 'rgba(16,185,129,0.25)' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e2e8f0', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    ↗ Open
                  </a>
                </div>
                <div style={{ fontSize: 11, color: '#44445a', marginTop: 8 }}>Valid for 48 hours · Share with candidate via email</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#7070a0', marginBottom: 12, lineHeight: 1.5 }}>
                  Generate a unique, secure link for this candidate to attend the interview from their own device.
                </div>
                <button
                  onClick={handleGenLink}
                  disabled={genLoading}
                  style={{ background: genLoading ? 'rgba(99,102,241,0.3)' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: genLoading ? 'not-allowed' : 'pointer' }}
                >
                  {genLoading ? 'Generating…' : 'Generate Interview Link'}
                </button>
                {linkError && (
                  <div style={{ marginTop: 10, padding: '9px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12.5, color: '#f87171' }}>
                    {linkError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* AI Analysis */}
        {isCompleted && a.overallVerdict && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7070a0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>AI Analysis</div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 14 }}>
              <ScoreChip label="Comm" value={a.communicationScore} color="#a5b4fc" />
              <ScoreChip label="Tech" value={a.technicalScore}     color="#67e8f9" />
              <ScoreChip label="Conf" value={a.confidenceScore}    color="#6ee7b7" />
            </div>
            {a.summary && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                {a.summary}
              </div>
            )}
            {a.keyInsights?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {a.keyInsights.map((ins, i) => <li key={i} style={{ fontSize: 13, color: '#7070a0', lineHeight: 1.5 }}>{ins}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Proctoring report */}
        {isCompleted && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: p.flagged ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Proctoring: {p.flagged ? '🚩 Flagged' : '✓ Clean'}
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#7070a0', marginBottom: 8 }}>
              <span>Tab switches: <strong style={{ color: '#e2e8f0' }}>{p.tabSwitches || 0}</strong></span>
              <span>Focus lost: <strong style={{ color: '#e2e8f0' }}>{p.focusLostEvents || 0}</strong></span>
            </div>
            {p.events?.length > 0 && (
              <div style={{ fontSize: 11, color: '#44445a', lineHeight: 1.8 }}>
                {p.events.map((ev, i) => (
                  <span key={i} style={{ marginRight: 10 }}>
                    {ev.type === 'tab_switch' ? '🔀' : '🫥'} {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScreeningSessionsPage() {
  const [sessions,     setSessions]   = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [selectedSession, setSelected] = useState(null);
  const [showCreate,   setShowCreate] = useState(false);
  const [linkMap,      setLinkMap]    = useState({}); // sessionId → url

  useEffect(() => {
    getSessions()
      .then(res => setSessions(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectSession = async (s) => {
    try {
      const res = await getSession(s._id);
      setSelected(res.data.data);
    } catch {
      setSelected(s);
    }
  };

  const handleCreated = (newSession) => {
    setShowCreate(false);
    setSessions(prev => [newSession, ...prev]);
    handleSelectSession(newSession);
  };

  const handleLinkGenerated = (sessionId, url) =>
    setLinkMap(prev => ({ ...prev, [sessionId]: url }));

  const wrap = { padding: '28px 24px', color: '#e2e8f0', fontFamily: 'Inter, Segoe UI, system-ui, sans-serif', maxWidth: 920, margin: '0 auto' };

  return (
    <div style={wrap} className="page-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">AI Screening Sessions</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Create a session, generate a secure candidate link, and review AI analysis + proctoring report after completion.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          ▶ New Session
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎤</div>
          <p style={{ fontSize: 14, marginBottom: 6 }}>No screening sessions yet.</p>
          <p style={{ fontSize: 12, color: '#3a3a55' }}>Click "New Session" to start an AI-powered interview.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => {
            const a = s.aiAnalysis || {};
            const p = s.proctoring || {};
            const isCompleted = s.status === 'completed';
            const hasLink = !!linkMap[s._id];

            return (
              <div
                key={s._id}
                onClick={() => handleSelectSession(s)}
                style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
              >
                {/* Left */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.resumeId?.originalFileName || 'Resume'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge status={s.status} />
                    {s.jobId?.title && <span style={{ fontSize: 11, color: '#7070a0' }}>{s.jobId.title}</span>}
                    <span style={{ fontSize: 11, color: '#44445a' }}>⌨</span>
                    <span style={{ fontSize: 11, color: '#44445a' }}>{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                {/* Right */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                  {isCompleted ? (
                    <>
                      {a.overallVerdict && <VerdictBadge verdict={a.overallVerdict} />}
                      {a.communicationScore != null && (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <ScoreChip label="Comm" value={a.communicationScore} color="#a5b4fc" />
                          <ScoreChip label="Tech" value={a.technicalScore}     color="#67e8f9" />
                          <ScoreChip label="Conf" value={a.confidenceScore}    color="#6ee7b7" />
                        </div>
                      )}
                      <ProctoringBadge proctoring={p} />
                    </>
                  ) : s.status !== 'abandoned' ? (
                    <span style={{ fontSize: 11, color: hasLink ? '#10b981' : '#7070a0', fontWeight: hasLink ? 600 : 400 }}>
                      {hasLink ? '🔗 Link ready' : 'Open to generate link'}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreate && <StartSessionModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelected(null)}
          onLinkGenerated={handleLinkGenerated}
        />
      )}
    </div>
  );
}
