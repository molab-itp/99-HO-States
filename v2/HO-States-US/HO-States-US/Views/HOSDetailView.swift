import Combine
import SwiftUI

/// Persisted slideshow settings, chosen on `LandingView` and used by `HOSDetailView`. Seconds
/// are the basic unit; the details delay is stored as a fraction of the slideshow interval.
enum SlideshowSettings {
    static let randomModeKey = "slideshowRandomMode"
    static let defaultRandomMode = false
    static let intervalSecsKey = "slideshowIntervalSecs"
    static let delayFractionKey = "slideshowDelayFraction"
    static let intervalSecsOptions: [Double] = [5, 10, 15, 20]
    static let delayFractionOptions: [Double] = [0.1, 0.2, 0.4, 0.5]
    static let defaultIntervalSecs: Double = 5
    static let defaultDelayFraction: Double = 0.4
    static let fadePeriodKey = "slideshowFadePeriod"
    static let fadePeriodOptions: [Double] = [0.1, 1, 2]
    static let defaultFadePeriod: Double = 1
}

struct HOSDetailView: View {
    @Environment(AppModel.self) private var appModel
    let hosList: [HOS]
    // The source of truth for rendering — `@State` so it's seeded exactly once per view
    // *identity* and immune to `init` re-running on every reconstruction (SwiftUI reconstructs
    // this struct, and re-executes `init`, far more often than the view's identity actually
    // changes; `@State`'s `initialValue` is what's special-cased to apply only on first creation
    // for a given identity — see the extended note on `setIndex(_:)` below). Every change here is
    // mirrored into `appModel.slideIndex` so it persists across this view being torn down and
    // recreated (e.g. a sequential slideshow that's stopped and restarted resumes from it).
    @State private var index: Int
    @State private var detailsVisible = false
    @State private var isDrawingEditorPresented = false

    @AppStorage(SlideshowSettings.randomModeKey)
    private var isRandomMode = SlideshowSettings.defaultRandomMode
    @AppStorage(SlideshowSettings.intervalSecsKey)
    private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
    @AppStorage(SlideshowSettings.delayFractionKey)
    private var delayFraction = SlideshowSettings.defaultDelayFraction
    @AppStorage(SlideshowSettings.fadePeriodKey)
    private var fadePeriod = SlideshowSettings.defaultFadePeriod
    @AppStorage(SpeechSettings.autoSpeakKey)
    private var autoSpeak = SpeechSettings.defaultAutoSpeak
    /// Seconds to wait after an HOS appears before fading in the details.
    private var delaySecs: Double { slideshowIntervalSecs * delayFraction }

    private static let slideshowTickSecs = 0.1
    // The slideshow is always "on" — Play/Pause just toggles whether its countdown advances. It
    // starts paused (unless opened by Landing's Start Slideshow), so resuming lands on a still
    // HOS until Play is pressed.
    @State private var isSlideshowPaused: Bool
    private var isPlaying: Bool { !isSlideshowPaused }
    // Delivered through `.onReceive` rather than a `Timer` whose closure is created once in
    // `onAppear`: such a closure captures that moment's copy of this struct, and its `@AppStorage`
    // reads then return stale values — so every auto-advance restarted the countdown with the
    // interval from before it was last changed. `.onReceive`'s closure is rebuilt on every body
    // evaluation, so it always sees the current settings. Held in `@State` so re-running `init`
    // doesn't resubscribe (an unsubscribed `autoconnect` publisher never starts its timer).
    @State private var slideshowTicks = Timer.publish(every: slideshowTickSecs, on: .main, in: .common).autoconnect()
    @State private var slideshowRemainingSecs = 0.0
    // Owned here rather than by `HOSSummaryView` so `tickSlideshow` can hold the advance until
    // the extract has been spoken.
    @State private var speechPlayer = SpeechPlayer()

    // Indices visited during the random walk (in random mode only), so Previous can step back
    // through them and Next can replay forward instead of always drawing a fresh card. Unlike
    // `index`/`appModel.slideIndex`, this doesn't persist across launches — random mode instead
    // continues from `appModel`'s `nextShuffleIndex`. Starts over each time this view is opened from Landing.
    @State private var randomHistory: [Int]
    @State private var randomPosition = 0

    init(hosList: [HOS], selected: HOS, startsPlaying: Bool = false) {
        _isSlideshowPaused = State(initialValue: !startsPlaying)
        self.hosList = hosList
        let startIndex = hosList.firstIndex(of: selected) ?? 0
        _index = State(initialValue: startIndex)
        _randomHistory = State(initialValue: [startIndex])
    }

    private var hos: HOS { hosList[index] }

