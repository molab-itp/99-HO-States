import Foundation

/// A news entry decoded from the news.json resource, shown in `NewsView`.
struct NewsItem: Identifiable, Codable, Hashable {
    let label: String
    let url: URL
    /// Name of an image in the asset catalog. Optional, and may be left empty in news.json.
    let thumbnail: String?

    var id: URL { url }
}
