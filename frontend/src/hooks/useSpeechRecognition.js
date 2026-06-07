import { useCallback, useEffect, useRef, useState } from 'react';

// useSpeechRecognition — thin React hook around the Web Speech API (STT).
//
// Browser support: SpeechRecognition is Chromium-only at the time of writing
// (Chrome, Edge, Opera). Firefox and Safari expose `undefined` — `supported`
// will report `false` and the caller should fall back to text input.
//
// Usage:
//   const { listening, transcript, interim, start, stop, reset, supported, error }
//     = useSpeechRecognition({ lang: 'en-US', onFinal: (text) => send(text) });
//
export default function useSpeechRecognition({
  lang = 'en-US',
  continuous = false,
  interimResults = true,
  onFinal,
} = {}) {
  const Recognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(Recognition);

  const recognitionRef = useRef(null);
  const onFinalRef     = useRef(onFinal);
  // Keep the latest onFinal in a ref so the recognition handlers (registered
  // once) always call the freshest callback without needing to re-create the
  // SpeechRecognition instance on every render.
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState(''); // last finalized phrase
  const [interim,    setInterim]    = useState(''); // live, in-progress text
  const [error,      setError]      = useState(null);

  // Build the recognition instance once. We can't reuse the same object after
  // .stop() in all browsers, so we recreate on every start().
  const build = useCallback(() => {
    const rec = new Recognition();
    rec.lang             = lang;
    rec.continuous       = continuous;
    rec.interimResults   = interimResults;
    rec.maxAlternatives  = 1;

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
        else                          interimText += piece;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setTranscript(finalText);
        setInterim('');
        if (onFinalRef.current) onFinalRef.current(finalText.trim());
      }
    };

    rec.onerror = (event) => {
      // 'no-speech' is harmless — the user just hasn't spoken yet. The caller
      // can decide whether to auto-restart; we leave that to the component.
      setError(event.error || 'speech-recognition-error');
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    return rec;
  }, [Recognition, lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!supported) return;
    setError(null);
    setTranscript('');
    setInterim('');
    const rec = build();
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      // start() throws if invoked while already started — ignore that case.
      if (e?.name !== 'InvalidStateError') setError(e.message || 'start-failed');
    }
  }, [supported, build]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* already stopped */ }
    }
    setListening(false);
    setInterim('');
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  // Clean up on unmount.
  useEffect(() => () => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.abort(); } catch { /* noop */ }
    }
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
