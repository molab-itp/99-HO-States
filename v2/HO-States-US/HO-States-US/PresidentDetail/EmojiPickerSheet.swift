import SwiftUI

/// A searchable grid of every single-scalar emoji, shown from the ★ in `ReactionPickerStrip`.
/// iOS has no public emoji-picker API, so the list is built from Unicode scalar properties, and
/// search matches against each scalar's Unicode name (e.g. "sun" finds ☀️ "black sun with rays").
struct EmojiPickerSheet: View {
    let onPick: (PresidentReaction) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filtered: [EmojiEntry] {
        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return EmojiEntry.all }
        return EmojiEntry.all.filter { $0.name.contains(query) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 4)], spacing: 4) {
                    ForEach(filtered) { entry in
                        Button {
                            onPick(PresidentReaction(entry.emoji))
                            dismiss()
                        } label: {
                            Text(entry.emoji)
                                .font(.largeTitle)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(entry.name)
                    }
                }
                .padding(.horizontal)
            }
            .overlay {
                if filtered.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                }
            }
            .navigationTitle("Choose Emoji")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

private struct EmojiEntry: Identifiable {
    let emoji: String
    /// Lowercased Unicode name, used for search.
    let name: String
    var id: String { emoji }

    /// Computed once on first use. Covers emoji that are a single scalar (plus VS16 for the ones
    /// that default to text presentation, like ☀️) — not ZWJ sequences, flags, or skin tones.
    static let all: [EmojiEntry] = (0x00A9...0x1FAFF).compactMap { value in
        guard let scalar = Unicode.Scalar(value) else { return nil }
        let props = scalar.properties
        guard props.isEmoji, !props.isEmojiModifier,
              !(0x1F1E6...0x1F1FF).contains(value), // regional indicators (flag halves)
              let name = props.name else { return nil }
        let emoji = props.isEmojiPresentation
            ? String(scalar)
            : String(scalar) + "\u{FE0F}"
        return EmojiEntry(emoji: emoji, name: name.lowercased())
    }
}
