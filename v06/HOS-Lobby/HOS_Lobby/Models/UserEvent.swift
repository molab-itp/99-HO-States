import Foundation

/// Something that happened to another user while the list was open, shown as a banner.
struct UserEvent: Identifiable, Equatable {
    enum Kind {
        case created, signedIn, signedOut, deleted
    }

    let id = UUID()
    let kind: Kind
    let name: String

    var message: String {
        switch kind {
        case .created: "\(name) joined"
        case .signedIn: "\(name) signed in"
        case .signedOut: "\(name) signed out"
        case .deleted: "\(name) was deleted"
        }
    }

    var systemImage: String {
        switch kind {
        case .created: "person.crop.circle.badge.plus"
        case .signedIn: "person.crop.circle.badge.checkmark"
        case .signedOut: "person.crop.circle.badge.xmark"
        case .deleted: "person.crop.circle.badge.minus"
        }
    }
}
