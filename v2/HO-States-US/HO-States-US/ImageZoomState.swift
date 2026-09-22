import CoreGraphics

/// Pinch-zoom/pan state for one president's portrait in `ZoomableHeaderImage`. `AppModel` keeps
/// one of these per president (and persists them across app launches, same as `reactions`), so
/// returning to a president shows the same zoom/pan as when it was last left instead of always
/// resetting to 1x.
struct ImageZoomState: Codable, Equatable {
    var scale: CGFloat
    var offset: CGSize
}
