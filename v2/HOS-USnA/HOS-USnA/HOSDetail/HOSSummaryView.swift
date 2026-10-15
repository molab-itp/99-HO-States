import SwiftUI

/// The HOS's name (with a play/pause button that speaks the extract, translated first when
/// `SpeechSetupView` has translation on), term, party, biography
/// extract, Wikipedia link, and the Greatest figures alive during its term — the text content that `HOSDetailView` fades in a few seconds after appearing.
/// `HOSDetailView` owns `speechPlayer` so its slideshow can wait for the speech, and turns
/// `autoSpeaks` on to have the extract spoken without the button being tapped. With `speaksName`
/// on (Auto Speak's Name mode) the order and name are spoken in place of the extract.
/// `onGreatestBottom` reports where each Greatest figure ends (by its index), in the
/// `coordinateSpace` the caller names, so Auto Scroll knows how far to go to scroll past it.
struct HOSSummaryView: View {
    let hos: HOS
    let speechPlayer: SpeechPlayer
    var autoSpeaks = false
    var speaksName = false
    var coordinateSpace: NamedCoordinateSpace = .scrollView
    var onGreatestBottom: (_ index: Int, _ maxY: Double) -> Void = { _, _ in }

    private var speechText: String {
        speaksName ? "\(hos.order) \(hos.name)" : hos.extract
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("#\(hos.order) \(hos.name)").font(.system(.body, design: .monospaced))
                Spacer()
                SpeechTranslatedPlayButton(player: speechPlayer, text: speechText, autoPlays: autoSpeaks)
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
            let greatest = GreatestRepository.people(for: hos)
            if !greatest.isEmpty {
                Divider()
                Text("100 Greatest of this period")
                    .font(.headline)
                LazyVStack(alignment: .leading, spacing: 32) {
                    ForEach(Array(greatest.enumerated()), id: \.element.id) { index, person in
                        GreatestFigureView(person: person)
                            .onGeometryChange(for: Double.self) {
                                $0.frame(in: coordinateSpace).maxY
                            } action: {
                                onGreatestBottom(index, $0)
                            }
                    }
                }
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
