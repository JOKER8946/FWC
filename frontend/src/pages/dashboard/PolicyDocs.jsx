import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPolicies, uploadPolicy, togglePolicy, deletePolicy } from '../../api/policy';
import './PolicyDocs.css';

const StatusDot = ({ active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 600,
    color: active ? '#10b981' : '#555570',
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#10b981' : '#555570' }} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

export default function PolicyDocs() {
  const qc = useQueryClient();
  const fileRef = useRef();

  const [form, setForm]         = useState({ title: '', version: '1.0', description: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => listPolicies().then(r => r.data.data),
  });

  const toggleMutation = useMutation({
    mutationFn: togglePolicy,
    onSuccess: () => qc.invalidateQueries(['policies']),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePolicy,
    onSuccess: () => qc.invalidateQueries(['policies']),
  });

  const handleFile = (file) => {
    if (file?.type !== 'application/pdf') {
      setUploadError('Only PDF files accepted.'); return;
    }
    setSelectedFile(file);
    setUploadError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) { setUploadError('Please select a PDF file.'); return; }
    if (!form.title.trim()) { setUploadError('Title is required.'); return; }

    setUploading(true); setUploadError(''); setUploadSuccess('');
    try {
      const fd = new FormData();
      fd.append('policy', selectedFile);
      fd.append('title', form.title);
      fd.append('version', form.version);
      fd.append('description', form.description);
      const res = await uploadPolicy(fd);
      setUploadSuccess(`✓ "${form.title}" uploaded and chunked into ${res.data.data.totalChunks} segments.`);
      setForm({ title: '', version: '1.0', description: '' });
      setSelectedFile(null);
      qc.invalidateQueries(['policies']);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const docs = data || [];

  return (
    <div className="policy-page page-fade-in">
      <h1 className="page-title">Policy Documents</h1>
      <p className="page-subtitle">Upload company policy PDFs — chunked automatically for the employee RAG bot</p>

      <div className="policy-layout">
        {/* ── Upload panel ──────────────────────────────────────────────────── */}
        <div className="upload-panel">
          <div className="panel-title">Upload New Policy</div>

          <form onSubmit={handleUpload} className="upload-form">
            {/* Drop zone */}
            <div
              className={`policy-drop-zone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
              {selectedFile ? (
                <>
                  <div style={{ fontSize: 28 }}>📄</div>
                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>{selectedFile.name}</div>
                  <div style={{ color: '#44445a', fontSize: 11 }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28 }}>📂</div>
                  <div style={{ color: '#9090b0', fontSize: 13, fontWeight: 500 }}>
                    Drop PDF here or click to browse
                  </div>
                  <div style={{ color: '#44445a', fontSize: 11 }}>Max 5MB · PDF only</div>
                </>
              )}
            </div>

            {/* Metadata fields */}
            <div className="upload-fields">
              <div className="form-field">
                <label>Document Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Employee Handbook 2025" required />
              </div>
              <div className="form-field">
                <label>Version</label>
                <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="1.0" style={{ width: 80 }} />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label>Description (optional)</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief summary of what this document covers" />
              </div>
            </div>

            {uploadError   && <div className="upload-error">⚠ {uploadError}</div>}
            {uploadSuccess && <div className="upload-success">{uploadSuccess}</div>}

            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="btn-spinner" /> Chunking & indexing...
                </span>
              ) : '⬆ Upload & Index'}
            </button>
          </form>
        </div>

        {/* ── Documents list ────────────────────────────────────────────────── */}
        <div className="docs-panel">
          <div className="panel-title">
            Indexed Documents
            <span className="docs-count">{docs.length}</span>
          </div>

          {isLoading ? (
            <div className="docs-loading">Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="docs-empty">
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <p>No policy documents uploaded yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Upload your first document to activate the employee RAG bot.</p>
            </div>
          ) : (
            <div className="docs-list">
              {docs.map(doc => (
                <div key={doc._id} className={`doc-card ${!doc.isActive ? 'inactive' : ''}`}>
                  <div className="doc-icon">📋</div>
                  <div className="doc-body">
                    <div className="doc-title">{doc.title}</div>
                    <div className="doc-meta">
                      <span>v{doc.version}</span>
                      <span>·</span>
                      <span>{doc.totalChunks} chunks</span>
                      <span>·</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {doc.description && (
                      <div className="doc-description">{doc.description}</div>
                    )}
                    <StatusDot active={doc.isActive} />
                  </div>
                  <div className="doc-actions">
                    <button className="doc-action-btn"
                      onClick={() => toggleMutation.mutate(doc._id)}
                      title={doc.isActive ? 'Deactivate' : 'Activate'}>
                      {doc.isActive ? '⏸' : '▶'}
                    </button>
                    <button className="doc-action-btn danger"
                      onClick={() => { if (window.confirm(`Delete "${doc.title}"?`)) deleteMutation.mutate(doc._id); }}
                      title="Delete">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
