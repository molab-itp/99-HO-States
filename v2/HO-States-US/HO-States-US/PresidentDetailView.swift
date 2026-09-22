import SwiftUI

let delaySecs:UInt64 = 2;

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

    private let slideshowIntervalTenths = 50 // 5.0 seconds
    @State private var isSlideshowActive: Bool
    @State private var isSlideshowPaused = false
    @State private var slideshowTimer: Timer?
    @State private var slideshowRemainingTenths = 0

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

    // Fixed-width (leading-zero, fully monospaced) title so the number/countdown don't jiggle
    // side-to-side as their digits change every tenth of a second.
    //
    // navigationTitle(_:) only accepts unstyled Text, so this styled title is rendered via a
    // principal toolbar item instead (see `.toolbar` below).
    private var navigationTitleView: some View {
        let orderText = String(format: "%02d", president.order)
        guard isSlideshowActive else {
            return HStack {
                Text("#\(orderText) \(appModel.buildInfo)").font(.system(.body, design: .monospaced))
            }
            .frame(maxWidth: .infinity)
        }
        let secondsText = String(format: "%04.1f", Double(slideshowRemainingTenths) / 10)
        return HStack {
            Text("#\(orderText) · \(secondsText)s \(appModel.buildInfo)").font(.system(.body, design: .monospaced))
        }
        .frame(maxWidth: .infinity)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
//                ViewedProgressBar(total: presidents.count, viewedCount: appModel.viewedPresidentIDs.count)
                ViewedProgressBar(total: presidents.count,
                                  viewedPresidentIDs: appModel.viewedPresidentIDs)
                headerImage
                VStack(alignment: .leading, spacing: 16) {
                    Text("#\(president.order) \(president.name)").font(.system(.body, design: .monospaced))
                    Text("\(president.term) · \(president.party)")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text(president.extract)
                        .font(.body)
                    if let articleURL = president.wikipediaArticleURL {
                        Link(destination: articleURL) {
                            Label("Read on Wikipedia", systemImage: "book")
                        }
                        .font(.callout)
                    }
                }
                .opacity(detailsVisible ? 1 : 0)
            }
            .padding()
        }
        .task(id: index) {
            appModel.markViewed(president, resetIfComplete: isSlideshowActive)
            detailsVisible = false
            try? await Task.sleep(nanoseconds: delaySecs * 1_000_000_000)
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
        .toolbar {
            ToolbarItem(placement: .principal) {
                navigationTitleView
            }
//            ToolbarItem(placement: .topBarTrailing) {
////                ToolbarItem(placement: .topBarTrailing) {
//                Text("(\(appModel.cycleCount))").font(.system(.body, design: .monospaced))
//            }
            ToolbarItemGroup(placement: .bottomBar) {
                Button {
                    goToPrevious()
                } label: {
                    Label("Previous", systemImage: "chevron.left")
                }
                .disabled(isPreviousDisabled)

                Spacer()

                Button {
                    if isSlideshowActive {
                        toggleSlideshowPause()
                    } else {
                        goToRandom()
                    }
                } label: {
                    if isSlideshowActive {
                        Label(
                            isSlideshowPaused ? "Play" : "Pause",
                            systemImage: isSlideshowPaused ? "play.circle" : "pause.circle"
                        )
                    } else {
                        Label("Random", systemImage: "shuffle")
                    }
                }

                Spacer()

                Button {
                    goToNext()
                } label: {
                    Label("Next", systemImage: "chevron.right")
                }
                .disabled(isNextDisabled)
            }
        }
    }

    @ViewBuilder
    private var headerImage: some View {
        if let name = president.largeImageName ?? president.thumbnailImageName, let image = imageIfAvailable(name) {
            image
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(.secondary.opacity(0.2))
                .frame(height: 220)
                .overlay {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 64))
                        .foregroundStyle(.secondary)
                }
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
        slideshowRemainingTenths = slideshowIntervalTenths
        let timer = Timer(timeInterval: 0.1, repeats: true) { _ in
            Task { @MainActor in
                tickSlideshow()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        slideshowTimer = timer
    }

    private func tickSlideshow() {
        guard !isSlideshowPaused else { return }
        slideshowRemainingTenths -= 1
        if slideshowRemainingTenths <= 0 {
            advanceSlideshow()
            restartSlideshowCountdown()
        }
    }

    private func restartSlideshowCountdown() {
        slideshowRemainingTenths = slideshowIntervalTenths
    }

    private func toggleSlideshowPause() {
        isSlideshowPaused.toggle()
    }

    private func stopSlideshowTimer() {
        slideshowTimer?.invalidate()
        slideshowTimer = nil
    }
}

/// A segmented bar above the header image: one segment per president, filled left-to-right as
/// presidents are viewed. Filled segments cycle red/white/blue so progress reads as a strip of
/// bunting rather than a single flat color; white segments get a hairline outline since they'd
/// otherwise disappear against the background.
private struct ViewedProgressBar: View {
    let total: Int
    var viewedPresidentIDs: Set<President.ID>

    private static let colors: [Color] = [.red, .green, .yellow]
    private let segmentSpacing: CGFloat = 2

    var body: some View {
        HStack(spacing: segmentSpacing) {
            ForEach(0..<max(total, 1), id: \.self) { position in
                let color = Self.colors[position % Self.colors.count]
//                let isViewed = position < viewedCount
                let isViewed = viewedPresidentIDs.contains(position+1)
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(isViewed ? color : Color.secondary.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 1.5)
                            .strokeBorder(Color.secondary.opacity(isViewed && color == .white ? 0.6 : 0), lineWidth: 1)
                    )
            }
        }
        .frame(height: 6)
        .accessibilityElement()
        .accessibilityLabel("Heads viewed")
        .accessibilityValue("\(viewedPresidentIDs.count) of \(total)")
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidentDetailView(presidents: presidents, selected: presidents[0])
    }
    .environment(AppModel(presidents: presidents))
}
