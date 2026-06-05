import { useState, useEffect } from 'react';
import API from '../../api/axios';

const STATUS_STAGES = {
  pending:              { label: 'Processing',  color: '#7070a0', bg: 'rgba(112,112,160,0.12)', order: 0 },
  ai_scored:            { label: 'AI Scored',   color: '#a5b4fc', bg: 'rgba(165,180,252,0.12)', order: 1 },
  shortlisted:          { label: 'Shortlisted', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  order: 2 },
  interview_scheduled:  { label: 'Interviewing',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  order: 3 },
  rejected:             { label: 'Rejected',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   order: 4 },
};

const VERDICT_STYLE = {
  advance: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Advance' },
  hold:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Hold'    },
  reject:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Reject'  },
};

const badge = (style) => ({
  display: 'inline-block',
  background: style.bg,
  color: style.color,
  borderRadius: 20,
  padding: '3px 9px',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
});

const scoreBar = (val, color = '#6366f1') => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', minWidth: 48 }}>
      <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 26 }}>{val}</span>
  </div>
);

const FILTERS = [
  { key: 'all',        label: 'All Candidates' },
  { key: 'active',     label: 'Active' },
  { key: 'shortlisted',label: 'Shortlisted' },
  { key: 'interviewed',label: 'Interviewed' },
  { key: 'decided',    label: 'Decision Made' },
  { key: 'rejected',   label: 'Rejected' },
];

