import { useCallback, useEffect, useRef, useState } from 'react';

// useSpeechSynthesis — React hook over the Web Speech API TTS (speechSynthesis).
//
// TTS is supported in every modern browser. The first call to
// `speechSynthesis.getVoices()` often returns [] until the `voiceschanged`
// event fires — we wait for it before picking a voice.
//
// Usage:
//   const { speak, cancel, speaking, supported, voices } = useSpeechSynthesis({ lang: 'en-US' });
//   speak('Hello, world.');
//
export default function useSpeechSynthesis({
  lang = 'en-US',
  rate = 1,
  pitch = 1,
  volume = 1,
} = {}) {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices,  setVoices]  = useState([]);
  const [speaking, setSpeaking] = useState(false);

  const utteranceRef = useRef(null);

  // ── Voice loading ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supported) return;

    const sync = () => {
      const list = window.speechSynthesis.getVoices() || [];
      setVoices(list);
    };

    sync();
    // Some browsers populate the list async.
    window.speechSynthesis.addEventListener('voiceschanged', sync);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync);
  }, [supported]);

  // Pick a voice that matches the requested lang; prefer a "natural" /
  // "neural" / "Google" voice if any of those are present (higher quality).
  const pickVoice = useCallback(() => {
    if (!voices.length) return null;

    const exact   = voices.filter(v => v.lang === lang);
    const partial = voices.filter(v => v.lang?.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]));
    const pool    = exact.length ? exact : partial.length ? partial : voices;

    const preferred = pool.find(v => /natural|neural|google|premium/i.test(v.name));
    return preferred || pool[0];
  }, [voices, lang]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback((text) => {
    if (!supported || !text) return;

    // Cancel any in-flight utterance so two AI replies don't talk over each other.
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = lang;
    utter.rate   = rate;
    utter.pitch  = pitch;
    utter.volume = volume;
    const voice = pickVoice();
    if (voice) utter.voice = voice;

    utter.onstart = () => setSpeaking(true);
    utter.onend   = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [supported, lang, rate, pitch, volume, pickVoice]);

  // Cancel any speech when the component unmounts — never leave audio playing
  // after the user navigates away.
  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speaking, voices, speak, cancel };
}
