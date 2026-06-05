import { useState, useRef, useEffect } from 'react';
import { askPolicyBot } from '../../api/policy';
import './HRBot.css';

const SUGGESTED = [
  'What is the leave policy?',
  'How do I apply for sick leave?',
  'What are the working hours?',
  'How do I claim internet allowance?',
  'What is the probation period?',
  'How do I apply for a promotion?',
];

const TypingDots = () => (
  <div className="typing-dots">
    <span /><span /><span />
  </div>
);

const Message = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`msg-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && (
        <div className="bot-avatar">🤖</div>
      )}
      <div className={`msg-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {/* Render newlines and bullet-like formatting */}
        {msg.content.split('\n').map((line, i) => (
          <p key={i} style={{ margin: '2px 0' }}>{line}</p>
        ))}
        {/* Sources */}
        {msg.sources?.length > 0 && (
          <div className="msg-sources">
            <span className="sources-label">📎 Sources:</span>
            {msg.sources.map((s, i) => (
              <span key={i} className="source-chip">{s}</span>
            ))}
          </div>
        )}
        <div className="msg-time">
          {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <div className="user-avatar">👤</div>
      )}
    </div>
  );
};

export default function HRBot() {
  const [messages, setMessages]   = useState([
    {
      role: 'bot',
      content: "Hi! I'm your HR Policy Assistant 👋\n\nI can answer questions about company policies, leave, payroll, benefits, and more — all based on our official policy documents.\n\nWhat would you like to know?",
      timestamp: new Date().toISOString(),
      sources: [],
    }
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput('');
    setError('');

    const userMsg = { role: 'user', content: q, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .slice(-6)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const res = await askPolicyBot({ question: q, conversationHistory: history });

      const botMsg = {
        role: 'bot',
        content: res.data.answer,
        sources: res.data.sources || [],
        chunksUsed: res.data.chunksUsed,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setError('Failed to get a response. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([{
    role: 'bot',
    content: "Chat cleared! I'm ready to answer your policy questions.",
    timestamp: new Date().toISOString(),
    sources: [],
  }]);

  return (
    <div className="hrbot-root page-fade-in">
      {/* Header */}
      <div className="hrbot-header">
        <div className="hrbot-brand">
          <div className="hrbot-icon">🤖</div>
          <div>
            <div className="hrbot-name">HR Policy Assistant</div>
            <div className="hrbot-status">
              <span className="status-dot" />
              Powered by Gemini + RAG
            </div>
          </div>
        </div>
        <button className="clear-btn" onClick={clearChat} title="Clear chat">
          🗑 Clear
        </button>
      </div>

      {/* Messages */}
      <div className="hrbot-messages">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div className="msg-row bot">
            <div className="bot-avatar">🤖</div>
            <div className="msg-bubble bot-bubble typing-bubble">
              <TypingDots />
            </div>
          </div>
        )}
        {error && <div className="bot-error">⚠ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — shown only when just the welcome message exists */}
      {messages.length === 1 && (
        <div className="suggestions">
          <div className="suggestions-label">Try asking:</div>
          <div className="suggestions-chips">
            {SUGGESTED.map(q => (
              <button key={q} className="suggestion-chip" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="hrbot-input-area">
        <div className="input-wrap">
          <textarea
            ref={inputRef}
            className="hrbot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about leave policy, benefits, payroll..."
            rows={1}
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={() => send()}
            disabled={!input.trim() || loading}
          >
            {loading ? <span className="send-spinner" /> : '↑'}
          </button>
        </div>
        <div className="input-hint">Press Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );
}
