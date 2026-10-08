import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import SpeechPlayButton from '../components/SpeechPlayButton.jsx';
import { SpeechSettings } from '../state/speechSettings.js';
import { useSpeechPlayer, useSpeechVoices } from '../state/useSpeechPlayer.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredString } from '../state/useStoredString.js';
import { canTranslate, translateText } from '../data/translator.js';

/**
 * Port of SpeechSetupView.swift — text-to-speech settings: lists the languages the browser has a
 * voice for in groups, lets one be picked (used by the detail screen's speech button), and plays
 * editable sample text back in it — optionally translated into that language first, which also
 * turns on translation of the extract the detail screen speaks. Also holds the Auto Speak toggle
 * for the detail screen's slideshow. Pushed from Landing.
 */
export default function SpeechSetupScreen({ onBack }) {
  const [language, setLanguage] = useStoredString(SpeechSettings.languageKey, SpeechSettings.defaultLanguage());
  const [sampleText, setSampleText] = useStoredString(SpeechSettings.sampleTextKey, SpeechSettings.defaultSampleText);
  // The language `sampleText` is currently written in: English until Translate is used.
  const [sampleTextLanguage, setSampleTextLanguage] = useStoredString(
    SpeechSettings.sampleTextLanguageKey,
    SpeechSettings.defaultSampleTextLanguage,
  );
  const [autoSpeak, setAutoSpeak] = useStoredBoolean(SpeechSettings.autoSpeakKey, SpeechSettings.defaultAutoSpeak);
  const player = useSpeechPlayer();
  const voices = useSpeechVoices();
  const languageGroups = useMemo(() => SpeechSettings.supportedLanguageGroups(voices), [voices]);

  // Speech in progress is in the old language (or of the old text), so start over.
  const { stop } = player;
  useEffect(() => {
    stop();
  }, [language, sampleText, stop]);

  return (
    <div className="screen-scroll list-screen">
      <NavBar title="Speak" onBack={onBack} />
      <div className="list-group speech-setup">
        <section>
          <ul className="hos-list">
            <li>
              <label className="toggle-row speech-row">
                <span>Auto Speak</span>
                <span className="switch">
                  <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
                  <span className="switch-track" />
                  <span className="switch-thumb" />
                </span>
              </label>
            </li>
          </ul>
          <p className="credits-footer">
            While the slideshow plays, speaks each summary and waits for it to finish before advancing.
          </p>
        </section>

        <section>
          {/* Tapping the header puts back the default (English) sample text. */}
          <button
            className="speech-section-title"
            title="Restores the default text"
            onClick={() => {
              setSampleText(SpeechSettings.defaultSampleText);
              setSampleTextLanguage(SpeechSettings.defaultSampleTextLanguage);
            }}
          >
            Sample Text
          </button>
          <ul className="hos-list">
            <li className="speech-row speech-sample">
              <textarea
                aria-label="Sample Text"
                placeholder="Sample Text"
                rows={4}
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
              />
              <SpeechPlayButton player={player} text={sampleText} />
            </li>
            {canTranslate() && (
              <li className="speech-row">
                <SpeechTranslateButton
                  text={sampleText}
                  textLanguage={sampleTextLanguage}
                  language={language}
                  onTranslated={(text, textLanguage) => {
                    setSampleText(text);
                    setSampleTextLanguage(textLanguage);
                  }}
                />
              </li>
            )}
          </ul>
        </section>

        {languageGroups.length === 0 && <p className="credits-footer">This browser has no speech voices.</p>}
        {languageGroups.map((group) => (
          <section key={group.title}>
            <h2 className="speech-section-title">{group.title}</h2>
            <ul className="hos-list">
              {group.languages.map((code) => (
                <li key={code}>
                  <button
                    className="language-row"
                    aria-pressed={code === language}
                    onClick={() => setLanguage(code)}
                  >
                    <span className="names">
                      <span>{SpeechSettings.displayName(code)}</span>
                      <span className="code">{code}</span>
                    </span>
                    {code === language && <Icon name="check" size={18} className="language-check" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Port of SpeechTranslateButton.swift: translates `text` from English into the selected speech
 * `language`, or — once it has been translated — back into English. `textLanguage` is the speech
 * language code (e.g. "es-ES") `text` is currently written in; `onTranslated(text, textLanguage)`
 * hands back the result.
 */
function SpeechTranslateButton({ text, textLanguage, language, onTranslated }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const isTextEnglish = SpeechSettings.isEnglish(textLanguage);
  // Speech language code the button translates `text` into.
  const targetLanguage = isTextEnglish ? language : SpeechSettings.defaultSampleTextLanguage;

  async function translate() {
    setIsTranslating(true);
    try {
      onTranslated(await translateText(text, textLanguage, targetLanguage), targetLanguage);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(`Couldn't translate: ${error?.message ?? error}`);
    }
    setIsTranslating(false);
  }

  return (
    <div className="speech-translate">
      <button
        className="speech-translate-btn"
        disabled={!text || isTranslating || SpeechSettings.isEnglish(targetLanguage) === isTextEnglish}
        onClick={translate}
      >
        Translate to {isTextEnglish ? SpeechSettings.displayName(language) : 'English'}
      </button>
      {errorMessage && <p className="speech-error">{errorMessage}</p>}
    </div>
  );
}
