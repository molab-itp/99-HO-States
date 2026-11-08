import Foundation

/// Loads the portrait credits shown in `CreditsView`, in the order listed in PhotoCredits.json.
enum PhotoCreditsRepository {
    static func loadAll() -> [PhotoCredit] {
        guard let url = Bundle.main.url(forResource: "PhotoCredits", withExtension: "json") else {
            assertionFailure("PhotoCredits.json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode([PhotoCredit].self, from: data)
        } catch {
            assertionFailure("Failed to decode PhotoCredits.json: \(error)")
            return []
        }
    }
}
