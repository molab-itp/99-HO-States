import SwiftUI

/// The president's name, term, party, biography extract, Wikipedia link, and reaction picker —
/// the text content that `PresidentDetailView` fades in a few seconds after appearing.
struct PresidentSummaryView: View {
    let president: President
    @Environment(AppModel.self) private var appModel
    @State private var showingAddPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("#\(president.order) \(president.name)").font(.system(.body, design: .monospaced))
            reactionControl
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
        }
    }

    private var reactionControl: some View {
        // Ordered, and may contain repeats (each "+" press appends whatever was picked) — so
        // each icon needs an identity based on its position, not its value, for `ForEach`.
        let currentReactions = appModel.reactions(for: president)

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                ForEach(Array(currentReactions.enumerated()), id: \.offset) { _, reaction in
                    Image(systemName: reaction.symbolName)
                        .foregroundStyle(.tint)
                        .accessibilityLabel(reaction.accessibilityLabel)
                }

                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showingAddPicker.toggle()
                    }
                } label: {
                    Image(systemName: "plus.circle")
                }
                .accessibilityLabel("Add Reaction")

                Button {
                    appModel.removeLastReaction(for: president)
                } label: {
                    Image(systemName: "minus.circle")
                }
                .accessibilityLabel("Remove Reaction")
                .disabled(currentReactions.isEmpty)
            }
            .font(.callout)

            if showingAddPicker {
                // Always all 4 — unlike the earlier one-of-each version, repeats are allowed, so
                // there's nothing to filter out here.
                ReactionPickerStrip(options: PresidentReaction.allCases) { picked in
                    appModel.addReaction(picked, for: president)
                    withAnimation(.easeOut(duration: 0.2)) {
                        showingAddPicker = false
                    }
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}
