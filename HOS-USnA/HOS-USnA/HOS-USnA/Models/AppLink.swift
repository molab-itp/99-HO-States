import Foundation

/// An external link entry decoded from the Links.json resource, shown in `LandingView`.
struct AppLink: Identifiable, Codable, Hashable {
    let title: String
    let url: URL

    var id: URL { url }
}
