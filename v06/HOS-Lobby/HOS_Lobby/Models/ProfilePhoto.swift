import CoreGraphics
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
    ///
    /// `crop` keeps only part of the image: a rectangle in unit coordinates (0…1 on both axes,
    /// origin at the top left of the upright image), as `PhotoCropView` returns it.
    init(imageData: Data, crop: CGRect? = nil) throws {
        let (source, width, height) = try Self.source(imageData)

        // Full resolution: the longest side stays at its original pixel count.
        var full = try Self.orientedImage(source, maxPixelSize: max(width, height))
        if let crop {
            let pixels = CGRect(x: crop.minX * CGFloat(full.width), y: crop.minY * CGFloat(full.height),
                                width: crop.width * CGFloat(full.width), height: crop.height * CGFloat(full.height))
            guard let cropped = full.cropping(to: pixels.integral) else { throw ProcessingError.encodingFailed }
            full = cropped
        }

        self.full = try Self.jpeg(full, quality: 0.9)
        self.thumb = try Self.thumbnail(ofJPEG: self.full)
    }

    /// A small center square of an upright JPEG (one this type encoded).
    private static func thumbnail(ofJPEG data: Data) throws -> Data {
        let (source, width, height) = try source(data)

        // Scale so the short side is `thumbPixels`, then crop the center square.
        let longSide = thumbPixels * max(width, height) / min(width, height)
        let scaled = try orientedImage(source, maxPixelSize: max(longSide, thumbPixels))
        let side = min(scaled.width, scaled.height)
        let square = CGRect(x: (scaled.width - side) / 2, y: (scaled.height - side) / 2, width: side, height: side)
        guard let thumb = scaled.cropping(to: square) else { throw ProcessingError.encodingFailed }
        return try jpeg(thumb, quality: 0.8)
    }

    /// The image source with its stored pixel size (before EXIF orientation is applied).
    private static func source(_ data: Data) throws -> (CGImageSource, width: Int, height: Int) {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0
        else { throw ProcessingError.unreadableImage }
        return (source, width, height)
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
