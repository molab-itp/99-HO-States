import SwiftUI

/// A play/pause button that speaks `text` through `player` in the language picked on
/// `SpeechSetupView`. The owner of `player` is responsible for stopping it (e.g. on disappear).
struct SpeechPlayButton: View {
    let player: SpeechPlayer
    let text: String

    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage

    private var isSpeaking: Bool { player.status == .speaking }

    var body: some View {
        Button {
            player.toggle(text, language: language)
        } label: {
            SpeechPlayLabel(isSpeaking: isSpeaking)
        }
        .disabled(text.isEmpty)
    }
}

/// The play/pause icon shared by the speech buttons.
struct SpeechPlayLabel: View {
    let isSpeaking: Bool

    var body: some View {
        Label(isSpeaking ? "Pause Speech" : "Play Speech", systemImage: isSpeaking ? "pause.circle" : "play.circle")
            .labelStyle(.iconOnly)
            .font(.title2)
    }
}
