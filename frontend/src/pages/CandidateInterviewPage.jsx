import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCandidateSession,
  candidateSendMessage,
  candidateEndSession,
  recordProctoringEvent,
} from '../api/candidate';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import useSpeechSynthesis   from '../hooks/useSpeechSynthesis';
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
        <div className="cip-msg-role">
          {isAI ? 'Interviewer' : 'You'}
          {!isAI && turn.isVoice && <span className="cip-voice-badge" title="Voice transcript">🎙</span>}
        </div>
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

  // ── Input mode (text vs voice) + TTS ─────────────────────────────────────
  // Default to text — it's universal and the safer starting point. Candidates
  // can flip to voice any time during the interview.
  const [inputMode,  setInputMode]  = useState('text');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Stop the browser's speechSynthesis when the user starts typing a new turn
  // mid-reply, so the AI question never talks over the candidate.
  const tts = useSpeechSynthesis({ lang: 'en-US' });
  useEffect(() => () => tts.cancel(), [tts.cancel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-speak AI replies when TTS is enabled. The most-recent message from the
  // AI is tracked so re-renders for unrelated state don't replay the prompt.
  const lastSpokenAiId = useRef(null);
  useEffect(() => {
    if (!ttsEnabled || !tts.supported) return;
    const lastAi = [...history].reverse().find(t => t.role === 'ai');
    if (!lastAi) return;
    const id = `${lastAi.timestamp}-${lastAi.message.slice(0, 24)}`;
    if (lastSpokenAiId.current === id) return;
    lastSpokenAiId.current = id;
    tts.speak(lastAi.message);
  }, [history, ttsEnabled, tts.supported, tts.speak]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proctoring
  const [, setProctoring]            = useState({ tabSwitches: 0, focusLostEvents: 0, flagged: false });
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
  // Shared by both text and voice paths. `isVoice` + `transcript` are attached
  // to the optimistic turn so the chat bubble shows the voice transcript in
  // the candidate's bubble, and so the backend can persist the transcript.
  const sendCandidateMessage = async (msg, { transcript, isVoice } = {}) => {
    if (!msg || sending) return;
    setSending(true);

    const optimistic = {
      role: 'candidate',
      message: msg,
      transcript: transcript || null,
      isVoice: Boolean(isVoice),
      timestamp: new Date(),
    };
    setHistory(prev => [...prev, optimistic]);

    try {
      const res  = await candidateSendMessage(token, { message: msg, transcript });
      const data = res.data.data;
      setHistory(prev => [...prev, { role: 'ai', message: data.aiMessage, timestamp: new Date() }]);
      if (data.isLastTurn || data.status === 'completed') {
        setAnalysis(data.aiAnalysis);
        setCompleted(true);
      }
    } catch {
      // Roll back the optimistic bubble and, for text mode, restore the draft.
      setHistory(prev => prev.filter(t => t !== optimistic));
      if (!isVoice) setInputText(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    const msg = inputText.trim();
    if (!msg) return;
    setInputText('');
    sendCandidateMessage(msg, { transcript: null, isVoice: false });
  };

  // Stable callback for STT final transcripts. Sends the captured text as the
  // candidate's answer with a `transcript` field attached for the backend.
  const handleVoiceFinal = useCallback((text) => {
    if (!text || sending) return;
    sendCandidateMessage(text, { transcript: text, isVoice: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending]);

  const stt = useSpeechRecognition({
    lang: 'en-US',
    continuous: false,
    interimResults: true,
    onFinal: handleVoiceFinal,
  });

  // Surface a one-time notice when the browser can't do STT. Derived directly
  // from props/state — no useState/useEffect needed.
  const sttNotice =
    inputMode === 'voice' && !stt.supported
      ? 'Voice input is only supported in Chrome, Edge, and Opera. Please switch to Text mode, or use a Chromium browser.'
      : null;

  const toggleMic = useCallback(() => {
    if (!stt.supported) return;
    if (stt.listening) {
      stt.stop();
    } else {
      // If a question is being read aloud, cut it off so the candidate can speak.
      tts.cancel();
      stt.start();
    }
  }, [stt, tts]);

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

          <div className="cip-input-toolbar">
            <div className="cip-mode-toggle" role="tablist" aria-label="Answer input mode">
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'text'}
                className={`cip-mode-btn ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => { setInputMode('text'); if (stt.listening) stt.stop(); tts.cancel(); }}
                disabled={sending}
              >
                <span className="cip-mode-icon">⌨</span> Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'voice'}
                className={`cip-mode-btn ${inputMode === 'voice' ? 'active' : ''}`}
                onClick={() => setInputMode('voice')}
                disabled={sending}
              >
                <span className="cip-mode-icon">🎙</span> Voice
              </button>
            </div>

            {tts.supported && (
              <label className="cip-tts-toggle" title="Read AI questions aloud">
                <input
                  type="checkbox"
                  checked={ttsEnabled}
                  onChange={e => {
                    const on = e.target.checked;
                    setTtsEnabled(on);
                    if (!on) tts.cancel();
                  }}
                />
                <span className="cip-tts-track"><span className="cip-tts-thumb" /></span>
                <span className="cip-tts-label">🔊 Read aloud</span>
              </label>
            )}
          </div>

          {inputMode === 'text' ? (
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
          ) : (
            <div className={`cip-voice-panel ${stt.listening ? 'listening' : ''}`}>
              {sttNotice && (
                <div className="cip-voice-notice" role="alert">⚠ {sttNotice}</div>
              )}

              <div className="cip-voice-transcript">
                {stt.interim || stt.transcript || (stt.listening ? 'Listening… speak your answer.' : 'Tap the mic to start speaking.')}
              </div>

              <div className="cip-voice-controls">
                <button
                  type="button"
                  className={`cip-mic-btn ${stt.listening ? 'on' : ''}`}
                  onClick={toggleMic}
                  disabled={!stt.supported || sending}
                  aria-label={stt.listening ? 'Stop recording' : 'Start recording'}
                  title={!stt.supported ? 'Voice input requires Chrome, Edge, or Opera' : (stt.listening ? 'Tap to send' : 'Tap to speak')}
                >
                  {stt.listening ? (
                    <span className="cip-mic-icon">⏹</span>
                  ) : (
                    <span className="cip-mic-icon">🎙</span>
                  )}
                  <span className="cip-mic-pulse" />
                </button>

                <div className="cip-voice-hint">
                  {stt.listening
                    ? 'Listening — your answer will be sent automatically when you pause.'
                    : 'Press the mic, then speak your answer.'}
                </div>
              </div>
            </div>
          )}

          <div className="cip-end-row">
            <button className="cip-end-link" onClick={handleEnd} disabled={sending}>End interview early</button>
          </div>
        </div>
      </div>
    </div>
  );
}
