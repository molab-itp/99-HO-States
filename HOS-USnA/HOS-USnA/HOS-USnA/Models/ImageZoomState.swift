import CoreGraphics

/// Pinch-zoom/pan state for one HOS's portrait in `ZoomableHeaderImage`. `AppModel` keeps
/// one of these per HOS (and persists them across app launches, same as `reactions`), so
/// returning to an HOS shows the same zoom/pan as when it was last left instead of always
/// resetting to 1x.
struct ImageZoomState: Codable, Equatable {
    var scale: CGFloat
    var offset: CGSize
}
