import SwiftUI

/// The president's portrait, with pinch-to-zoom, pan (once zoomed), and double-tap to toggle
/// between 1x and 2.5x. The caller gives this view a fresh identity (`.id(president.id)`) each
/// time the president changes, so `scale`/`offset` start from `AppModel`'s persisted zoom state
/// for that specific president (seeded `onAppear`, since `@Environment` isn't available in
/// `init`) rather than always resetting to 1x/no-offset.
struct ZoomableHeaderImage: View {
    let president: President
    @Environment(AppModel.self) private var appModel

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    private let minScale: CGFloat = 1
    private let maxScale: CGFloat = 30

    var body: some View {
        Group {
            if let name = president.largeImageName ?? president.thumbnailImageName, let image = imageIfAvailable(name) {
                let scaledImage = image
                    .resizable()
                    .scaledToFit()
                    // The drawing PNG has the portrait's aspect ratio, so fitting it into the same
                    // frame lines it up exactly, and applying it before `scaleEffect`/`offset`
                    // makes it zoom and pan together with the photo.
                    .overlay {
                        if let drawing = appModel.drawingImage(for: president) {
                            Image(uiImage: drawing)
                                .resizable()
                                .scaledToFit()
                        }
                    }
                    .frame(maxWidth: .infinity)
                    // Scale/offset are applied *before* the clip below, so the clip's rounded-rect
                    // bounds stay fixed to the original frame while the pinched/panned content moves
                    // underneath it, instead of the corner radius itself zooming and drifting.
                    .scaleEffect(scale)
                    .offset(offset)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    // clipShape only clips drawing, not hit-testing: without this the scaled/offset
                    // content still receives touches outside the visible frame, so drags starting
                    // on neighboring views (progress bar, summary text) would pan the image.
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                    .onTapGesture(count: 2) { toggleZoom() }

                // Panning only makes sense once zoomed in; leaving the drag gesture off entirely at
                // 1x (rather than just no-op'ing inside it) keeps the enclosing ScrollView's own
                // vertical drag free to scroll the page normally when the image isn't zoomed.
                if scale > minScale {
                    scaledImage.gesture(magnifyGesture.simultaneously(with: panGesture))
                } else {
                    scaledImage.gesture(magnifyGesture)
                }
            } else {
                RoundedRectangle(cornerRadius: 12)
                    .fill(.secondary.opacity(0.2))
                    .frame(height: 220)
                    .overlay {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 64))
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .onAppear {
            guard let saved = appModel.imageZoomState(for: president) else { return }
            scale = saved.scale
            lastScale = saved.scale
            offset = saved.offset
            lastOffset = saved.offset
        }
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let newScale = lastScale * value.magnification
                scale = min(max(newScale, minScale), maxScale)
            }
            .onEnded { _ in
                lastScale = scale
                if scale <= minScale {
                    withAnimation(.easeOut(duration: 0.2)) {
                        resetZoom()
                    }
                }
                persistZoom()
            }
    }

    private var panGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                offset = CGSize(
                    width: lastOffset.width + value.translation.width,
                    height: lastOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                lastOffset = offset
                persistZoom()
            }
    }

    /// Double-tap toggles between 1x (reset) and a fixed 2.5x zoom, the common photo-viewer
    /// shorthand for "zoom in on roughly the middle" without requiring a pinch gesture.
    private func toggleZoom() {
        withAnimation(.easeOut(duration: 0.2)) {
            if scale > minScale {
                resetZoom()
            } else {
                scale = 2.5
                lastScale = 2.5
            }
        }
        persistZoom()
    }

    private func resetZoom() {
        scale = minScale
        lastScale = minScale
        offset = .zero
        lastOffset = .zero
    }

    /// Writes the current scale/offset to `AppModel`, keyed to this specific president — or
    /// clears its entry once back at the 1x/no-offset default, so a never-zoomed or reset
    /// president doesn't linger as a redundant stored state.
    private func persistZoom() {
        if scale <= minScale && offset == .zero {
            appModel.setImageZoomState(nil, for: president)
        } else {
            appModel.setImageZoomState(ImageZoomState(scale: scale, offset: offset), for: president)
        }
    }
}
