import SwiftUI

/// The HOS's name (with a play/pause button that speaks the extract, translated first when
/// `SpeechSetupView` has translation on), term, party, biography
/// extract, and Wikipedia link — the text content that `HOSDetailView` fades in a few seconds after appearing.
/// `HOSDetailView` owns `speechPlayer` so its slideshow can wait for the speech, and turns
/// `autoSpeaks` on to have the extract spoken without the button being tapped. With `speaksName`
/// on (Auto Speak's Name mode) the order and name are spoken in place of the extract.
struct HOSSummaryView: View {
    let hos: HOS
    let speechPlayer: SpeechPlayer
    var autoSpeaks = false
    var speaksName = false

    private var speechText: String {
        speaksName ? "\(hos.order) \(hos.name)" : hos.extract
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("#\(hos.order) \(hos.name)").font(.system(.body, design: .monospaced))
                Spacer()
                if #available(iOS 18.0, *) {
                    SpeechTranslatedPlayButton(player: speechPlayer, text: speechText, autoPlays: autoSpeaks)
                } else {
                    SpeechPlayButton(player: speechPlayer, text: speechText, autoPlays: autoSpeaks)
                }
            }
            Text("\(hos.term) · \(hos.party)")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text(hos.extract)
                .font(.body)
            if let articleURL = hos.wikipediaArticleURL {
                Link(destination: articleURL) {
                    Label("Read on Wikipedia", systemImage: "book")
                }
                .font(.callout)
            }
        }
        // This view outlives the HOS it shows (Next/Previous/slideshow just swap `hos`), so
        // speech for the previous one has to be stopped here as well as on disappear.
        .onChange(of: hos.id) {
            speechPlayer.stop()
        }
        .onDisappear {
            speechPlayer.stop()
        }
    }
}
