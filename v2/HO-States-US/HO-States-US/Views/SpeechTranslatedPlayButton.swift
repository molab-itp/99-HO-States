import SwiftUI
import Translation

/// A `SpeechPlayButton` for English `text` that, when the sample text on `SpeechSetupView` has
/// been translated into a non-English language, translates `text` into the selected speech
/// language before speaking it. Otherwise it speaks `text` as is. Speech also starts by itself
/// each time `autoPlays` turns on.
@available(iOS 18.0, *)
struct SpeechTranslatedPlayButton: View {
    let player: SpeechPlayer
    let text: String
    var autoPlays = false

    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage
    @AppStorage(SpeechSettings.sampleTextLanguageKey)
    private var sampleTextLanguage = SpeechSettings.defaultSampleTextLanguage

    /// Non-nil while a translation is running; setting it is what starts `translationTask`.
    @State private var configuration: TranslationSession.Configuration?
    /// `text` in `language`, kept so pause/continue and replays don't translate again.
    @State private var translatedText: String?

    private var translates: Bool {
        SpeechSettings.translatesBeforeSpeaking(sampleTextLanguage: sampleTextLanguage, language: language)
    }

    var body: some View {
        Button {
            play()
        } label: {
            if configuration != nil {
                ProgressView()
            } else {
                SpeechPlayLabel(isSpeaking: player.status == .speaking)
            }
        }
        .disabled(text.isEmpty || configuration != nil)
        .translationTask(configuration) { session in
            let source = text
            let spoken: String
            do {
                spoken = try await session.translate(source).targetText
            } catch {
                // Untranslatable (unsupported language, download declined): speak it as written.
                spoken = source
            }
            guard !Task.isCancelled, source == text else { return }
            translatedText = spoken
            configuration = nil
            player.toggle(spoken, language: language)
        }
        // A translation is only good for the text and language it was made from.
        .onChange(of: text) {
            reset()
        }
        .onChange(of: language) {
            reset()
        }
        .onChange(of: configuration != nil) {
            player.isPreparing = configuration != nil
        }
        .onChange(of: autoPlays) {
            if autoPlays, player.status == .idle, configuration == nil {
                play()
            }
        }
    }

    private func play() {
        guard translates else {
            player.toggle(text, language: language)
            return
        }
        if let translatedText {
            player.toggle(translatedText, language: language)
        } else {
            configuration = TranslationSession.Configuration(
                source: SpeechSettings.translationLanguage(for: SpeechSettings.defaultSampleTextLanguage),
                target: SpeechSettings.translationLanguage(for: language)
            )
        }
    }

    private func reset() {
        configuration = nil
        translatedText = nil
    }
}
