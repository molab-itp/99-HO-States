import SwiftUI

/// Text-to-speech settings: lists every language `AVSpeechSynthesizer` supports, lets one be
/// picked (used by `HOSSummaryView`'s speech button), and plays sample text back in it. Pushed
/// from `LandingView`.
struct SpeechSetupView: View {
    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage

    @State private var sampleText = Self.defaultSampleText
    @State private var player = SpeechPlayer()

    private let languages = SpeechSettings.supportedLanguages()

    private static let defaultSampleText = "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal."

    var body: some View {
        List {
            Section("Sample Text") {
                HStack(alignment: .top) {
                    TextField("Sample Text", text: $sampleText, axis: .vertical)
                    SpeechPlayButton(player: player, text: sampleText)
                        .buttonStyle(.borderless)
                }
            }

            Section("Language") {
                ForEach(languages, id: \.self) { code in
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
}

#Preview {
    NavigationStack {
        SpeechSetupView()
    }
}
