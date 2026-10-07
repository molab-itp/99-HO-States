import AVFoundation
import Observation

/// Persisted text-to-speech settings, chosen on `SpeechSetupView` and used by `HOSSummaryView`.
enum SpeechSettings {
    static let languageKey = "speechLanguage"
    /// BCP 47 code (e.g. "en-US") of the device's current language, used until one is picked.
    static var defaultLanguage: String { AVSpeechSynthesisVoice.currentLanguageCode() }

    /// Every language `AVSpeechSynthesizer` has a voice for, as BCP 47 codes sorted by display name.
    static func supportedLanguages() -> [String] {
        Set(AVSpeechSynthesisVoice.speechVoices().map(\.language))
            .sorted { displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1)) == .orderedAscending }
    }

    static func displayName(for language: String) -> String {
        Locale.current.localizedString(forIdentifier: language) ?? language
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
