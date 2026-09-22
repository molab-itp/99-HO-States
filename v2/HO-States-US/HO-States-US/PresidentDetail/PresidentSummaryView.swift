import SwiftUI

/// The president's name, term, party, biography extract, Wikipedia link, and reaction picker —
/// the text content that `PresidentDetailView` fades in a few seconds after appearing.
struct PresidentSummaryView: View {
    let president: President
    @Environment(AppModel.self) private var appModel
    /// `nil` means neither picker is showing; only one (add or remove) can be open at once.
    @State private var activePicker: PickerKind?

    private enum PickerKind {
        case add
        case remove
    }

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
        let currentReactions = appModel.reactions(for: president)
        let addableReactions = PresidentReaction.allCases.filter { !currentReactions.contains($0) }

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                ForEach(PresidentReaction.allCases.filter(currentReactions.contains), id: \.self) { reaction in
                    Image(systemName: reaction.symbolName)
                        .foregroundStyle(.tint)
                        .accessibilityLabel(reaction.accessibilityLabel)
                }

                Button {
                    togglePicker(.add)
                } label: {
                    Image(systemName: "plus.circle")
                }
                .accessibilityLabel("Add Reaction")
                .disabled(addableReactions.isEmpty)

                Button {
                    togglePicker(.remove)
                } label: {
                    Image(systemName: "minus.circle")
                }
                .accessibilityLabel("Remove Reaction")
                .disabled(currentReactions.isEmpty)
            }
            .font(.callout)

            if let activePicker {
                ReactionPickerStrip(
                    options: activePicker == .add
                        ? addableReactions
                        : PresidentReaction.allCases.filter(currentReactions.contains)
                ) { picked in
                    switch activePicker {
                    case .add: appModel.addReaction(picked, for: president)
                    case .remove: appModel.removeReaction(picked, for: president)
                    }
                    withAnimation(.easeOut(duration: 0.2)) {
                        self.activePicker = nil
                    }
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private func togglePicker(_ kind: PickerKind) {
        withAnimation(.easeOut(duration: 0.2)) {
            activePicker = activePicker == kind ? nil : kind
        }
    }
}
