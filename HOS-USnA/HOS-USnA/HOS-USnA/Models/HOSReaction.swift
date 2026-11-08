import Foundation

/// A lightweight feedback reaction a user can attach to an HOS: a single emoji, either one
/// of the quick-pick `presets` or any emoji chosen from `EmojiPickerSheet`. `AppModel` persists
/// these keyed by `HOS.id`.
struct HOSReaction: Hashable, Codable {
    let emoji: String

    init(_ emoji: String) {
        self.emoji = emoji
    }

    /// The quick-pick choices shown in `ReactionPickerStrip`, ahead of its ★ "more" button.
    static let presets: [HOSReaction] = [ "👍🏾", "👎🏾","🫏", "🐘","🌗"].map(HOSReaction.init)

    /// The Unicode name(s) of the emoji, e.g. "sun with rays" — VoiceOver reads the emoji fine on
    /// its own, but this gives `accessibilityLabel` a stable, readable value.
    var accessibilityLabel: String {
        emoji.unicodeScalars
            .compactMap { $0.properties.name?.lowercased() }
            .joined(separator: " ")
    }

    // Encoded as a bare string (`"🐘"`) rather than `{"emoji": "🐘"}`, so the persisted JSON
    // stays the same shape as the earlier enum-based version's `"heart"`, `"thumbsUp"`, etc.

    /// Raw values written by the earlier fixed-set, SF Symbol version, mapped to equivalent emoji
    /// so reactions saved before the switch still show up as something sensible.
    private static let legacyValues: [String: String] = [
        "heart": "❤️",
        "thumbsUp": "👍",
        "thumbsDown": "👎",
        "question": "❓",
    ]

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        emoji = Self.legacyValues[value] ?? value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(emoji)
    }
}
