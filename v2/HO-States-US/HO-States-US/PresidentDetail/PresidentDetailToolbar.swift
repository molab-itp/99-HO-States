import SwiftUI

/// The bottom toolbar's Previous / Play-Pause / Next buttons. Purely presentational — the
/// slideshow logic lives in `PresidentDetailView`.
struct PresidentDetailToolbar: ToolbarContent {
    let isSlideshowPaused: Bool
    let isPreviousDisabled: Bool
    let isNextDisabled: Bool
    let onPrevious: () -> Void
    let onPlayPause: () -> Void
    let onNext: () -> Void

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            Button(action: onPrevious) {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(isPreviousDisabled)

            Spacer()

            Button(action: onPlayPause) {
                Label(
                    isSlideshowPaused ? "Play" : "Pause",
                    systemImage: isSlideshowPaused ? "play.circle" : "pause.circle"
                )
            }

            Spacer()

            Button(action: onNext) {
                Label("Next", systemImage: "chevron.right")
            }
            .disabled(isNextDisabled)
        }
    }
}
