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
 * time `autoPlays` turns on. Several of these can share `player`: each shows only its own text's
 * speech, and a tap while another's is under way stops that and speaks this one's. The owner of
 * `player` is responsible for stopping it.
 */
export default function SpeechPlayButton({ player, text, translatesFirst = false, autoPlays = false }) {
  const [language] = useStoredString(SpeechSettings.languageKey, SpeechSettings.defaultLanguage());
  const [sampleTextLanguage] = useStoredString(
    SpeechSettings.sampleTextLanguageKey,
    SpeechSettings.defaultSampleTextLanguage,
  );
  const translates =
    translatesFirst && canTranslate() && SpeechSettings.translatesBeforeSpeaking(sampleTextLanguage, language);

  // `text` in `language`, kept so pause/continue and replays don't translate again. Stored with
  // what it was made from, so the render that brings new `text` never sees the old translation.
  const [translation, setTranslation] = useState(null);
  const translatedText =
    translation && translation.text === text && translation.language === language ? translation.spoken : null;
  // True from asking for a translation until it has been spoken (or abandoned).
  const [isTranslating, setIsTranslating] = useState(false);
  // Bumped whenever a running translation should be dropped, so its result is ignored.
  const requestRef = useRef(0);

  // A translation is only good for the text and language it was made from.
  useEffect(() => {
    requestRef.current += 1;
    setIsTranslating(false);
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

  // Whether `player` is speaking (or paused on) this button's text.
  const isPlayersText = player.text !== null && (player.text === text || player.text === translatedText);

  function play() {
    if (player.text !== null && !isPlayersText) player.stop();
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
        setTranslation({ text, language, spoken });
        setIsTranslating(false);
        player.toggle(spoken, language);
      });
  }

  // Keyed on `text` too, so a slideshow advancing while `autoPlays` stays on (Auto Scroll keeps
  // the details visible between slides) speaks each new slide. The status is read as of now,
  // since the owner's effect stopping the previous slide's speech runs in the same commit.
  const autoPlayText = autoPlays ? text : null;
  useEffect(() => {
    if (autoPlayText !== null && player.currentStatus() === 'idle' && !isTranslating) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayText]);

  const isSpeaking = player.status === 'speaking' && isPlayersText;
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
