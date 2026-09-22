import SwiftUI

/// The horizontal strip of reaction choices that pops up from `PresidentSummaryView`'s + or -
/// button. `options` is whichever subset actually makes sense for that action — the + button
/// shows reactions not yet added, the - button shows only ones currently present — so every
/// choice shown here is always a valid tap with no separate "already selected" state to track.
struct ReactionPickerStrip: View {
    let options: [PresidentReaction]
    let onPick: (PresidentReaction) -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { reaction in
                Button {
                    onPick(reaction)
                } label: {
                    Image(systemName: reaction.symbolName)
                        .font(.body)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Color.secondary.opacity(0.1)))
                }
                .accessibilityLabel(reaction.accessibilityLabel)
            }
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.08)))
    }
}
