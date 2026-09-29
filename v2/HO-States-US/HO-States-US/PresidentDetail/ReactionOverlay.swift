import SwiftUI

/// The president's reactions as a layer over the portrait: one row of emoji along the image's
/// bottom edge, in the order added. Laid over the fitted image by `ZoomableHeaderImage` and
/// `PresidentDrawingEditorView`, so it gets the photo's exact frame. The row shrinks to fit rather
/// than wrapping or clipping once there are more reactions than fit across.
struct ReactionOverlay: View {
    let president: President
    @Environment(AppModel.self) private var appModel

    var body: some View {
        let reactions = appModel.reactions(for: president)
        if !reactions.isEmpty {
            Text(reactions.map(\.emoji).joined(separator: " "))
                .font(.largeTitle)
                .lineLimit(1)
                .minimumScaleFactor(0.2)
                .shadow(color: .black.opacity(0.4), radius: 2)
                .padding(.horizontal, 8)
                .padding(.bottom, 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .accessibilityLabel(reactions.map(\.accessibilityLabel).joined(separator: ", "))
                // Decoration only — taps and strokes go through to the image or canvas beneath.
                .allowsHitTesting(false)
        }
    }
}
