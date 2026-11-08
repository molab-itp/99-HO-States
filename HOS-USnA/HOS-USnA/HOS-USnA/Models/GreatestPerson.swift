import Foundation

/// One of the 100 Greatest African Americans, decoded from the people.json resource and shown in
/// `GreatestView`, `GreatestDetailView` and at the bottom of `HOSSummaryView`. people.json carries
/// more fields (image credits); only those the app uses are decoded.
struct GreatestPerson: Identifiable, Codable, Hashable {
    /// Position in the list once sorted by birth year (earliest first).
    let order: Int
    /// Slug, also the name of the person's thumbnail in the asset catalog's Greatest folder.
    let id: String
    let name: String
    let born: Int
    /// Nil while the person is living.
    let died: Int?
    let datesText: String
    let description: String
    let summary: String
    let articleUrl: URL

    var thumbnailImageName: String { id }
    var largeImageName: String { "\(id) Large" }

    /// Whether the person was alive at some point during `years`. The living count as alive
    /// through the current year.
    func livedDuring(_ years: ClosedRange<Int>) -> Bool {
        let lifetime = born...(died ?? Calendar.current.component(.year, from: .now))
        return lifetime.overlaps(years)
    }
}

/// The top level of people.json.
struct GreatestList: Codable {
    let title: String
    let sourceUrl: URL
    let people: [GreatestPerson]
}
