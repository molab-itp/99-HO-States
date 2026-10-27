// Port of Swift's `SpeechSettings`: persisted text-to-speech settings, chosen on
// `SpeechSetupScreen` and used by the detail screen. Languages are BCP 47 codes (e.g. "en-US"),
// as the Web Speech API's voices report them.

// How `SpeechSetupScreen` groups the languages, in display order. The last group also takes any
// supported language not named here.
const languageGroups = [
  { title: 'English', languages: ['en-US', 'en-GB', 'en-AU', 'en-IE', 'en-IN', 'en-ZA'] },
  { title: 'Chinese', languages: ['zh-CN', 'zh-TW', 'zh-HK'] },
  { title: 'Eastern European', languages: ['bg-BG', 'lt-LT', 'ro-RO', 'ru-RU', 'uk-UA'] },
  { title: 'Romance languages', languages: ['es-ES', 'es-MX', 'fr-FR', 'fr-CA', 'pt-BR', 'pt-PT', 'de-DE', 'it-IT'] },
  { title: 'Central European', languages: ['cs-CZ', 'hr-HR', 'hu-HU', 'pl-PL', 'sk-SK', 'sl-SI'] },
  { title: 'Dutch', languages: ['nl-NL', 'nl-BE'] },
  { title: 'Japanese / Korean', languages: ['ja-JP', 'ko-KR'] },
  { title: 'Nordic', languages: ['da-DK', 'fi-FI', 'nb-NO', 'sv-SE'] },
  { title: 'Middle East / Central Asia', languages: ['ar-001', 'he-IL', 'tr-TR', 'kk-KZ'] },
  { title: 'Southeast Asia', languages: ['id-ID', 'ms-MY', 'th-TH', 'vi-VN'] },
  { title: 'Other', languages: ['ca-ES', 'el-GR'] },
];

/** A voice's language as a BCP 47 code: some browsers (Android) report "en_US". */
export function voiceLanguage(voice) {
  return voice.lang.replace('_', '-');
}

function displayName(language) {
  try {
    // 'standard' names the region ("Spanish (Spain)", as iOS does) rather than "European Spanish".
    return new Intl.DisplayNames(undefined, { type: 'language', languageDisplay: 'standard' }).of(language) ?? language;
  } catch {
    return language;
  }
}

// Text ending in an initial or abbreviation, where `Intl.Segmenter` wrongly ends a sentence.
const sentenceAbbreviation = /(?:^|[\s(])(?:[A-Z]|c|ca|Jr|Sr|Dr|Mr|Mrs|St|Gen|Lt|Col|Capt)\.\s*$/;

function isEnglish(language) {
  return language.startsWith('en');
}

export const SpeechSettings = {
  languageKey: 'ho-states-us.speechLanguage',
  /** The browser's current language, used until one is picked. */
  defaultLanguage: () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US',

  // Whether the detail screen's slideshow speaks each extract as it plays, holding the advance to
  // the next slide until the speech is done.
  autoSpeakKey: 'ho-states-us.speechAutoSpeak',
  defaultAutoSpeak: false,

  // What Auto Speak speaks for each slide: 'summary' (the HOS's extract), 'name' (its order
  // and name) or 'caption' (the extract's first sentence; a Greatest figure's name and
  // description).
  autoSpeakModeKey: 'ho-states-us.speechAutoSpeakMode',
  autoSpeakModes: ['summary', 'name', 'caption'],
  defaultAutoSpeakMode: 'summary',
  autoSpeakModeTitle: (mode) => ({ name: 'Name', caption: 'Caption' })[mode] ?? 'Summary',

  /**
   * The first sentence of `text` (the extracts have no line breaks, so this stands in for their
   * first line), or all of it if no sentence boundary is found. `Intl.Segmenter` breaks after an
   * initial or abbreviation ("Harry S."), which Swift's `NLTokenizer` doesn't, so those
   * segments are joined to the next.
   */
  firstSentence(text) {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return text;
    let sentence = '';
    for (const { segment } of new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)) {
      sentence += segment;
      if (!sentenceAbbreviation.test(sentence)) break;
    }
    return sentence.trim() || text;
  },

  // The editable sample text on `SpeechSetupScreen`, and the speech language code it is currently
  // written in: English until it is translated there.
  sampleTextKey: 'ho-states-us.speechSampleText',
  sampleTextLanguageKey: 'ho-states-us.speechSampleTextLanguage',
  defaultSampleTextLanguage: 'en-US',
  defaultSampleText:
    'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.',
  // Where the default sample text comes from, linked beside the Sample Text header.
  sampleTextSourceURL: 'https://en.wikipedia.org/wiki/Gettysburg_Address',

  // The titles of the language groups `SpeechSetupScreen` shows the languages of, one per line;
  // the rest are collapsed to their title.
  shownGroupsKey: 'ho-states-us.speechShownLanguageGroups',
  defaultShownGroups: 'Chinese',
  shownGroups: (stored) => new Set(stored.split('\n').filter(Boolean)),
  storedShownGroups: (titles) => [...titles].sort().join('\n'),

  /** Every key above, for Landing's Reset App. */
  get allKeys() {
    return [this.languageKey, this.autoSpeakKey, this.autoSpeakModeKey, this.sampleTextKey, this.sampleTextLanguageKey, this.shownGroupsKey];
  },

  /**
   * `languageGroups` narrowed to the languages `voices` (the browser's speech voices) cover, with
   * groups left empty by that dropped.
   */
  supportedLanguageGroups(voices) {
    const supported = new Set(voices.map(voiceLanguage));
    const grouped = new Set(languageGroups.flatMap((group) => group.languages));
    const ungrouped = [...supported]
      .filter((language) => !grouped.has(language))
      .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }));
    return languageGroups
      .map((group, i) => {
        const languages = group.languages.filter((language) => supported.has(language));
        if (i === languageGroups.length - 1) languages.push(...ungrouped);
        return { title: group.title, languages };
      })
      .filter((group) => group.languages.length > 0);
  },

  isEnglish,
  displayName,

  /**
   * Whether English text is translated into `language` before it is spoken: on once the sample
   * text has been translated on `SpeechSetupScreen`, off again once it is back in English.
   */
  translatesBeforeSpeaking(sampleTextLanguage, language) {
    return !isEnglish(sampleTextLanguage) && !isEnglish(language);
  },

  /**
   * The translator's language for a speech language code. Translation is per language rather
   * than per region, except Chinese, which is split by script.
   */
  translationLanguage(speechLanguage) {
    switch (speechLanguage) {
      case 'zh-CN':
        return 'zh';
      case 'zh-TW':
      case 'zh-HK':
        return 'zh-Hant';
      default:
        return speechLanguage.split('-')[0];
    }
  },
};
