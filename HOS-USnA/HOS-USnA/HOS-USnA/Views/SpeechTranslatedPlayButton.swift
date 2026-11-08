import SwiftUI
import Translation

/// A `SpeechPlayButton` for English `text` that, when the sample text on `SpeechSetupView` has
/// been translated into a non-English language, translates `text` into the selected speech
/// language before speaking it. Otherwise it speaks `text` as is. Speech also starts by itself
/// each time `autoPlays` turns on. Several of these can share `player`: each shows only its own
/// text's speech, and a tap while another's is under way stops that and speaks this one's.
struct SpeechTranslatedPlayButton: View {
    let player: SpeechPlayer
    let text: String
    var autoPlays = false

    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage
    @AppStorage(SpeechSettings.sampleTextLanguageKey)
    private var sampleTextLanguage = SpeechSettings.defaultSampleTextLanguage

    /// What `translationTask` runs on. Made by the first translation and then kept: the task
    /// only runs when this changes, and setting it back to an equal value after `nil` doesn't
    /// count, so each later translation is started by `invalidate()` instead.
    @State private var configuration: TranslationSession.Configuration?
    /// True from asking for a translation until it has been spoken (or abandoned).
    @State private var isTranslating = false
    /// `text` in `language`, kept so pause/continue and replays don't translate again.
    @State private var translatedText: String?

    private var translates: Bool {
        SpeechSettings.translatesBeforeSpeaking(sampleTextLanguage: sampleTextLanguage, language: language)
    }

    var body: some View {
        Button {
            play()
        } label: {
            if isTranslating {
                ProgressView()
            } else {
                SpeechPlayLabel(isSpeaking: player.status == .speaking && isPlayersText)
            }
        }
        .disabled(text.isEmpty || isTranslating)
        .translationTask(configuration) { session in
            let source = text
            let spoken: String
            do {
                spoken = try await session.translate(source).targetText
            } catch {
                // Untranslatable (unsupported language, download declined): speak it as written.
                spoken = source
            }
            // `isTranslating` going false means the request was dropped (`reset`) while this ran.
            guard !Task.isCancelled, source == text, isTranslating else { return }
            translatedText = spoken
            isTranslating = false
            player.toggle(spoken, language: language)
        }
        // A translation is only good for the text and language it was made from.
        .onChange(of: text) {
            reset()
        }
        .onChange(of: language) {
            reset()
        }
        .onChange(of: isTranslating) {
            player.isPreparing = isTranslating
        }
        // Keyed on `text` too, so a slideshow advancing while `autoPlays` stays on (Auto Scroll
        // keeps the details visible between slides) speaks each new slide. A task rather than
        // `onChange` so it runs after this update's other handlers, including `HOSSummaryView`
        // stopping the previous slide's speech.
        .task(id: autoPlays ? text : nil) {
            if autoPlays, player.status == .idle, !isTranslating {
                play()
            }
        }
        // The translation task is cancelled when this goes off screen, so it won't finish.
        .onDisappear {
            reset()
        }
    }

    /// Whether `player` is speaking (or paused on) this button's text.
    private var isPlayersText: Bool {
        player.text != nil && (player.text == text || player.text == translatedText)
    }

    private func play() {
        if player.text != nil, !isPlayersText { player.stop() }
        guard translates else {
            player.toggle(text, language: language)
            return
        }
        if let translatedText {
            player.toggle(translatedText, language: language)
        } else {
            isTranslating = true
            let target = SpeechSettings.translationLanguage(for: language)
            if configuration == nil {
                configuration = TranslationSession.Configuration(
                    source: SpeechSettings.translationLanguage(for: SpeechSettings.defaultSampleTextLanguage),
                    target: target
                )
            } else {
                configuration?.target = target
                configuration?.invalidate()
            }
        }
    }

    private func reset() {
        isTranslating = false
        translatedText = nil
    }
}
