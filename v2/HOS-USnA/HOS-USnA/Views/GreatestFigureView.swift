import Combine
import SwiftUI

/// A Greatest figure's full photo, name, dates, description, summary and Wikipedia link. The body
/// of `GreatestDetailView`, and repeated for each figure at the bottom of `HOSSummaryView`.
/// Given a `speechPlayer` (as `GreatestDetailView` does), a play/pause button by the name speaks
/// the summary — or, per `speechMode`, the order and name, or the name and description — and `autoSpeaks` turning on starts
/// it without a tap. The owner of `speechPlayer` stops it when the person changes.
struct GreatestFigureView: View {
    let person: GreatestPerson
    var speechPlayer: SpeechPlayer? = nil
    var autoSpeaks = false
    var speechMode = SpeechSettings.AutoSpeakMode.summary

    private var speechText: String {
        switch speechMode {
        case .summary: person.summary
        case .name: "\(person.order) \(person.name)"
        case .caption: "\(person.name). \(person.description)"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let image = imageIfAvailable(person.largeImageName) {
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            HStack {
                Text(person.name)
                    .font(.title2.bold())
                if let speechPlayer {
                    Spacer()
                    SpeechTranslatedPlayButton(player: speechPlayer, text: speechText, autoPlays: autoSpeaks)
                }
            }
            Text(person.description)
                .font(.headline)
                .foregroundStyle(.secondary)
            Text(person.summary)
                .font(.body)
          HStack {
            Link(destination: person.articleUrl) {
              Label("Article", systemImage: "book")
            }
            Spacer()
            Link(destination: URL(string: "https://en.wikipedia.org/wiki/100_Greatest_African_Americans")!) {
              Label("Source", systemImage: "book")
            }
          }
            .font(.callout)
        }
    }
}

/// One Greatest figure on its own screen, with Previous / Play-Pause / Next to step or run a
/// slideshow through `people` (wrapping at either end), timed by the slideshow interval set on
/// `LandingView`. Pushed from `GreatestView`. Like `HOSDetailView`, with Auto Speak on the
/// slideshow speaks each figure (once the details delay has passed) and holds the advance until
/// the speech is done.
struct GreatestDetailView: View {
    let people: [GreatestPerson]
    @State private var index: Int

    @AppStorage(SlideshowSettings.intervalSecsKey)
    private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
    @AppStorage(SlideshowSettings.delayFractionKey)
    private var delayFraction = SlideshowSettings.defaultDelayFraction
    @AppStorage(SpeechSettings.autoSpeakKey)
    private var autoSpeak = SpeechSettings.defaultAutoSpeak
    @AppStorage(SpeechSettings.autoSpeakModeKey)
    private var autoSpeakMode = SpeechSettings.defaultAutoSpeakMode
    private var delaySecs: Double { slideshowIntervalSecs * delayFraction }

    private static let slideshowTickSecs = 0.1
    @State private var isSlideshowPaused = true
    private var isPlaying: Bool { !isSlideshowPaused }
    // Delivered through `.onReceive` so the tick always sees the current settings — see the note
    // on `HOSDetailView.slideshowTicks`.
    @State private var slideshowTicks = Timer.publish(every: slideshowTickSecs, on: .main, in: .common).autoconnect()
    @State private var slideshowRemainingSecs = 0.0
    @State private var speechPlayer = SpeechPlayer()
    /// Turns on `delaySecs` after each figure appears, so Auto Speak starts afresh for each one.
    @State private var isSpeechArmed = false

    init(people: [GreatestPerson], selected: GreatestPerson) {
        self.people = people
        _index = State(initialValue: people.firstIndex(of: selected) ?? 0)
    }

    private var person: GreatestPerson { people[index] }

    var body: some View {
        ScrollView {
            GreatestFigureView(
                person: person,
                speechPlayer: speechPlayer,
                autoSpeaks: autoSpeak && isPlaying && isSpeechArmed,
                speechMode: autoSpeak ? autoSpeakMode : .summary
            )
            .padding()
        }
        .task(id: index) {
            speechPlayer.stop()
            isSpeechArmed = false
            try? await Task.sleep(for: .seconds(delaySecs))
            guard !Task.isCancelled else { return }
            isSpeechArmed = true
        }
        .onAppear {
            restartSlideshowCountdown()
        }
        .onDisappear {
            speechPlayer.stop()
        }
        .onReceive(slideshowTicks) { _ in
            tickSlideshow()
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                titleView
            }
            HOSDetailToolbar(
                isSlideshowPaused: isSlideshowPaused,
                isPreviousDisabled: false,
                isNextDisabled: false,
                onPrevious: goToPrevious,
                onPlayPause: { isSlideshowPaused.toggle() },
                onNext: goToNext
            )
        }
    }

    /// The order, plus the countdown while playing, in a fixed-width font so it doesn't jiggle
    /// as the digits change (see `HOSDetailTitleView`).
    private var titleView: some View {
        let orderText = "#\(String(format: "%03d", person.order))"
        let seconds = slideshowRemainingSecs
        let isOvertime = seconds <= -0.05
        let secondsText = String(format: isOvertime ? "%05.1f" : "%04.1f", isOvertime ? seconds : max(0, seconds))
        return Text(isPlaying ? "\(orderText) · \(secondsText)s" : orderText)
            .font(.system(.body, design: .monospaced))
    }

    private func goToPrevious() {
        index = index == 0 ? people.count - 1 : index - 1
        restartSlideshowCountdown()
    }

    private func goToNext() {
        index = index == people.count - 1 ? 0 : index + 1
        restartSlideshowCountdown()
    }

    private func tickSlideshow() {
        guard isPlaying else { return }
        // Not clamped at zero, so the title shows how long Auto Speak has held the slide over.
        slideshowRemainingSecs -= Self.slideshowTickSecs
        if slideshowRemainingSecs < Self.slideshowTickSecs / 2 {
            if autoSpeak, speechPlayer.isBusy { return }
            goToNext()
        }
    }

    private func restartSlideshowCountdown() {
        slideshowRemainingSecs = slideshowIntervalSecs
    }
}

#Preview {
    NavigationStack {
        GreatestDetailView(people: GreatestRepository.all, selected: GreatestRepository.all[0])
    }
}
