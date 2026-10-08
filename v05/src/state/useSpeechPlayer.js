import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { voiceLanguage } from './speechSettings.js';

function synthesizer() {
  return typeof window !== 'undefined' ? window.speechSynthesis : undefined;
}

/**
 * Port of SpeechPlayer.swift: speaks one piece of text at a time through the Web Speech API,
 * exposing just enough state for a play/pause button. `status` is 'idle', 'speaking' or
 * 'paused'. Each screen that speaks owns its own player; speech stops when that screen unmounts.
 * Where the browser has no speech synthesis, `toggle` does nothing and the player stays idle.
 */
export function useSpeechPlayer() {
  const [status, setStatusState] = useState('idle');
  // Set by a speech button while it gets text ready to speak (translating it), so `isBusy` covers
  // the gap between asking for speech and `status` leaving 'idle'.
  const [isPreparing, setIsPreparing] = useState(false);
  // Mirrors `status` so `toggle` can be called from a stale closure (a finished translation).
  const statusRef = useRef('idle');
  // The utterance `status` describes. A stopped utterance's end event can arrive after the next
  // one has started, so events for anything but this one are ignored.
  const utteranceRef = useRef(null);

  const setStatus = useCallback((next) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const stop = useCallback(() => {
    utteranceRef.current = null;
    setStatus('idle');
    synthesizer()?.cancel();
  }, [setStatus]);

  /** Play/pause: starts speaking `text` when idle, otherwise pauses or continues what's playing. */
  const toggle = useCallback(
    (text, language) => {
      const synth = synthesizer();
      if (!synth) return;
      if (statusRef.current === 'speaking') {
        synth.pause();
        setStatus('paused');
        return;
      }
      if (statusRef.current === 'paused') {
        synth.resume();
        setStatus('speaking');
        return;
      }
      if (!text) return;
      // Clears anything another player left queued, so this starts right away.
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      const voice = synth.getVoices().find((v) => voiceLanguage(v) === language);
      if (voice) utterance.voice = voice;
      // An error (e.g. the browser refusing speech it wasn't asked for by a tap) ends it too.
      const ended = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setStatus('idle');
      };
      utterance.onend = ended;
      utterance.onerror = ended;
      utteranceRef.current = utterance;
      setStatus('speaking');
      synth.speak(utterance);
    },
    [setStatus],
  );

  useEffect(
    () => () => {
      utteranceRef.current = null;
      synthesizer()?.cancel();
    },
    [],
  );

  return useMemo(
    () => ({
      status,
      isPreparing,
      setIsPreparing,
      /** Whether speech is on its way or in progress (paused included). */
      isBusy: isPreparing || status !== 'idle',
      toggle,
      stop,
    }),
    [status, isPreparing, toggle, stop],
  );
}

/** The browser's speech voices. Some browsers load them late, so this updates when they arrive. */
export function useSpeechVoices() {
  const [voices, setVoices] = useState(() => synthesizer()?.getVoices() ?? []);

  useEffect(() => {
    const synth = synthesizer();
    if (!synth) return undefined;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, []);

  return voices;
}
