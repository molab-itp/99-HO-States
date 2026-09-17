import Foundation

/// Decoded response from Wikipedia's REST "page/summary" endpoint.
struct WikipediaSummary: Codable {
    let title: String
    let extract: String
    let thumbnail: WikipediaImage?
    let originalimage: WikipediaImage?
}

struct WikipediaImage: Codable {
    let source: String
    let width: Int
    let height: Int
}
