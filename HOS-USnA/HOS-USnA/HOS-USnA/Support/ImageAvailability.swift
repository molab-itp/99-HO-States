import SwiftUI

/// Returns a SwiftUI `Image` for the named asset if it actually exists in the catalog, otherwise nil.
func imageIfAvailable(_ name: String) -> Image? {
    #if canImport(UIKit)
    guard UIImage(named: name) != nil else { return nil }
    return Image(name)
    #elseif canImport(AppKit)
    guard NSImage(named: name) != nil else { return nil }
    return Image(name)
    #else
    return nil
    #endif
}
