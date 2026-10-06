import Foundation

/// Loads the news entries shown in `NewsView`, in the order listed in news.json.
enum NewsRepository {
    static func loadAll() -> [NewsItem] {
        guard let url = Bundle.main.url(forResource: "news", withExtension: "json") else {
            assertionFailure("news.json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([NewsItem].self, from: data)
        } catch {
            assertionFailure("Failed to decode news.json: \(error)")
            return []
        }
    }
}
