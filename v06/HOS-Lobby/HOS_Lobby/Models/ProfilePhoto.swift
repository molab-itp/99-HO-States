import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A picked photo, encoded for upload: the full-resolution image and a small square thumbnail,
/// both JPEG. Re-encoding bakes in the EXIF orientation and drops the metadata (GPS location,
/// camera details), which would otherwise be public in the bucket.
struct ProfilePhoto: Sendable {
    let full: Data
    let thumb: Data

    /// Thumbnail edge in pixels: the list shows 44pt avatars, which is 132px at 3x.
    static let thumbPixels = 256

    enum ProcessingError: LocalizedError {
        case unreadableImage, encodingFailed

        var errorDescription: String? {
            switch self {
            case .unreadableImage: "That photo couldn't be read."
            case .encodingFailed: "That photo couldn't be converted to JPEG."
            }
        }
    }

    /// Decodes any format ImageIO reads (HEIC, JPEG, PNG, …). This is CPU-heavy for large photos,
    /// so call it off the main actor.
    init(imageData: Data) throws {
        guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0
        else { throw ProcessingError.unreadableImage }

        // Full resolution: the longest side stays at its original pixel count.
        let full = try Self.orientedImage(source, maxPixelSize: max(width, height))

        // Thumbnail: scale so the short side is `thumbPixels`, then crop the center square.
        let longSide = Self.thumbPixels * max(width, height) / min(width, height)
        let scaled = try Self.orientedImage(source, maxPixelSize: max(longSide, Self.thumbPixels))
        let side = min(scaled.width, scaled.height)
        let square = CGRect(x: (scaled.width - side) / 2, y: (scaled.height - side) / 2, width: side, height: side)
        guard let thumb = scaled.cropping(to: square) else { throw ProcessingError.encodingFailed }

        self.full = try Self.jpeg(full, quality: 0.9)
        self.thumb = try Self.jpeg(thumb, quality: 0.8)
    }

    /// The image upright (EXIF orientation applied), no larger than `maxPixelSize` on its long side.
    private static func orientedImage(_ source: CGImageSource, maxPixelSize: Int) throws -> CGImage {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { throw ProcessingError.unreadableImage }
        return image
    }

    private static func jpeg(_ image: CGImage, quality: Double) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil)
        else { throw ProcessingError.encodingFailed }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw ProcessingError.encodingFailed }
        return data as Data
    }
}
