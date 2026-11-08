import Foundation

/// Loads the people shown in `GreatestView`, in the order listed in people.json (by birth year).
enum GreatestRepository {
    /// Decoded once and shared, since `HOSSummaryView` filters it for every HOS shown.
    static let all = loadAll()

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

    /// The people alive during `hos`'s term. The first HOS also gets everyone who died before
    /// its term began (Crispus Attucks), so no one is left without a HOS.
    static func people(for hos: HOS) -> [GreatestPerson] {
        guard let years = hos.termYears else { return [] }
        return all.filter { person in
            person.livedDuring(years) || (hos.order == 1 && (person.died ?? .max) < years.lowerBound)
        }
    }
}
