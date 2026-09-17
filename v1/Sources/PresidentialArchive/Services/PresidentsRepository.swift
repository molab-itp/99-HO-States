import Foundation

/// Loads the static list of presidents bundled with the app.
enum PresidentsRepository {
    static func loadAll() -> [President] {
        guard let url = Bundle.main.url(forResource: "Presidents", withExtension: "json") else {
            assertionFailure("Presidents.json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([President].self, from: data)
        } catch {
            assertionFailure("Failed to decode Presidents.json: \(error)")
            return []
        }
    }
}