export default function CandidatePipelinePage() {
  const [resumes,   setResumes]   = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [jobs,      setJobs]      = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [jobFilter, setJobFilter] = useState('');
  const [sortBy,    setSortBy]    = useState('score'); // score | name | date | stage
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    Promise.all([
      API.get('/resumes').then(r => r.data.data || []),
      API.get('/screening').then(r => r.data.data || []),
      API.get('/resumes/jobs').then(r => r.data.data || []),
    ])
      .then(([res, sess, jobList]) => {
        setResumes(res);
        setSessions(sess);
        setJobs(jobList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build session map keyed by resumeId
  const sessionByResume = {};
  sessions.forEach(s => {
    if (s.resumeId?._id || s.resumeId) {
      const rid = s.resumeId?._id || s.resumeId;
      sessionByResume[rid] = s;
    }
  });

  // Enrich resumes with session data
  const rows = resumes.map(r => {
    const sess = sessionByResume[r._id] || null;
    const isInterviewed = sess?.status === 'completed';
    const stage =
      isInterviewed         ? 'interviewed' :
      r.status === 'rejected' ? 'rejected'   :
      r.status;

    return { ...r, session: sess, stage };
  });

  // Filter
  const filtered = rows.filter(r => {
    if (jobFilter && r.jobId?._id !== jobFilter && r.jobId !== jobFilter) return false;
    switch (filter) {
      case 'all':        return true;
      case 'active':     return !['rejected'].includes(r.status);
      case 'shortlisted':return ['shortlisted', 'interview_scheduled'].includes(r.status);
      case 'interviewed':return r.stage === 'interviewed';
      case 'decided':    return !!r.session?.aiAnalysis?.overallVerdict;
      case 'rejected':   return r.status === 'rejected';
      default:           return true;
    }
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return (b.blindScore || 0) - (a.blindScore || 0);
    if (sortBy === 'date')  return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'stage') return (STATUS_STAGES[b.stage]?.order || 0) - (STATUS_STAGES[a.stage]?.order || 0);
    if (sortBy === 'name')  return (a.originalFileName || '').localeCompare(b.originalFileName || '');
    return 0;
  });

  const isIdentityVisible = (r) => ['shortlisted', 'interview_scheduled', 'rejected'].includes(r.status) || r.stage === 'interviewed';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

  const wrap = { padding: '28px 24px', color: '#e2e8f0', fontFamily: 'Inter, Segoe UI, system-ui, sans-serif', maxWidth: 1050, margin: '0 auto' };
  const th   = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
  const td   = { padding: '11px 12px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div style={wrap} className="page-fade-in">
      {/* Header */}
      <h1 className="page-title">Candidate Pipeline</h1>
      <p className="page-subtitle">All candidates across every job posting — filter by stage</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        {/* Job filter */}
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All Jobs</option>
          {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
        </select>
      </div>

      {/* Stage counts */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const count = rows.filter(r => {
            if (jobFilter && r.jobId?._id !== jobFilter && r.jobId !== jobFilter) return false;
            switch (f.key) {
              case 'all':        return true;
              case 'active':     return !['rejected'].includes(r.status);
              case 'shortlisted':return ['shortlisted', 'interview_scheduled'].includes(r.status);
              case 'interviewed':return r.stage === 'interviewed';
              case 'decided':    return !!r.session?.aiAnalysis?.overallVerdict;
              case 'rejected':   return r.status === 'rejected';
              default:           return true;
            }
          }).length;

          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, color: active ? '#a5b4fc' : '#7070a0',
                padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.label}
              <span style={{ background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)', borderRadius: 99, padding: '1px 6px', fontSize: 11 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#44445a' }}>
        <span>Sort by:</span>
        {[['score','AI Score'],['stage','Stage'],['date','Date'],['name','File']].map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)}
            style={{ background: sortBy === k ? 'rgba(99,102,241,0.15)' : 'none', border: '1px solid', borderColor: sortBy === k ? 'rgba(99,102,241,0.4)' : 'transparent', borderRadius: 6, color: sortBy === k ? '#a5b4fc' : '#7070a0', padding: '3px 9px', fontSize: 12, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#44445a' }}>{sorted.length} candidate{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>Loading pipeline…</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <p>No candidates match this filter.</p>
        </div>
      ) : (
        <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <tr>
                <th style={th}>Candidate</th>
                <th style={th}>Job</th>
                <th style={th}>Stage</th>
                <th style={th}>AI Score</th>
                <th style={th}>Interview</th>
                <th style={th}>Verdict</th>
                <th style={th}>Proctoring</th>
                <th style={th}>Added</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const stageStyle = STATUS_STAGES[r.stage] || STATUS_STAGES[r.status] || STATUS_STAGES.pending;
                const sess = r.session;
                const verdict = sess?.aiAnalysis?.overallVerdict;
                const vStyle = verdict ? VERDICT_STYLE[verdict] : null;
                const proc = sess?.proctoring;
                const procTotal = (proc?.tabSwitches || 0) + (proc?.focusLostEvents || 0);
                const identityVisible = isIdentityVisible(r);
                const name = identityVisible
                  ? (r.candidateInfo?.name || r.originalFileName || '—')
                  : '🔒 Hidden until shortlisted';

                return (
                  <tr
                    key={r._id}
                    onClick={() => setSelected(r)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: identityVisible ? '#e2e8f0' : '#44445a', fontSize: 13 }}>{name}</div>
                      {identityVisible && r.candidateInfo?.email && (
                        <div style={{ fontSize: 11, color: '#44445a', marginTop: 2 }}>{r.candidateInfo.email}</div>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{r.jobId?.title || '—'}</span>
                    </td>
                    <td style={td}>
                      <span style={badge(stageStyle)}>{stageStyle.label}</span>
                    </td>
                    <td style={{ ...td, minWidth: 110 }}>
                      {r.blindScore != null ? scoreBar(r.blindScore) : <span style={{ color: '#44445a' }}>—</span>}
                    </td>
                    <td style={td}>
                      {sess?.status === 'completed' && sess.aiAnalysis ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 11, color: '#a5b4fc' }}>Comm {sess.aiAnalysis.communicationScore ?? '—'}</span>
                          <span style={{ fontSize: 11, color: '#67e8f9' }}>Tech {sess.aiAnalysis.technicalScore ?? '—'}</span>
                          <span style={{ fontSize: 11, color: '#6ee7b7' }}>Conf {sess.aiAnalysis.confidenceScore ?? '—'}</span>
                        </div>
                      ) : sess ? (
                        <span style={{ fontSize: 11, color: '#7070a0' }}>{sess.status === 'in_progress' ? '🔴 Live' : sess.status}</span>
                      ) : (
                        <span style={{ color: '#44445a' }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      {vStyle ? <span style={badge(vStyle)}>{vStyle.label}</span> : <span style={{ color: '#44445a' }}>—</span>}
                    </td>
                    <td style={td}>
                      {proc && procTotal > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: proc.flagged ? '#ef4444' : '#f59e0b' }}>
                          {proc.flagged ? '🚩' : '⚠'} {procTotal}
                        </span>
                      ) : sess?.status === 'completed' ? (
                        <span style={{ fontSize: 11, color: '#10b981' }}>✓ Clean</span>
                      ) : (
                        <span style={{ color: '#44445a' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, color: '#44445a', fontSize: 12 }}>{fmtDate(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <CandidateDetailPanel candidate={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CandidateDetailPanel({ candidate: r, onClose }) {
  const sess = r.session;
  const a    = sess?.aiAnalysis || {};
  const p    = sess?.proctoring || {};
  const identityVisible = ['shortlisted','interview_scheduled','rejected'].includes(r.status) || sess?.status === 'completed';

  const stageStyle = STATUS_STAGES[r.stage] || STATUS_STAGES[r.status] || STATUS_STAGES.pending;

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const panel   = { background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto' };
  const row     = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 };

  const verdict = a.overallVerdict;
  const vStyle  = verdict ? VERDICT_STYLE[verdict] : null;

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              {identityVisible ? (r.candidateInfo?.name || r.originalFileName) : '🔒 Identity Hidden'}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ ...VERDICT_STYLE.advance, ...VERDICT_STYLE[verdict], ...(vStyle ? { background: vStyle.bg, color: vStyle.color } : {}), display: 'inline-block', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600, background: stageStyle.bg, color: stageStyle.color }}>
                {stageStyle.label}
              </span>
              {vStyle && <span style={{ display: 'inline-block', background: vStyle.bg, color: vStyle.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{vStyle.label}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7070a0', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Identity (if visible) */}
        {identityVisible && (
          <div style={{ marginBottom: 16 }}>
            {r.candidateInfo?.email    && <div style={{ fontSize: 12, color: '#7070a0' }}>✉ {r.candidateInfo.email}</div>}
            {r.candidateInfo?.phone    && <div style={{ fontSize: 12, color: '#7070a0' }}>📞 {r.candidateInfo.phone}</div>}
            {r.candidateInfo?.location && <div style={{ fontSize: 12, color: '#7070a0' }}>📍 {r.candidateInfo.location}</div>}
          </div>
        )}

        {/* Job + Score */}
        <div style={{ marginBottom: 16 }}>
          <div style={row}><span style={{ color: '#7070a0' }}>Job</span><span style={{ color: '#e2e8f0', fontWeight: 500 }}>{r.jobId?.title || '—'}</span></div>
          <div style={row}><span style={{ color: '#7070a0' }}>AI Blind Score</span><span style={{ color: '#a5b4fc', fontWeight: 700 }}>{r.blindScore ?? '—'} / 100</span></div>
          {r.aiEvaluation?.skillsMatch != null && (
            <div style={row}><span style={{ color: '#7070a0' }}>Skills Match</span><span style={{ color: '#e2e8f0' }}>{r.aiEvaluation.skillsMatch}/100</span></div>
          )}
          {r.aiEvaluation?.experienceMatch != null && (
            <div style={row}><span style={{ color: '#7070a0' }}>Experience</span><span style={{ color: '#e2e8f0' }}>{r.aiEvaluation.experienceMatch}/100</span></div>
          )}
          {r.aiEvaluation?.recommendation && (
            <div style={row}><span style={{ color: '#7070a0' }}>Recommendation</span><span style={{ color: '#e2e8f0', fontWeight: 500 }}>{r.aiEvaluation.recommendation?.replace('_', ' ')}</span></div>
          )}
        </div>

        {/* Strengths / Gaps */}
        {r.aiEvaluation?.strengths?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Strengths</div>
            {r.aiEvaluation.strengths.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: '#94a3b8', paddingLeft: 10, marginBottom: 3 }}>• {s}</div>)}
          </div>
        )}
        {r.aiEvaluation?.gaps?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gaps</div>
            {r.aiEvaluation.gaps.map((g, i) => <div key={i} style={{ fontSize: 12.5, color: '#94a3b8', paddingLeft: 10, marginBottom: 3 }}>• {g}</div>)}
          </div>
        )}

        {/* Interview analysis */}
        {sess?.status === 'completed' && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7070a0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Interview Analysis</div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 12 }}>
              {[['Comm', a.communicationScore, '#a5b4fc'], ['Tech', a.technicalScore, '#67e8f9'], ['Conf', a.confidenceScore, '#6ee7b7']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v ?? '—'}</div>
                  <div style={{ fontSize: 10, color: '#44445a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                </div>
              ))}
            </div>
            {a.summary && <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>{a.summary}</div>}
            {a.keyInsights?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {a.keyInsights.map((ins, i) => <li key={i} style={{ fontSize: 12.5, color: '#7070a0', marginBottom: 4 }}>{ins}</li>)}
              </ul>
            )}

            {/* Proctoring */}
            <div style={{ marginTop: 12, fontSize: 12, color: '#44445a' }}>
              Proctoring: <strong style={{ color: p.flagged ? '#ef4444' : '#10b981' }}>{p.flagged ? '🚩 Flagged' : '✓ Clean'}</strong>
              {' '} · Switches: {p.tabSwitches || 0} · Focus lost: {p.focusLostEvents || 0}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
