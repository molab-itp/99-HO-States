import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { SpeechSettings } from '../state/speechSettings.js';
import { useStoredString } from '../state/useStoredString.js';
import { canTranslate, translateText } from '../data/translator.js';

/**
 * Port of SpeechPlayButton.swift and SpeechTranslatedPlayButton.swift: a play/pause button that
 * speaks `text` through `player` in the language picked on `SpeechSetupScreen`. With
 * `translatesFirst`, English `text` is translated into that language before it is spoken, when
 * the sample text on `SpeechSetupScreen` has been translated into a non-English language (and the
 * browser can translate); otherwise `text` is spoken as is. Speech also starts by itself each
 * time `autoPlays` turns on. The owner of `player` is responsible for stopping it.
 */
export default function SpeechPlayButton({ player, text, translatesFirst = false, autoPlays = false }) {
  const [language] = useStoredString(SpeechSettings.languageKey, SpeechSettings.defaultLanguage());
  const [sampleTextLanguage] = useStoredString(
    SpeechSettings.sampleTextLanguageKey,
    SpeechSettings.defaultSampleTextLanguage,
  );
  const translates =
    translatesFirst && canTranslate() && SpeechSettings.translatesBeforeSpeaking(sampleTextLanguage, language);

  // `text` in `language`, kept so pause/continue and replays don't translate again.
  const [translatedText, setTranslatedText] = useState(null);
  // True from asking for a translation until it has been spoken (or abandoned).
  const [isTranslating, setIsTranslating] = useState(false);
  // Bumped whenever a running translation should be dropped, so its result is ignored.
  const requestRef = useRef(0);

  // A translation is only good for the text and language it was made from.
  useEffect(() => {
    requestRef.current += 1;
    setIsTranslating(false);
    setTranslatedText(null);
  }, [text, language]);

  const { setIsPreparing } = player;
  useEffect(() => {
    setIsPreparing(isTranslating);
  }, [isTranslating, setIsPreparing]);
  useEffect(
    () => () => {
      requestRef.current += 1;
      setIsPreparing(false);
    },
    [setIsPreparing],
  );

  function play() {
    if (!translates) {
      player.toggle(text, language);
      return;
    }
    if (translatedText !== null) {
      player.toggle(translatedText, language);
      return;
    }
    requestRef.current += 1;
    const request = requestRef.current;
    setIsTranslating(true);
    translateText(text, SpeechSettings.defaultSampleTextLanguage, language)
      // Untranslatable (unsupported language, model not downloadable): speak it as written.
      .catch(() => text)
      .then((spoken) => {
        if (requestRef.current !== request) return;
        setTranslatedText(spoken);
        setIsTranslating(false);
        player.toggle(spoken, language);
      });
  }

  useEffect(() => {
    if (autoPlays && player.status === 'idle' && !isTranslating) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlays]);

  const isSpeaking = player.status === 'speaking';
  return (
    <button
      type="button"
      className="speech-play-btn"
      aria-label={isSpeaking ? 'Pause Speech' : 'Play Speech'}
      aria-busy={isTranslating || undefined}
      disabled={!text || isTranslating}
      onClick={play}
    >
      {isTranslating ? (
        <span className="spinner" />
      ) : (
        <Icon name={isSpeaking ? 'pause-circle-fill' : 'play-circle-fill'} size={24} />
      )}
    </button>
  );
}
