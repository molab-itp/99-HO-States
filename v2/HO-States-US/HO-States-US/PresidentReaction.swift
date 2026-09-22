import Foundation

/// A lightweight feedback reaction a user can attach to a president, picked from a small fixed
/// set (mirrors iMessage-style tapbacks) rather than free text. `AppModel` persists these keyed
/// by `President.id`.
enum PresidentReaction: String, Codable, CaseIterable {
    case heart
    case thumbsUp
    case thumbsDown
    case question

    var symbolName: String {
        switch self {
        case .heart: "heart.fill"
        case .thumbsUp: "hand.thumbsup.fill"
        case .thumbsDown: "hand.thumbsdown.fill"
        case .question: "questionmark.circle.fill"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .heart: "Heart"
        case .thumbsUp: "Thumbs up"
        case .thumbsDown: "Thumbs down"
        case .question: "Question mark"
        }
    }
}
