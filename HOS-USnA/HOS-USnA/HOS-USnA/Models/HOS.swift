import Foundation

/// An HOS entry decoded from the generated HOS.json resource.
struct HOS: Identifiable, Codable, Hashable {
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
    /// this field existed (older HOS.json without `articleURL`).
    var wikipediaArticleURL: URL? {
        if let articleURL, let url = URL(string: articleURL) {
            return url
        }
        let encodedTitle = wikipediaTitle.replacingOccurrences(of: " ", with: "_")
        return URL(string: "https://en.wikipedia.org/wiki/\(encodedTitle)")
    }

    /// The years `term` spans, e.g. 1789...1797 for "1789–1797", 1841...1841 for "1841", and
    /// through the current year for "2025–present". Nil if `term` has no year in it.
    var termYears: ClosedRange<Int>? {
        let years = term.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
        guard let start = years.first else { return nil }
        let end = term.hasSuffix("present")
            ? Calendar.current.component(.year, from: .now)
            : years.last ?? start
        return start...max(start, end)
    }
}
