import SwiftUI

/// What the detail view's header shows: the portrait, the portrait with its saved drawing laid
/// over it, or the drawing alone. Chosen per HOS from the eye menu in
/// `HOSDetailView`'s toolbar and kept in `AppModel`.
enum DrawingDisplayMode: String, CaseIterable, Codable, Identifiable {
    case photo
    case photoAndDrawing
    case drawingOnly

    var id: Self { self }

    var showsPhoto: Bool { self != .drawingOnly }
    var showsDrawing: Bool { self != .photo }

    var title: String {
        switch self {
        case .photo: "Photo"
        case .photoAndDrawing: "Photo + Drawing"
        case .drawingOnly: "Drawing Only"
        }
    }

    var systemImage: String {
        switch self {
        case .photo: "eye.slash"
        case .photoAndDrawing: "eye"
        case .drawingOnly: "scribble"
        }
    }
}

/// The HOS's portrait, with pinch-to-zoom, pan (once zoomed), and double-tap to toggle
/// between 1x and 2.5x. The caller gives this view a fresh identity (`.id(hos.id)`) each
/// time the HOS changes, so `scale`/`offset` start from `AppModel`'s persisted zoom state
/// for that specific HOS (seeded `onAppear`, since `@Environment` isn't available in
/// `init`) rather than always resetting to 1x/no-offset.
struct ZoomableHeaderImage: View {
    let hos: HOS
    /// Whether the portrait and/or its saved drawing (if any) are shown.
    var displayMode: DrawingDisplayMode = .photoAndDrawing
    /// When set, the view fades in over this many seconds on first appearance instead of
    /// appearing at once. `HOSDetailView` sets it while the slideshow plays, for the incoming
    /// half of its cross-fade.
    var fadeInSecs: Double?
    /// When set, the portrait first appears at 1x and — once any fade-in has finished —
    /// animates to its saved zoom/pan over this many seconds, instead of appearing already
    /// zoomed. `HOSDetailView` sets it while the slideshow plays with Landing's Animated toggle on.
    var zoomInSecs: Double?
    @Environment(AppModel.self) private var appModel

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var hasAppeared = false
    @State private var isRevealed = false
    private let minScale: CGFloat = 1
    private let maxScale: CGFloat = 30

    var body: some View {
        Group {
            if let name = hos.largeImageName ?? hos.thumbnailImageName, let image = imageIfAvailable(name) {
                // With no drawing to show (and so no eye menu to change modes), always show the photo.
                let showsPhoto = displayMode.showsPhoto || appModel.drawingImage(for: hos) == nil
                let scaledImage = image
                    .resizable()
                    .scaledToFit()
                    // Hidden with opacity rather than removed, so the portrait still sizes the
                    // frame and the drawing lands exactly where it would over the photo. The
                    // white backing gives the ink a paper to sit on (and stays visible in dark mode).
                    .opacity(showsPhoto ? 1 : 0)
                    .background {
                        if !showsPhoto { Color.white }
                    }
                    // The drawing PNG has the portrait's aspect ratio, so fitting it into the same
                    // frame lines it up exactly, and applying it before `scaleEffect`/`offset`
                    // makes it zoom and pan together with the photo.
                    .overlay {
                        if displayMode.showsDrawing, let drawing = appModel.drawingImage(for: hos) {
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
                    // Reactions go after the zoom/pan and clip, so they stay pinned along the
                    // bottom edge of the visible frame instead of moving with the photo.
                    .overlay { ReactionOverlay(hos: hos) }
                    // clipShape only clips drawing, not hit-testing: without this the scaled/offset
                    // content still receives touches outside the visible frame, so drags starting
                    // on neighboring views (progress bar, summary text) would pan the image.
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                    .onTapGesture(count: 2) { toggleZoom() }

                // Panning only makes sense once zoomed in; disabling the drag gesture at 1x
                // (rather than just no-op'ing inside it) keeps the enclosing ScrollView's own
                // vertical drag free to scroll the page normally when the image isn't zoomed.
                // Disabled via `isEnabled` rather than an if/else over two gesture setups: switching
                // branches swaps in a new view, which skips the fade-in when a saved zoom is applied.
                scaledImage
                    .gesture(magnifyGesture)
                    .simultaneousGesture(panGesture, isEnabled: scale > minScale)
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
        .opacity(fadeInSecs == nil || isRevealed ? 1 : 0)
        .onAppear {
            // Only the first appearance fades/animates; returning from the drawing editor doesn't
            // replay it. Each step sets its own transaction, so nothing inherited from the HOS
            // change can merge the fade and the zoom into one animation.
            let isFirstAppearance = !hasAppeared
            hasAppeared = true
            let saved = appModel.imageZoomState(for: hos)
            let animatesZoom = isFirstAppearance && zoomInSecs != nil
            if let saved, !animatesZoom {
                // Not animated: jump straight to the saved zoom, so the fade reveals the zoomed view.
                withTransaction(Transaction(animation: nil)) {
                    scale = saved.scale
                    offset = saved.offset
                }
            }
            if let saved {
                lastScale = saved.scale
                lastOffset = saved.offset
            }
            guard isFirstAppearance else { return }
            if let fadeInSecs {
                withAnimation(.easeInOut(duration: fadeInSecs)) { isRevealed = true }
            }
            if let saved, let zoomInSecs {
                // Animated: fade in the full photo first, then pan/zoom to the saved view.
                withAnimation(.easeInOut(duration: zoomInSecs).delay(fadeInSecs ?? 0)) {
                    scale = saved.scale
                    offset = saved.offset
                }
            }
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

    /// Writes the current scale/offset to `AppModel`, keyed to this specific HOS — or
    /// clears its entry once back at the 1x/no-offset default, so a never-zoomed or reset
    /// HOS doesn't linger as a redundant stored state.
    private func persistZoom() {
        if scale <= minScale && offset == .zero {
            appModel.setImageZoomState(nil, for: hos)
        } else {
            appModel.setImageZoomState(ImageZoomState(scale: scale, offset: offset), for: hos)
        }
    }
}
