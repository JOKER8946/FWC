import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getJobsForScreener, getResumes, uploadResume,
  shortlistResume, rejectResume, createJob,
} from '../../api/resumes';
import './ResumeScreener.css';

// ── Score ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 72 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = ((score || 0) / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.22} fontWeight="700" fontFamily="Syne, sans-serif">
        {score ?? '—'}
      </text>
    </svg>
  );
};

// ── Recommendation badge ──────────────────────────────────────────────────────
const RecBadge = ({ rec }) => {
  const map = {
    strong_hire: { label: '⭐ Strong Hire', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    consider:    { label: '🤔 Consider',    bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    reject:      { label: '✗ Reject',       bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  };
  const s = map[rec] || map.consider;
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>{s.label}</span>;
};

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    screened:    { label: 'Screened',    color: '#6366f1' },
    shortlisted: { label: 'Shortlisted', color: '#10b981' },
    rejected:    { label: 'Rejected',    color: '#ef4444' },
    processing:  { label: 'Processing',  color: '#f59e0b' },
  };
  const s = map[status] || { label: status, color: '#9090b0' };
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${s.color}18`, color: s.color, textTransform: 'capitalize' }}>{s.label}</span>;
};

// ── Create Job Modal ──────────────────────────────────────────────────────────
function CreateJobModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', department: '', description: '', requirements: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await createJob({
        ...form,
        requirements: form.requirements.split('\n').map(r => r.trim()).filter(Boolean),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create job.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Job Posting</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-field">
              <label>Job Title *</label>
              <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required placeholder="e.g. AI/ML Engineer" />
            </div>
            <div className="form-field">
              <label>Department *</label>
              <input value={form.department} onChange={e => setForm(f=>({...f,department:e.target.value}))} required placeholder="e.g. engineering" />
            </div>
          </div>
          <div className="form-field">
            <label>Description *</label>
            <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} required rows={3} placeholder="Role overview..." style={{ resize:'vertical', minHeight:80 }} />
          </div>
          <div className="form-field">
            <label>Requirements (one per line) *</label>
            <textarea value={form.requirements} onChange={e => setForm(f=>({...f,requirements:e.target.value}))} rows={5}
              placeholder={`React.js\nNode.js\n2+ years experience\nMachine Learning\nPython`}
              style={{ resize:'vertical', minHeight:110, fontFamily:'monospace', fontSize:12 }} />
          </div>
          {error && <div className="modal-error">⚠ {error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Job'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Resume detail panel ───────────────────────────────────────────────────────
function ResumeDetail({ resume, onShortlist, onReject, onClose }) {
  if (!resume) return null;
  const isActionable = resume.status === 'screened';

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <div className="detail-filename">{resume.originalFileName}</div>
          <StatusBadge status={resume.status} />
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      {/* Scores */}
      <div className="detail-scores">
        <div className="score-item">
          <ScoreRing score={resume.blindScore} size={80} />
          <div className="score-label">Overall</div>
        </div>
        <div className="score-item">
          <ScoreRing score={resume.skillsMatch} size={64} />
          <div className="score-label">Skills</div>
        </div>
        <div className="score-item">
          <ScoreRing score={resume.experienceMatch} size={64} />
          <div className="score-label">Experience</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <RecBadge rec={resume.aiEvaluation?.recommendation} />
      </div>

      {resume.aiEvaluation?.reasoning && (
        <div className="detail-reasoning">{resume.aiEvaluation.reasoning}</div>
      )}

      {/* Strengths / Gaps / Red Flags */}
      {['strengths','gaps','redFlags'].map(key => {
        const items = resume.aiEvaluation?.[key] || [];
        if (!items.length) return null;
        const cfg = {
          strengths: { label: '✓ Strengths',  color: '#10b981' },
          gaps:      { label: '△ Gaps',        color: '#f59e0b' },
          redFlags:  { label: '⚠ Red Flags',   color: '#ef4444' },
        }[key];
        return (
          <div key={key} className="detail-section">
            <div className="detail-section-title" style={{ color: cfg.color }}>{cfg.label}</div>
            <ul className="detail-list">
              {items.map((item, i) => <li key={i} style={{ color: '#9090b0' }}>{item}</li>)}
            </ul>
          </div>
        );
      })}

      {/* Candidate info — only if shortlisted */}
      {resume.candidateInfo && resume.status === 'shortlisted' && (
        <div className="candidate-reveal">
          <div className="detail-section-title" style={{ color: '#6366f1' }}>👤 Candidate Identity</div>
          {Object.entries(resume.candidateInfo).map(([k, v]) => (
            <div key={k} className="candidate-row">
              <span className="candidate-key">{k}</span>
              <span className="candidate-val">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {isActionable && (
        <div className="detail-actions">
          <button className="btn-danger-sm" onClick={() => onReject(resume._id)}>✗ Reject</button>
          <button className="btn-success" onClick={() => onShortlist(resume._id)}>✓ Shortlist & Reveal Identity</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResumeScreener() {
  const qc = useQueryClient();
  const fileRef = useRef();

  const [selectedJob, setSelectedJob]   = useState('');
  const [selectedResume, setSelectedResume] = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const [showJobModal, setShowJobModal] = useState(false);
  const [dragOver, setDragOver]         = useState(false);

  const { data: jobsData } = useQuery({
    queryKey: ['screener-jobs'],
    queryFn: () => getJobsForScreener().then(r => r.data.data),
  });

  const { data: resumesData, isLoading } = useQuery({
    queryKey: ['resumes', selectedJob],
    queryFn: () => getResumes(selectedJob).then(r => r.data),
    enabled: !!selectedJob,
  });

  const shortlistMutation = useMutation({
    mutationFn: shortlistResume,
    onSuccess: (res) => {
      qc.invalidateQueries(['resumes', selectedJob]);
      setSelectedResume(res.data.data);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectResume,
    onSuccess: () => {
      qc.invalidateQueries(['resumes', selectedJob]);
      setSelectedResume(null);
    },
  });

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setUploadError('Only PDF files accepted.'); return;
    }
    if (!selectedJob) { setUploadError('Select a job first.'); return; }
    setUploading(true); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('jobId', selectedJob);
      await uploadResume(fd);
      qc.invalidateQueries(['resumes', selectedJob]);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const resumes = resumesData?.data || [];

  return (
    <div className="screener-root page-fade-in">
      {/* Left panel */}
      <div className="screener-left">
        <div className="screener-topbar">
          <div>
            <h1 className="page-title">Resume Screener</h1>
            <p className="page-subtitle">AI-powered blind scoring via keyword RAG + Gemini</p>
          </div>
          <button className="btn-primary" onClick={() => setShowJobModal(true)}>+ New Job</button>
        </div>

        {/* Job selector */}
        <div className="job-selector">
          <label className="field-label-sm">Select Job to Screen Against</label>
          <select className="filter-select-lg" value={selectedJob}
            onChange={e => { setSelectedJob(e.target.value); setSelectedResume(null); }}>
            <option value="">— Choose a job posting —</option>
            {(jobsData||[]).map(j => (
              <option key={j._id} value={j._id}>{j.title} · {j.department}</option>
            ))}
          </select>
        </div>

        {/* Upload zone */}
        {selectedJob && (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
            onClick={() => !uploading && fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }}
              onChange={e => handleFile(e.target.files[0])} />
            {uploading ? (
              <div className="upload-processing">
                <div className="upload-spinner" />
                <div>
                  <div style={{ color:'#e0e0f0', fontWeight:600, fontSize:14 }}>Screening resume...</div>
                  <div style={{ color:'#555570', fontSize:12, marginTop:4 }}>Chunking → RAG retrieval → Gemini scoring</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
                <div style={{ color:'#9090b0', fontSize:14, fontWeight:500 }}>Drop PDF here or click to upload</div>
                <div style={{ color:'#44445a', fontSize:12, marginTop:4 }}>Max 5MB · PDF only · Blind scored automatically</div>
              </>
            )}
          </div>
        )}
        {uploadError && <div className="upload-error">⚠ {uploadError}</div>}

        {/* Resume list */}
        {selectedJob && (
          <div className="resume-list">
            {isLoading ? (
              <div className="list-loading">Loading resumes...</div>
            ) : resumes.length === 0 ? (
              <div className="list-empty">
                <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
                <p>No resumes screened yet. Upload the first one!</p>
              </div>
            ) : (
              <>
                <div className="list-header">
                  {resumes.length} resume{resumes.length !== 1 ? 's' : ''} · sorted by score
                </div>
                {resumes.map((r, idx) => (
                  <div key={r._id}
                    className={`resume-card ${selectedResume?._id === r._id ? 'selected' : ''}`}
                    onClick={() => setSelectedResume(r)}>
                    <div className="resume-rank">#{idx+1}</div>
                    <ScoreRing score={r.blindScore} size={52} />
                    <div className="resume-meta">
                      <div className="resume-filename">{r.originalFileName}</div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
                        <RecBadge rec={r.aiEvaluation?.recommendation} />
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <div className="resume-subscores">
                      <div className="subscore">
                        <span style={{ color:'#555570', fontSize:10 }}>Skills</span>
                        <span style={{ color:'#9090b0', fontSize:12, fontWeight:600 }}>{r.skillsMatch}%</span>
                      </div>
                      <div className="subscore">
                        <span style={{ color:'#555570', fontSize:10 }}>Exp</span>
                        <span style={{ color:'#9090b0', fontSize:12, fontWeight:600 }}>{r.experienceMatch}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {!selectedJob && (
          <div className="no-job-hint">
            <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
            <p>Select or create a job posting to start screening resumes</p>
          </div>
        )}
      </div>

      {/* Right panel — detail */}
      <div className={`screener-right ${selectedResume ? 'visible' : ''}`}>
        {selectedResume ? (
          <ResumeDetail
            resume={selectedResume}
            onShortlist={(id) => shortlistMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            onClose={() => setSelectedResume(null)}
          />
        ) : (
          <div className="detail-empty">
            <div style={{ fontSize:40, opacity:0.3 }}>📊</div>
            <p>Select a resume to view the full AI analysis</p>
          </div>
        )}
      </div>

      {showJobModal && (
        <CreateJobModal
          onClose={() => setShowJobModal(false)}
          onCreated={() => { setShowJobModal(false); qc.invalidateQueries(['screener-jobs']); }}
        />
      )}
    </div>
  );
}
