import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCandidateSession,
  candidateSendMessage,
  candidateEndSession,
  recordProctoringEvent,
} from '../api/candidate';
import './CandidateInterviewPage.css';

const MAX_TURNS = 8;

// ── Sub-components ────────────────────────────────────────────────────────────

function CompletionScreen({ analysis, jobTitle, candidateName }) {
  const verdictClass = {
    advance: 'cip-verdict-advance',
    hold:    'cip-verdict-hold',
    reject:  'cip-verdict-reject',
  }[analysis?.overallVerdict] || 'cip-verdict-hold';

  return (
    <div className="cip-center-screen">
      <div className="cip-success-icon">🎉</div>
      <h2>Interview Complete</h2>
      <p>
        Thank you, <strong>{candidateName}</strong>! Your interview for <strong>{jobTitle}</strong> has been
        submitted. Our team will review your responses and reach out with next steps.
      </p>
      {analysis && (
        <>
          <div className="cip-completion-scores">
            <div className="cip-score-pill">
              <span className="score-val">{analysis.communicationScore ?? '—'}</span>
              <span className="score-lbl">Communication</span>
            </div>
            <div className="cip-score-pill">
              <span className="score-val">{analysis.technicalScore ?? '—'}</span>
              <span className="score-lbl">Technical</span>
            </div>
            <div className="cip-score-pill">
              <span className="score-val">{analysis.confidenceScore ?? '—'}</span>
              <span className="score-lbl">Confidence</span>
            </div>
          </div>
          {analysis.overallVerdict && (
            <div className={`cip-verdict-badge ${verdictClass}`}>{analysis.overallVerdict}</div>
          )}
        </>
      )}
      <p style={{ marginTop: 12, fontSize: 13, color: '#44445a' }}>You may safely close this window.</p>
    </div>
  );
}

