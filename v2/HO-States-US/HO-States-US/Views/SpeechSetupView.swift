import SwiftUI

/// Text-to-speech settings: lists the languages `AVSpeechSynthesizer` supports in groups, lets
/// one be picked (used by `HOSSummaryView`'s speech button), and plays editable sample text back
/// in it — optionally translated into that language first. Pushed from `LandingView`.
struct SpeechSetupView: View {
    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage

    @State private var sampleText = Self.defaultSampleText
    /// The language `sampleText` is currently written in: English until Translate is used.
    @State private var sampleTextLanguage = Self.defaultSampleTextLanguage
    @State private var player = SpeechPlayer()

    private let languageGroups = SpeechSettings.supportedLanguageGroups()

    private static let defaultSampleTextLanguage = "en-US"

    private static let defaultSampleText = "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal."

    var body: some View {
        List {
            Section("Sample Text") {
                HStack(alignment: .top) {
                    TextField("Sample Text", text: $sampleText, axis: .vertical)
                    SpeechPlayButton(player: player, text: sampleText)
                        .buttonStyle(.borderless)
                }
                if #available(iOS 18.0, *) {
                    SpeechTranslateButton(text: $sampleText, textLanguage: $sampleTextLanguage, language: language)
                }
            }

            ForEach(languageGroups) { group in
                Section(group.title) {
                    ForEach(group.languages, id: \.self) { code in
                        languageRow(code)
                    }
                }
            }
        }
        .navigationTitle("Speak")
        // Speech in progress is in the old language (or of the old text), so start over.
        .onChange(of: language) {
            player.stop()
        }
        .onChange(of: sampleText) {
            player.stop()
        }
        .onDisappear {
            player.stop()
        }
    }

    private func languageRow(_ code: String) -> some View {
        Button {
            language = code
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(SpeechSettings.displayName(for: code))
                    Text(code)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if code == language {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.tint)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(code == language ? .isSelected : [])
    }
}

#Preview {
    NavigationStack {
        SpeechSetupView()
    }
}
