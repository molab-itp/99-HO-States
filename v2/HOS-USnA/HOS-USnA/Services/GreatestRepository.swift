import Foundation

/// Loads the people shown in `GreatestView`, in the order listed in people.json (by birth year).
enum GreatestRepository {
    static func loadAll() -> [GreatestPerson] {
        guard let url = Bundle.main.url(forResource: "people", withExtension: "json") else {
            assertionFailure("people.json missing from bundle")
            return []
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(GreatestList.self, from: data).people
        } catch {
            assertionFailure("Failed to decode people.json: \(error)")
            return []
        }
    }
}
