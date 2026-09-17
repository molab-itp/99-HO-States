import SwiftUI
import UniformTypeIdentifiers

/// Wraps downloaded portrait image bytes so they can be saved via SwiftUI's `.fileExporter`,
/// which works identically on iOS and macOS without needing Photos-library permissions.
struct ImageDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.jpeg, .png] }
    static var writableContentTypes: [UTType] { [.jpeg, .png] }

    var data: Data
    var contentType: UTType

    init(data: Data, contentType: UTType = .jpeg) {
        self.data = data
        self.contentType = contentType
    }

    init(configuration: ReadConfiguration) throws {
        guard let fileData = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.data = fileData
        self.contentType = .jpeg
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
