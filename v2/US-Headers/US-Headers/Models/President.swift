import Foundation

/// A president entry decoded from the generated Presidents.json resource.
struct President: Identifiable, Codable, Hashable {
    let order: Int
    let name: String
    let term: String
    let party: String
    let wikipediaTitle: String
    let extract: String
    let thumbnailImageName: String?
    let largeImageName: String?

    var id: Int { order }
}
