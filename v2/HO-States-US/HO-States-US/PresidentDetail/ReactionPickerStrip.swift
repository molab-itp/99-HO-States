import SwiftUI

/// The horizontal strip of reaction choices that pops up from `PresidentSummaryView`'s + button:
/// the quick-pick emoji in `options`, then a trailing ★ that asks for the full emoji sheet
/// (`onMore`) instead of picking anything itself.
struct ReactionPickerStrip: View {
    let options: [PresidentReaction]
    let onPick: (PresidentReaction) -> Void
    let onMore: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { reaction in
                Button {
                    onPick(reaction)
                } label: {
                    cell(Text(reaction.emoji))
                }
                .accessibilityLabel(reaction.accessibilityLabel)
            }

            Button(action: onMore) {
                cell(Text("★").foregroundStyle(.tint))
            }
            .accessibilityLabel("More Emoji")
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.08)))
    }

    private func cell(_ label: some View) -> some View {
        label
            .font(.title3)
            .frame(width: 36, height: 36)
            .background(Circle().fill(Color.secondary.opacity(0.1)))
    }
}
