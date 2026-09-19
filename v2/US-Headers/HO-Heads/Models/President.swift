import Foundation

/// A president entry decoded from the generated Presidents.json resource.
struct President: Identifiable, Codable, Hashable {
    let order: Int
    let name: String
    let term: String
    let party: String
    let wikipediaTitle: String
    let extract: String
    let thumbnailImageName: String?
    let largeImageName: String?
    let articleURL: String?

    var id: Int { order }

    /// Link to the Wikipedia article this summary was generated from. Falls back to
    /// constructing the canonical URL from `wikipediaTitle` for entries generated before
    /// this field existed (older Presidents.json without `articleURL`).
    var wikipediaArticleURL: URL? {
        if let articleURL, let url = URL(string: articleURL) {
            return url
        }
        let encodedTitle = wikipediaTitle.replacingOccurrences(of: " ", with: "_")
        return URL(string: "https://en.wikipedia.org/wiki/\(encodedTitle)")
    }
}
