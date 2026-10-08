import SwiftUI

/// The HOS's name (with a play/pause button that speaks the extract, translated first when
/// `SpeechSetupView` has translation on), term, party, biography
/// extract, and Wikipedia link — the text content that `HOSDetailView` fades in a few seconds after appearing.
struct HOSSummaryView: View {
    let hos: HOS

    @State private var speechPlayer = SpeechPlayer()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("#\(hos.order) \(hos.name)").font(.system(.body, design: .monospaced))
                Spacer()
                if #available(iOS 18.0, *) {
                    SpeechTranslatedPlayButton(player: speechPlayer, text: hos.extract)
                } else {
                    SpeechPlayButton(player: speechPlayer, text: hos.extract)
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
