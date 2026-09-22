import SwiftUI

/// The horizontal strip of reaction choices that pops up from `PresidentSummaryView`'s reaction
/// button: heart, thumbs up, thumbs down, question mark. Tapping the currently-selected reaction
/// again clears it (reports `nil` to `onPick`).
struct ReactionPickerStrip: View {
    let selected: PresidentReaction?
    let onPick: (PresidentReaction?) -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach(PresidentReaction.allCases, id: \.self) { reaction in
                Button {
                    onPick(reaction == selected ? nil : reaction)
                } label: {
                    Image(systemName: reaction.symbolName)
                        .font(.body)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(reaction == selected ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.1))
                        )
                }
                .accessibilityLabel(reaction.accessibilityLabel)
            }
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.08)))
    }
}