    /// Updates the displayed index and mirrors it into `appModel.slideIndex`. Every navigation
    /// method below must go through this (never assign `index` or `appModel.slideIndex`
    /// directly) — it's the one place that keeps the two in sync.
    private func setIndex(_ newValue: Int) {
        index = newValue
        appModel.slideIndex = newValue
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ViewedProgressBar(total: hosList.count, viewedHOSIDs: appModel.viewedHOSIDs)
                // A ZStack so the outgoing and incoming images overlap while they cross-fade,
                // instead of stacking vertically during the transition.
                ZStack {
                    ZoomableHeaderImage(hos: hos, displayMode: appModel.drawingDisplayMode(for: hos))
                        // Gives the image a fresh identity (and so fresh, reset zoom/pan state) each
                        // time the displayed HOS changes, since this view instance otherwise
                        // persists across Next/Previous/slideshow advances.
                        .id(hos.id)
                        .transition(.opacity)
                }
                // Only advances while playing fade; manual browsing swaps the image instantly.
                .animation(isPlaying ? .easeInOut(duration: fadePeriod) : nil, value: hos.id)
                // Auto speech starts as the details fade in, so the extract is on screen for it.
                HOSSummaryView(hos: hos, speechPlayer: speechPlayer, autoSpeaks: autoSpeak && isPlaying && detailsVisible)
                    .opacity(detailsVisible ? 1 : 0)
            }
            .padding()
        }
        .task(id: index) {
            appModel.markViewed(hos, resetIfComplete: isPlaying)
            detailsVisible = false
            try? await Task.sleep(for: .seconds(delaySecs))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.5)) {
                detailsVisible = true
            }
        }
        .onAppear {
            // Runs exactly once per view identity (unlike `init`, which SwiftUI can re-invoke on
            // reconstruction) — the reliable place to publish this session's starting index to
            // `appModel.slideIndex`, covering the case where an HOS is viewed but never
            // advanced past before the user backs out.
            appModel.slideIndex = index
            restartSlideshowCountdown()
        }
        .onReceive(slideshowTicks) { _ in
            tickSlideshow()
        }
        .navigationBarTitleDisplayMode(.inline)
        // `tickSlideshow` holds the countdown while the editor is up so the HOS can't change
        // mid-drawing; `onAppear` restarts the countdown on return.
        .navigationDestination(isPresented: $isDrawingEditorPresented) {
            HOSDrawingEditorView(hos: hos)
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                HOSDetailTitleView(
                    order: hos.order,
                    buildInfo: appModel.buildInfo,
                    slideshowRemainingSecs: isPlaying ? slideshowRemainingSecs : nil
                )
            }
            if appModel.drawingImage(for: hos) != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    let drawingDisplayMode = appModel.drawingDisplayMode(for: hos)
                    Menu {
                        Picker("Show", selection: Binding(
                            get: { drawingDisplayMode },
                            set: { appModel.setDrawingDisplayMode($0, for: hos) }
                        )) {
                            ForEach(DrawingDisplayMode.allCases) { mode in
                                Label(mode.title, systemImage: mode.systemImage).tag(mode)
                            }
                        }
                    } label: {
                        Label(drawingDisplayMode.title, systemImage: drawingDisplayMode.systemImage)
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isDrawingEditorPresented = true
                } label: {
                    Label("Draw on Photo", systemImage: "pencil.tip.crop.circle")
                }
            }
            HOSDetailToolbar(
                isSlideshowPaused: isSlideshowPaused,
                isPreviousDisabled: isPreviousDisabled,
                isNextDisabled: isNextDisabled,
                onPrevious: goToPrevious,
                onPlayPause: toggleSlideshowPause,
                onNext: goToNext
            )
        }
    }

    private var isPreviousDisabled: Bool {
        isRandomMode && randomPosition == 0
    }

    private var isNextDisabled: Bool { false }

    private func goToPrevious() {
        if isRandomMode {
            guard randomPosition > 0 else { return }
            randomPosition -= 1
            setIndex(randomHistory[randomPosition])
        } else {
            setIndex(index == 0 ? hosList.count - 1 : index - 1)
        }
        restartSlideshowCountdown()
    }

    private func goToNext() {
        advanceSlideshow()
        restartSlideshowCountdown()
    }

    /// Advances one slideshow step forward: sequentially (wrapping past the last HOS) when
    /// random mode is off, or by replaying the next already-visited card (if Previous had backed
    /// up earlier in this walk) or drawing a fresh one when random mode is on.
    private func advanceSlideshow() {
        if isRandomMode {
            if randomPosition < randomHistory.count - 1 {
                randomPosition += 1
                setIndex(randomHistory[randomPosition])
            } else if let next = appModel.nextRandomHOS(),
                      let newIndex = hosList.firstIndex(of: next) {
                randomHistory.append(newIndex)
                randomPosition = randomHistory.count - 1
                setIndex(newIndex)
            }
        } else {
            setIndex(index == hosList.count - 1 ? 0 : index + 1)
        }
    }

    private func tickSlideshow() {
        guard isPlaying, !isDrawingEditorPresented else { return }
        // Not clamped at zero: while Auto Speak holds the advance below, this keeps counting
        // down into negative numbers, so the title shows how long the slide has run over.
        slideshowRemainingSecs -= Self.slideshowTickSecs
        // Half-tick tolerance absorbs floating-point drift from repeated subtraction.
        if slideshowRemainingSecs < Self.slideshowTickSecs / 2 {
            // With Auto Speak on, the slide stays up until the extract has been spoken.
            if autoSpeak, speechPlayer.isBusy { return }
            advanceSlideshow()
            restartSlideshowCountdown()
        }
    }

    private func restartSlideshowCountdown() {
        slideshowRemainingSecs = slideshowIntervalSecs
    }

    private func toggleSlideshowPause() {
        isSlideshowPaused.toggle()
    }
}

#Preview {
    let hosList = HOSRepository.loadAll()
    NavigationStack {
        HOSDetailView(hosList: hosList, selected: hosList[0])
    }
    .environment(AppModel(hosList: hosList))
}
