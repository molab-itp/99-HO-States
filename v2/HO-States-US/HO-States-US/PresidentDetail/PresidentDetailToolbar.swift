import SwiftUI

/// The bottom toolbar's Previous / center / Next buttons. The center button is "Random" outside a
/// slideshow, or Pause/Play while one is active — `onCenterButton` is expected to already encode
/// that branch, this view is purely presentational.
struct PresidentDetailToolbar: ToolbarContent {
    let isSlideshowActive: Bool
    let isSlideshowPaused: Bool
    let isPreviousDisabled: Bool
    let isNextDisabled: Bool
    let onPrevious: () -> Void
    let onCenterButton: () -> Void
    let onNext: () -> Void

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            Button(action: onPrevious) {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(isPreviousDisabled)

            Spacer()

            Button(action: onCenterButton) {
                if isSlideshowActive {
                    Label(
                        isSlideshowPaused ? "Play" : "Pause",
                        systemImage: isSlideshowPaused ? "play.circle" : "pause.circle"
                    )
                } else {
                    Label("Random", systemImage: "shuffle")
                }
            }

            Spacer()

            Button(action: onNext) {
                Label("Next", systemImage: "chevron.right")
            }
            .disabled(isNextDisabled)
        }
    }
}
