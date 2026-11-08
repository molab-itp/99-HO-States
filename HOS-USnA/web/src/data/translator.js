import { SpeechSettings } from '../state/speechSettings.js';

// Stand-in for iOS's Translation framework: the browser's built-in, on-device Translator API.
// Only some browsers have it (Chrome on desktop at the time of writing), so everything that
// translates is hidden or skipped where `canTranslate()` is false — the way the Swift app gates
// translation behind `#available(iOS 18.0, *)`.

export function canTranslate() {
  return typeof self !== 'undefined' && 'Translator' in self;
}

/**
 * `text` translated from one speech language (e.g. "en-US") into another. Rejects when the
 * language pair is unsupported or its model can't be fetched.
 */
export async function translateText(text, sourceSpeechLanguage, targetSpeechLanguage) {
  const translator = await self.Translator.create({
    sourceLanguage: SpeechSettings.translationLanguage(sourceSpeechLanguage),
    targetLanguage: SpeechSettings.translationLanguage(targetSpeechLanguage),
  });
  try {
    return await translator.translate(text);
  } finally {
    translator.destroy?.();
  }
}
