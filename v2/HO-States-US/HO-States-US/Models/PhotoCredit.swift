import Foundation

/// The source, author and licence of one portrait, decoded from the generated PhotoCredits.json
/// resource and shown in `CreditsView`.
struct PhotoCredit: Identifiable, Codable, Hashable {
    /// Matches `HOS.order`.
    let order: Int
    let name: String
    /// Filename on Wikimedia Commons.
    let file: String
    let author: String
    let license: String
    /// Absent for public-domain works, which have no licence text to link to.
    let licenseURL: URL?
    /// The file's page on Wikimedia Commons.
    let sourceURL: URL

    var id: Int { order }
}
