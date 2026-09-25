import PencilKit
import UIKit

/// Reads and writes each president's photo drawing under Application Support/Photos: a PNG of
/// the ink (what `ZoomableHeaderImage` overlays on the portrait) plus the `PKDrawing` data it was
/// rendered from (so `PresidentDrawingEditorView` can reopen the strokes as editable ink rather
/// than a flattened picture). Both are stored in the portrait image's own point coordinates, not
/// the on-screen canvas's, so a drawing lines up with the photo at any screen size or rotation.
enum PresidentDrawingStore {
    private static let pngLongSide: CGFloat = 2048

    static func directoryURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Photos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func pngFileName(for id: President.ID) -> String {
        "president-\(id)-drawing.png"
    }

    private static func drawingDataURL(for id: President.ID) -> URL {
        directoryURL().appendingPathComponent("president-\(id)-drawing.pkdrawing")
    }

    static func loadImage(named fileName: String) -> UIImage? {
        UIImage(contentsOfFile: directoryURL().appendingPathComponent(fileName).path)
    }

    static func loadDrawing(for id: President.ID) -> PKDrawing? {
        guard let data = try? Data(contentsOf: drawingDataURL(for: id)) else { return nil }
        return try? PKDrawing(data: data)
    }

    /// Writes `drawing` (already in image coordinates, sized `imageSize`) as a transparent PNG
    /// plus its editable data, returning the PNG's file name for `AppModel` to link to the
    /// president. The PNG's long side is always `pngLongSide` pixels, whatever the portrait's own
    /// size: small thumbnails (~330pt) are scaled up so strokes stay crisp when zoomed, and the
    /// big "Large" portraits (up to ~3840×4662pt, since the catalog treats them as 1x) are scaled
    /// down — PencilKit's renderer aborts past ~8192px per side, and even under that limit a
    /// full-size render would be hundreds of MB.
    static func save(_ drawing: PKDrawing, imageSize: CGSize, for id: President.ID) throws -> String {
        let renderScale = pngLongSide / max(imageSize.width, imageSize.height, 1)
        var image = UIImage()
        // `PKDrawing.image` resolves ink colors against the current trait collection, so without
        // pinning it to light mode a black stroke would be saved as white in dark mode.
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            image = drawing.image(from: CGRect(origin: .zero, size: imageSize), scale: renderScale)
        }
        guard let png = image.pngData() else { throw CocoaError(.fileWriteUnknown) }

        let fileName = pngFileName(for: id)
        try png.write(to: directoryURL().appendingPathComponent(fileName), options: .atomic)
        try drawing.dataRepresentation().write(to: drawingDataURL(for: id), options: .atomic)
        return fileName
    }

    static func delete(for id: President.ID) {
        try? FileManager.default.removeItem(at: directoryURL().appendingPathComponent(pngFileName(for: id)))
        try? FileManager.default.removeItem(at: drawingDataURL(for: id))
    }
}
