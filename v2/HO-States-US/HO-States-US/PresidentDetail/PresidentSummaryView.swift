import SwiftUI

/// The president's name, term, party, biography extract, Wikipedia link, and reaction picker —
/// the text content that `PresidentDetailView` fades in a few seconds after appearing.
struct PresidentSummaryView: View {
    let president: President
    @Environment(AppModel.self) private var appModel
    @State private var showingReactionPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("#\(president.order) \(president.name)").font(.system(.body, design: .monospaced))
            Text("\(president.term) · \(president.party)")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text(president.extract)
                .font(.body)
            if let articleURL = president.wikipediaArticleURL {
                Link(destination: articleURL) {
                    Label("Read on Wikipedia", systemImage: "book")
                }
                .font(.callout)
            }
            reactionControl
        }
    }

    private var reactionControl: some View {
        let currentReaction = appModel.reaction(for: president)

        return HStack(spacing: 12) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) {
                    showingReactionPicker.toggle()
                }
            } label: {
                Label(
                    currentReaction?.accessibilityLabel ?? "Add Reaction",
                    systemImage: currentReaction?.symbolName ?? "face.smiling"
                )
            }
            .font(.callout)

            if showingReactionPicker {
                ReactionPickerStrip(selected: currentReaction) { picked in
                    appModel.setReaction(picked, for: president)
                    withAnimation(.easeOut(duration: 0.2)) {
                        showingReactionPicker = false
                    }
                }
                .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
    }
}
