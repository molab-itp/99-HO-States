import Foundation

/// One of the 100 Greatest African Americans, decoded from the people.json resource and shown in
/// `GreatestView`. people.json carries more fields (summary, image credits); only those the
/// listing uses are decoded.
struct GreatestPerson: Identifiable, Codable, Hashable {
    /// Position in the list once sorted by birth year (earliest first).
    let order: Int
    /// Slug, also the name of the person's thumbnail in the asset catalog's Greatest folder.
    let id: String
    let name: String
    let datesText: String
    let description: String
    let articleUrl: URL
}

/// The top level of people.json.
struct GreatestList: Codable {
    let title: String
    let sourceUrl: URL
    let people: [GreatestPerson]
}
