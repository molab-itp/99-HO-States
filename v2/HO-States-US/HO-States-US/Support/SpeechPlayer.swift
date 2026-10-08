import AVFoundation
import Observation

/// Persisted text-to-speech settings, chosen on `SpeechSetupView` and used by `HOSSummaryView`.
enum SpeechSettings {
    static let languageKey = "speechLanguage"
    /// BCP 47 code (e.g. "en-US") of the device's current language, used until one is picked.
    static var defaultLanguage: String { AVSpeechSynthesisVoice.currentLanguageCode() }

    /// The editable sample text on `SpeechSetupView`, and the speech language code it is
    /// currently written in: English until it is translated there.
    static let sampleTextKey = "speechSampleText"
    static let sampleTextLanguageKey = "speechSampleTextLanguage"
    static let defaultSampleTextLanguage = "en-US"
    static let defaultSampleText = "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal."

    /// A titled set of languages, as `SpeechSetupView` lists them.
    struct LanguageGroup: Identifiable {
        let title: String
        let languages: [String]
        var id: String { title }
    }

    /// How `SpeechSetupView` groups the languages, in display order. The last group also takes
    /// any supported language not named here.
    private static let languageGroups: [LanguageGroup] = [
        LanguageGroup(title: "English", languages: ["en-US", "en-GB", "en-AU", "en-IE", "en-IN", "en-ZA"]),
        LanguageGroup(title: "Spanish", languages: ["es-ES", "es-MX"]),
        LanguageGroup(title: "French", languages: ["fr-FR", "fr-CA"]),
        LanguageGroup(title: "German", languages: ["de-DE"]),
        LanguageGroup(title: "Italian", languages: ["it-IT"]),
        LanguageGroup(title: "Portuguese", languages: ["pt-BR", "pt-PT"]),
        LanguageGroup(title: "Dutch", languages: ["nl-NL", "nl-BE"]),
        LanguageGroup(title: "Chinese", languages: ["zh-CN", "zh-TW", "zh-HK"]),
        LanguageGroup(title: "Japanese / Korean", languages: ["ja-JP", "ko-KR"]),
        LanguageGroup(title: "Nordic", languages: ["da-DK", "fi-FI", "nb-NO", "sv-SE"]),
        LanguageGroup(title: "Central/Eastern European", languages: ["bg-BG", "cs-CZ", "hr-HR", "hu-HU", "lt-LT", "pl-PL", "ro-RO", "ru-RU", "sk-SK", "sl-SI", "uk-UA"]),
        LanguageGroup(title: "Indian languages", languages: ["hi-IN", "bn-IN", "kn-IN", "ta-IN", "te-IN"]),
        LanguageGroup(title: "Middle East / Central Asia", languages: ["ar-001", "he-IL", "tr-TR", "kk-KZ"]),
        LanguageGroup(title: "Southeast Asia", languages: ["id-ID", "ms-MY", "th-TH", "vi-VN"]),
        LanguageGroup(title: "Other", languages: ["ca-ES", "el-GR"]),
    ]

    /// `languageGroups` narrowed to the languages `AVSpeechSynthesizer` has a voice for on this
    /// device, with groups left empty by that dropped.
    static func supportedLanguageGroups() -> [LanguageGroup] {
        let supported = Set(AVSpeechSynthesisVoice.speechVoices().map(\.language))
        let grouped = Set(languageGroups.flatMap(\.languages))
        let ungrouped = supported.subtracting(grouped)
            .sorted { displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1)) == .orderedAscending }
        return languageGroups.map { group in
            var languages = group.languages.filter(supported.contains)
            if group.id == languageGroups.last?.id {
                languages += ungrouped
            }
            return LanguageGroup(title: group.title, languages: languages)
        }
        .filter { !$0.languages.isEmpty }
    }

    static func isEnglish(_ language: String) -> Bool {
        language.hasPrefix("en")
    }

    static func displayName(for language: String) -> String {
        Locale.current.localizedString(forIdentifier: language) ?? language
    }

    /// Whether English text is translated into `language` before it is spoken: on once the
    /// sample text has been translated on `SpeechSetupView`, off again once it is back in English.
    static func translatesBeforeSpeaking(sampleTextLanguage: String, language: String) -> Bool {
        !isEnglish(sampleTextLanguage) && !isEnglish(language)
    }

    /// The Translation framework's language for a speech language code. Translation models are
    /// per language rather than per region, except Chinese, which is split by script.
    static func translationLanguage(for speechLanguage: String) -> Locale.Language {
        switch speechLanguage {
        case "zh-CN":
            Locale.Language(identifier: "zh-Hans")
        case "zh-TW", "zh-HK":
            Locale.Language(identifier: "zh-Hant")
        default:
            Locale.Language(identifier: String(speechLanguage.prefix { $0 != "-" }))
        }
    }
}

/// Speaks one piece of text at a time through `AVSpeechSynthesizer`, exposing just enough state
/// for a play/pause button. Each view that speaks owns its own player and stops it on disappear.
@Observable
final class SpeechPlayer: NSObject, AVSpeechSynthesizerDelegate {
    enum Status {
        case idle
        case speaking
        case paused
    }

    private(set) var status: Status = .idle

    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    /// The utterance `status` describes. A stopped utterance's cancel callback can arrive after
    /// the next one has started, so the delegate ignores callbacks for anything but this one.
    @ObservationIgnored private var currentUtteranceID: ObjectIdentifier?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// Play/pause: starts speaking `text` when idle, otherwise pauses or continues what's playing.
    func toggle(_ text: String, language: String) {
        switch status {
        case .idle:
            speak(text, language: language)
        case .speaking:
            if synthesizer.pauseSpeaking(at: .immediate) {
                status = .paused
            }
        case .paused:
            if synthesizer.continueSpeaking() {
                status = .speaking
            }
        }
    }

    func stop() {
        currentUtteranceID = nil
        status = .idle
        synthesizer.stopSpeaking(at: .immediate)
    }

    private func speak(_ text: String, language: String) {
        guard !text.isEmpty else { return }
        // `.playback` so speech the user asked for is heard even with the ring switch on silent.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        currentUtteranceID = ObjectIdentifier(utterance)
        status = .speaking
        synthesizer.speak(utterance)
    }

    private func utteranceEnded(_ id: ObjectIdentifier) {
        guard id == currentUtteranceID else { return }
        currentUtteranceID = nil
        status = .idle
    }

    // MARK: - AVSpeechSynthesizerDelegate

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in utteranceEnded(id) }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in utteranceEnded(id) }
    }
}
