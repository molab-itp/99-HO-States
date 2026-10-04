import Foundation

/// Loads the external links shown in `SettingsView`, in the order listed in Links.json.
enum LinksRepository {
    static func loadAll() -> [AppLink] {
        guard let url = Bundle.main.url(forResource: "Links", withExtension: "json") else {
            assertionFailure("Links.json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([AppLink].self, from: data)
        } catch {
            assertionFailure("Failed to decode Links.json: \(error)")
            return []
        }
    }
}
