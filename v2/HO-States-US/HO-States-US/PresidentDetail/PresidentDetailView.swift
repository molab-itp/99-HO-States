import SwiftUI

/// Persisted slideshow timing, chosen on `HomeView` and used by `PresidentDetailView`. Seconds are
/// the basic unit; the details delay is stored as a fraction of the slideshow interval.
enum SlideshowSettings {
    static let intervalSecsKey = "slideshowIntervalSecs"
    static let delayFractionKey = "slideshowDelayFraction"
    static let intervalSecsOptions: [Double] = [5, 10, 15]
    static let delayFractionOptions: [Double] = [0.1, 0.2, 0.5]
    static let defaultIntervalSecs: Double = 5
    static let defaultDelayFraction: Double = 0.5
}

struct PresidentDetailView: View {
    @Environment(AppModel.self) private var appModel
    let presidents: [President]
    let isRandomMode: Bool
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
    // Shared across presidents and launches, so hiding drawings stays in effect while browsing.
    @AppStorage("showsDrawings") private var showsDrawings = true

    @AppStorage(SlideshowSettings.intervalSecsKey)
    private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
    @AppStorage(SlideshowSettings.delayFractionKey)
    private var delayFraction = SlideshowSettings.defaultDelayFraction
    /// Seconds to wait after a president appears before fading in the details.
    private var delaySecs: Double { slideshowIntervalSecs * delayFraction }

    private let slideshowTickSecs = 0.1
    @State private var isSlideshowActive: Bool
    @State private var isSlideshowPaused = false
    @State private var slideshowTimer: Timer?
    @State private var slideshowRemainingSecs = 0.0

    // Indices visited during this slideshow's random walk (in random mode only), so Previous can
    // step back through them and Next can replay forward instead of always drawing a fresh card.
    // Unlike `index`/`appModel.slideIndex`, this doesn't need to persist beyond one slideshow
    // session — resuming a random-mode slideshow instead continues from `appModel`'s
    // `nextShuffleIndex`.
    @State private var randomHistory: [Int]
    @State private var randomPosition = 0

    init(
        presidents: [President],
        selected: President,
        isRandomMode: Bool = false,
        startSlideshow: Bool = false
    ) {
        self.presidents = presidents
        self.isRandomMode = isRandomMode
        let startIndex = presidents.firstIndex(of: selected) ?? 0
        _index = State(initialValue: startIndex)
        _isSlideshowActive = State(initialValue: startSlideshow)
        _randomHistory = State(initialValue: [startIndex])
    }

    private var president: President { presidents[index] }

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
                ViewedProgressBar(total: presidents.count, viewedPresidentIDs: appModel.viewedPresidentIDs)
                ZoomableHeaderImage(president: president, showsDrawing: showsDrawings)
                    // Gives the image a fresh identity (and so fresh, reset zoom/pan state) each
                    // time the displayed president changes, since this view instance otherwise
                    // persists across Next/Previous/slideshow advances.
                    .id(president.id)
                PresidentSummaryView(president: president)
                    .opacity(detailsVisible ? 1 : 0)
            }
            .padding()
        }
        .task(id: index) {
            appModel.markViewed(president, resetIfComplete: isSlideshowActive)
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
            // `appModel.slideIndex`, covering the case where a president is viewed but never
            // advanced past before the user backs out.
            appModel.slideIndex = index
            if isSlideshowActive {
                beginSlideshowTimer()
            }
        }
        .onDisappear {
            stopSlideshowTimer()
        }
        .navigationBarTitleDisplayMode(.inline)
        // Pushing the editor fires `onDisappear` above, which stops a running slideshow's timer
        // so the president can't change mid-drawing; `onAppear` restarts it on return.
        .navigationDestination(isPresented: $isDrawingEditorPresented) {
            PresidentDrawingEditorView(president: president)
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                PresidentDetailTitleView(
                    order: president.order,
                    buildInfo: appModel.buildInfo,
                    slideshowRemainingSecs: isSlideshowActive ? slideshowRemainingSecs : nil
                )
            }
            if appModel.drawingImage(for: president) != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsDrawings.toggle()
                    } label: {
                        Label(
                            showsDrawings ? "Hide Drawing" : "Show Drawing",
                            systemImage: showsDrawings ? "eye" : "eye.slash"
                        )
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
            PresidentDetailToolbar(
                isSlideshowActive: isSlideshowActive,
                isSlideshowPaused: isSlideshowPaused,
                isPreviousDisabled: isPreviousDisabled,
                isNextDisabled: isNextDisabled,
                onPrevious: goToPrevious,
                onCenterButton: {
                    if isSlideshowActive {
                        toggleSlideshowPause()
                    } else {
                        goToRandom()
                    }
                },
                onNext: goToNext
            )
        }
    }

    private var isPreviousDisabled: Bool {
        if isSlideshowActive {
            return isRandomMode && randomPosition == 0
        }
        return index == 0
    }

    private var isNextDisabled: Bool {
        if isSlideshowActive {
            return false
        }
        return index == presidents.count - 1
    }

    private func goToPrevious() {
        if isSlideshowActive {
            if isRandomMode {
                guard randomPosition > 0 else { return }
                randomPosition -= 1
                setIndex(randomHistory[randomPosition])
            } else {
                setIndex(index == 0 ? presidents.count - 1 : index - 1)
            }
            restartSlideshowCountdown()
        } else {
            guard index > 0 else { return }
            setIndex(index - 1)
        }
    }

    private func goToNext() {
        if isSlideshowActive {
            advanceSlideshow()
            restartSlideshowCountdown()
        } else {
            guard index < presidents.count - 1 else { return }
            setIndex(index + 1)
        }
    }

    private func goToRandom() {
        guard let next = appModel.nextRandomPresident(),
              let newIndex = presidents.firstIndex(of: next) else { return }
        setIndex(newIndex)
    }

    /// Advances one slideshow step forward: sequentially (wrapping past the last president) when
    /// random mode is off, or by replaying the next already-visited card (if Previous had backed
    /// up earlier in this walk) or drawing a fresh one when random mode is on.
    private func advanceSlideshow() {
        if isRandomMode {
            if randomPosition < randomHistory.count - 1 {
                randomPosition += 1
                setIndex(randomHistory[randomPosition])
            } else if let next = appModel.nextRandomPresident(),
                      let newIndex = presidents.firstIndex(of: next) {
                randomHistory.append(newIndex)
                randomPosition = randomHistory.count - 1
                setIndex(newIndex)
            }
        } else {
            setIndex(index == presidents.count - 1 ? 0 : index + 1)
        }
    }

    private func beginSlideshowTimer() {
        slideshowRemainingSecs = slideshowIntervalSecs
        let timer = Timer(timeInterval: slideshowTickSecs, repeats: true) { _ in
            Task { @MainActor in
                tickSlideshow()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        slideshowTimer = timer
    }

    private func tickSlideshow() {
        guard !isSlideshowPaused else { return }
        slideshowRemainingSecs = max(0, slideshowRemainingSecs - slideshowTickSecs)
        // Half-tick tolerance absorbs floating-point drift from repeated subtraction.
        if slideshowRemainingSecs < slideshowTickSecs / 2 {
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

    private func stopSlideshowTimer() {
        slideshowTimer?.invalidate()
        slideshowTimer = nil
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidentDetailView(presidents: presidents, selected: presidents[0])
    }
    .environment(AppModel(presidents: presidents))
}