function ChatMessage({ turn }) {
  const isAI = turn.role === 'ai';
  const time  = turn.timestamp
    ? new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div className={`cip-message ${isAI ? 'ai' : 'candidate'}`}>
      <div className="cip-avatar">{isAI ? '🤖' : '👤'}</div>
      <div className="cip-bubble">
        <div className="cip-msg-role">{isAI ? 'Interviewer' : 'You'}</div>
        <div className="cip-msg-text">{turn.message}</div>
        {time && <div className="cip-msg-time">{time}</div>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CandidateInterviewPage() {
  const { token } = useParams();

  const [session,       setSession]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [completed,     setCompleted]     = useState(false);
  const [analysis,      setAnalysis]      = useState(null);
  const [jobTitle,      setJobTitle]      = useState('');
  const [candidateName, setCandidateName] = useState('Candidate');

  const [history,   setHistory]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending,   setSending]   = useState(false);

  // Proctoring
  const [proctoring,    setProctoring]    = useState({ tabSwitches: 0, focusLostEvents: 0, flagged: false });
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const lastEventTime = useRef({});
  const chatBottomRef = useRef(null);
  const bannerTimer   = useRef(null);

  // ── Load session ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    getCandidateSession(token)
      .then(res => {
        const data = res.data.data;
        setSession(data);
        setHistory(data.conversationHistory || []);
        setJobTitle(data.job?.title || 'Interview');
        setCandidateName(data.candidateName || 'Candidate');
        if (data.proctoring) {
          setProctoring({
            tabSwitches:     data.proctoring.tabSwitches || 0,
            focusLostEvents: data.proctoring.focusLostEvents || 0,
            flagged:         data.proctoring.flagged || false,
          });
        }
        if (data.sessionComplete) {
          setAnalysis(data.aiAnalysis);
          setCompleted(true);
        }
      })
      .catch(err => {
        const status = err.response?.status;
        setError({ code: status, message: err.response?.data?.message || 'Something went wrong.' });
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, sending]);

  // ── Proctoring ──────────────────────────────────────────────────────────────
  const fireProctoring = useCallback((type) => {
    if (completed) return;
    const now = Date.now();
    if (now - (lastEventTime.current[type] || 0) < 2000) return;
    lastEventTime.current[type] = now;
    recordProctoringEvent(token, { type, timestamp: new Date().toISOString() })
      .then(res => {
        const d = res.data.data;
        setProctoring({ tabSwitches: d.tabSwitches, focusLostEvents: d.focusLostEvents, flagged: d.flagged });
        setBannerMessage(`⚠ Tab switching detected and recorded. (Warning ${Math.min(d.tabSwitches + d.focusLostEvents, 3)}/3)`);
        setBannerVisible(true);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBannerVisible(false), 5000);
        if (d.flagged) setFlagModalOpen(true);
      })
      .catch(() => {});
  }, [token, completed]);

  useEffect(() => {
    if (!session || completed) return;
    const onVisibility = () => { if (document.hidden) fireProctoring('tab_switch'); };
    const onBlur       = ()  => fireProctoring('focus_lost');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [session, completed, fireProctoring]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const msg = inputText.trim();
    if (!msg || sending) return;
    setInputText('');
    setSending(true);

    const optimistic = { role: 'candidate', message: msg, timestamp: new Date() };
    setHistory(prev => [...prev, optimistic]);

    try {
      const res  = await candidateSendMessage(token, { message: msg });
      const data = res.data.data;
      setHistory(prev => [...prev, { role: 'ai', message: data.aiMessage, timestamp: new Date() }]);
      if (data.isLastTurn || data.status === 'completed') {
        setAnalysis(data.aiAnalysis);
        setCompleted(true);
      }
    } catch {
      setHistory(prev => prev.filter(t => t !== optimistic));
      setInputText(msg);
    } finally {
      setSending(false);
    }
  };

  const handleEnd = async () => {
    if (!window.confirm('End the interview early? Your responses so far will be analysed and submitted.')) return;
    setSending(true);
    try {
      const res = await candidateEndSession(token);
      setAnalysis(res.data.data.aiAnalysis);
      setCompleted(true);
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const candidateTurns = history.filter(t => t.role === 'candidate').length;
  const progressPct    = Math.min((candidateTurns / MAX_TURNS) * 100, 100);

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="cip-root">
      <div className="cip-center-screen"><div className="cip-spinner" /><p>Loading your interview...</p></div>
    </div>
  );

  if (error) return (
    <div className="cip-root">
      <div className="cip-center-screen">
        <div className="cip-error-icon">{error.code === 410 ? '⏰' : '🚫'}</div>
        <h2>{error.code === 410 ? 'Link Expired' : 'Invalid Link'}</h2>
        <p>{error.message}</p>
      </div>
    </div>
  );

  if (completed) return (
    <div className="cip-root">
      <CompletionScreen analysis={analysis} jobTitle={jobTitle} candidateName={candidateName} />
    </div>
  );

  return (
    <div className="cip-root">

      {bannerVisible && (
        <div className="cip-proctoring-banner">
          <span>{bannerMessage}</span>
          <button className="cip-banner-close" onClick={() => setBannerVisible(false)}>✕</button>
        </div>
      )}

      {flagModalOpen && (
        <div className="cip-modal-overlay">
          <div className="cip-modal">
            <h3>🚩 Session Flagged</h3>
            <p>Multiple tab switches have been detected. This has been recorded and flagged for the hiring team's review.</p>
            <button className="cip-modal-btn" onClick={() => setFlagModalOpen(false)}>Continue Interview</button>
          </div>
        </div>
      )}

      <div className="cip-interview-wrapper" style={{ paddingTop: bannerVisible ? 60 : 20 }}>

        <div className="cip-header">
          <div className="cip-brand">
            <div className="cip-brand-dot" />
            <span className="cip-brand-name">FWC HRMS · AI Interview</span>
          </div>
          <div className="cip-header-meta">
            <span className="cip-job-title">{jobTitle}</span>
            <span className="cip-candidate-name">{candidateName}</span>
          </div>
        </div>

        <div className="cip-progress-row">
          <div className="cip-progress-bar-bg">
            <div className="cip-progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="cip-turns-label">{candidateTurns}/{MAX_TURNS} questions answered</span>
        </div>

        <div className="cip-chat">
          {history.map((turn, i) => <ChatMessage key={i} turn={turn} />)}
          {sending && (
            <div className="cip-message ai">
              <div className="cip-avatar">🤖</div>
              <div className="cip-typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        <div className="cip-input-area">

          <div className="cip-text-row">
            <textarea
              className="cip-textarea"
              rows={2}
              placeholder="Type your answer here… (Enter to send, Shift+Enter for new line)"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={sending}
            />
            <button className="cip-send-btn" onClick={handleSend} disabled={sending || !inputText.trim()}>↑</button>
          </div>

          <div className="cip-end-row">
            <button className="cip-end-link" onClick={handleEnd} disabled={sending}>End interview early</button>
          </div>
        </div>
      </div>
    </div>
  );
}
