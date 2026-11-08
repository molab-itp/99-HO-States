import SwiftUI

/// The HOS's name (with a play/pause button that speaks the extract, translated first when
/// `SpeechSetupView` has translation on), term, party, biography
/// extract, Wikipedia link, and the Greatest figures alive during its term (led by one
/// `AppModel` hasn't shown lately) — the text content that `HOSDetailView` fades in a few seconds after appearing.
/// `HOSDetailView` owns `speechPlayer` so its slideshow can wait for the speech, and turns
/// `autoSpeaks` on to have the extract spoken without the button being tapped. `speechMode` (Auto
/// Speak's mode) swaps the extract for the order and name, or for the extract's first sentence.
/// `autoSpokenGreatest` has the Greatest figure at that index spoken the same way.
/// `onExtractBottom` reports where the extract ends, and `onGreatestFrame` where each Greatest
/// figure starts and ends (by its index), in the `coordinateSpace` the caller names, so Auto
/// Scroll knows how far to go to bring them into view.
struct HOSSummaryView: View {
    @Environment(AppModel.self) private var appModel
    let hos: HOS
    let speechPlayer: SpeechPlayer
    var autoSpeaks = false
    var autoSpokenGreatest: Int? = nil
    var speechMode = SpeechSettings.AutoSpeakMode.summary
    var coordinateSpace: NamedCoordinateSpace = .scrollView
    var onExtractBottom: (_ maxY: Double) -> Void = { _ in }
    var onGreatestFrame: (_ index: Int, _ frame: ClosedRange<Double>) -> Void = { _, _ in }

    private var speechText: String {
        switch speechMode {
        case .summary: hos.extract
        case .name: "\(hos.order) \(hos.name)"
        case .caption: SpeechSettings.firstSentence(of: hos.extract)
        }
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
                .onGeometryChange(for: Double.self) {
                    $0.frame(in: coordinateSpace).maxY
                } action: {
                    onExtractBottom($0)
                }
            if let articleURL = hos.wikipediaArticleURL {
                Link(destination: articleURL) {
                    Label("Source", systemImage: "book")
                }
                .font(.callout)
            }
            let greatest = appModel.greatestPeople(for: hos)
            if !greatest.isEmpty {
                Divider()
                HStack {
                    Text("100 Greatest of this period")
                        .font(.headline)
                    Spacer()
                    Link(destination: URL(string: "https://en.wikipedia.org/wiki/100_Greatest_African_Americans")!) {
                        Label("Source", systemImage: "book")
                    }
                    .font(.callout)
                }
                LazyVStack(alignment: .leading, spacing: 32) {
                    ForEach(Array(greatest.enumerated()), id: \.element.id) { index, person in
                        GreatestFigureView(
                            person: person,
                            speechPlayer: speechPlayer,
                            autoSpeaks: autoSpokenGreatest == index,
                            speechMode: speechMode
                        )
                            .onGeometryChange(for: ClosedRange<Double>.self) {
                                let frame = $0.frame(in: coordinateSpace)
                                return frame.minY...frame.maxY
                            } action: {
                                onGreatestFrame(index, $0)
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
