import SwiftUI

/// Text-to-speech settings: lists the languages `AVSpeechSynthesizer` supports in groups that
/// can each be shown or hidden, lets one be picked (used by `HOSSummaryView`'s speech button), and plays editable sample text back
/// in it — optionally translated into that language first, which also turns on translation of
/// the extract `HOSSummaryView` speaks. Also holds the Auto Speak toggle for `HOSDetailView`'s
/// slideshow, and the choice of what it speaks (summary or name). Pushed from `LandingView`.
struct SpeechSetupView: View {
    @AppStorage(SpeechSettings.languageKey)
    private var language = SpeechSettings.defaultLanguage

    @AppStorage(SpeechSettings.sampleTextKey)
    private var sampleText = SpeechSettings.defaultSampleText
    /// The language `sampleText` is currently written in: English until Translate is used.
    @AppStorage(SpeechSettings.sampleTextLanguageKey)
    private var sampleTextLanguage = SpeechSettings.defaultSampleTextLanguage
    @AppStorage(SpeechSettings.autoSpeakKey)
    private var autoSpeak = SpeechSettings.defaultAutoSpeak
    @AppStorage(SpeechSettings.autoSpeakModeKey)
    private var autoSpeakMode = SpeechSettings.defaultAutoSpeakMode
    /// Titles of the language groups whose languages are showing, see `SpeechSettings.shownGroups`.
    @AppStorage(SpeechSettings.shownGroupsKey)
    private var shownGroups = SpeechSettings.defaultShownGroups
    @State private var player = SpeechPlayer()

    private let languageGroups = SpeechSettings.supportedLanguageGroups()

    var body: some View {
        List {
            Section {
                Toggle("Auto Speak", isOn: $autoSpeak.animation())
                // Expanded: what gets spoken is only offered while Auto Speak is on.
                if autoSpeak {
                    Picker("Auto Speak", selection: $autoSpeakMode) {
                        ForEach(SpeechSettings.AutoSpeakMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            } footer: {
                switch autoSpeakMode {
                case .summary:
                    Text("While the slideshow plays, speaks each summary and waits for it to finish before advancing.")
                case .name:
                    Text("While the slideshow plays, speaks each number and name and waits for it to finish before advancing.")
                }
            }

            Section {
                HStack(alignment: .top) {
                    TextField("Sample Text", text: $sampleText, axis: .vertical)
                    SpeechPlayButton(player: player, text: sampleText)
                        .buttonStyle(.borderless)
                }
                if #available(iOS 18.0, *) {
                    SpeechTranslateButton(text: $sampleText, textLanguage: $sampleTextLanguage, language: language)
                }
            } header: {
                // Tapping the header puts back the default (English) sample text.
                Button("Sample Text") {
                    sampleText = SpeechSettings.defaultSampleText
                    sampleTextLanguage = SpeechSettings.defaultSampleTextLanguage
                }
                .buttonStyle(.bordered)
                .accessibilityHint("Restores the default text")
            }

            ForEach(languageGroups) { group in
                let isShown = SpeechSettings.shownGroups(shownGroups).contains(group.title)
                Section {
                    if isShown {
                        ForEach(group.languages, id: \.self) { code in
                            languageRow(code)
                        }
                    }
                } header: {
                    groupHeader(group, isShown: isShown)
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

    /// The group's title as a button that shows or hides its languages. While they are hidden,
    /// a checkmark marks the group holding the picked language.
    private func groupHeader(_ group: SpeechSettings.LanguageGroup, isShown: Bool) -> some View {
        Button {
            var titles = SpeechSettings.shownGroups(shownGroups)
            if isShown {
                titles.remove(group.title)
            } else {
                titles.insert(group.title)
            }
            withAnimation {
                shownGroups = SpeechSettings.storedShownGroups(titles)
            }
        } label: {
            HStack {
                Text(group.title)
                if !isShown && group.languages.contains(language) {
                    Image(systemName: "checkmark")
                }
                Spacer()
                Image(systemName: isShown ? "chevron.down" : "chevron.right")
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(isShown ? "Expanded" : "Collapsed")
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
