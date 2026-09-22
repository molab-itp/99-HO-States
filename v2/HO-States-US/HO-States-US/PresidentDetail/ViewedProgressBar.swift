import SwiftUI

/// A segmented bar above the header image: one segment per president, filled left-to-right as
/// presidents are viewed. Filled segments cycle red/white/blue so progress reads as a strip of
/// bunting rather than a single flat color; white segments get a hairline outline since they'd
/// otherwise disappear against the background.
struct ViewedProgressBar: View {
    let total: Int
    var viewedPresidentIDs: Set<President.ID>

    private static let colors: [Color] = [.black, .green, .red, .yellow]
    private let segmentSpacing: CGFloat = 2

    var body: some View {
        HStack(spacing: segmentSpacing) {
            ForEach(0..<max(total, 1), id: \.self) { position in
                let color = Self.colors[position % Self.colors.count]
                let isViewed = viewedPresidentIDs.contains(position + 1)
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(isViewed ? color : Color.secondary.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 1.5)
                            .strokeBorder(Color.secondary.opacity(isViewed && color == .white ? 0.6 : 0), lineWidth: 1)
                    )
            }
        }
        .frame(height: 6)
        .accessibilityElement()
        .accessibilityLabel("Heads viewed")
        .accessibilityValue("\(viewedPresidentIDs.count) of \(total)")
    }
}
