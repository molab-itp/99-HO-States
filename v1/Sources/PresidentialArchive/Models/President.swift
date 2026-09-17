import Foundation

/// A single presidential term entry, seeded locally and enriched at runtime with biography/photo data.
struct President: Identifiable, Codable, Hashable {
    let order: Int
    let name: String
    let term: String
    let party: String
    /// Title of the corresponding Wikipedia article, used to fetch bio + portrait since
    /// whitehousehistory.org blocks automated requests (redirects to a donation page).
    let wikipediaTitle: String

    var id: String { "\(order)-\(name)" }
}
