import SwiftUI
import Translation

/// Translates `text` in place: from English into the selected speech `language`, or — once it
/// has been translated — back into English. `textLanguage` tracks which of the two `text` is in.
@available(iOS 18.0, *)
struct SpeechTranslateButton: View {
    @Binding var text: String
    /// Speech language code (e.g. "es-ES") `text` is currently written in.
    @Binding var textLanguage: String
    /// The speech language picked on `SpeechSetupView`.
    let language: String

    /// Non-nil while a translation is running; setting it is what starts `translationTask`.
    @State private var configuration: TranslationSession.Configuration?
    /// Speech language code the running translation will leave `text` in.
    @State private var pendingLanguage = ""
    @State private var errorMessage: String?

    private static let english = "en-US"

    private var isTextEnglish: Bool { SpeechSettings.isEnglish(textLanguage) }
    /// Speech language code the button translates `text` into.
    private var targetLanguage: String { isTextEnglish ? language : Self.english }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                translate()
            } label: {
                Label(
                    "Translate to \(isTextEnglish ? SpeechSettings.displayName(for: language) : "English")",
                    systemImage: "translate"
                )
            }
            .disabled(text.isEmpty || configuration != nil || SpeechSettings.isEnglish(targetLanguage) == isTextEnglish)
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .translationTask(configuration) { session in
            do {
                let response = try await session.translate(text)
                text = response.targetText
                textLanguage = pendingLanguage
                errorMessage = nil
            } catch {
                errorMessage = "Couldn't translate: \(error.localizedDescription)"
            }
            configuration = nil
        }
    }

    private func translate() {
        pendingLanguage = targetLanguage
        configuration = TranslationSession.Configuration(
            source: Self.translationLanguage(for: textLanguage),
            target: Self.translationLanguage(for: targetLanguage)
        )
    }

    /// The Translation framework's language for a speech language code. Translation models are
    /// per language rather than per region, except Chinese, which is split by script.
    private static func translationLanguage(for speechLanguage: String) -> Locale.Language {
        switch speechLanguage {
        case "zh-CN":
            Locale.Language(identifier: "zh-Hans")
        case "zh-TW", "zh-HK":
            Locale.Language(identifier: "zh-Hant")
        default:
            Locale.Language(identifier: String(speechLanguage.prefix { $0 != "-" }))
        }
    }
}
