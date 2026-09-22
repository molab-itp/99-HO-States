import Foundation
import Observation

/// App-wide state shared via the SwiftUI environment. Owns the loaded president list and a
/// shuffled draw order used by every "Random" control (`HomeView`'s Random President button,
/// its slideshow, and `PresidentDetailView`'s Random toolbar button) so random selection cycles
/// through the full set before repeating instead of drawing independently each time.
@Observable
final class AppModel {
    let presidents: [President]

    /// A shuffled permutation of `presidents.indices`. `nextRandomPresident()` walks through it
    /// in order, wrapping back to the start once every index has been served. The permutation
    /// itself is only ever redealt by `resetViewed()` — never here — so a random-mode slideshow
    /// that stops and restarts resumes from `nextShuffleIndex` instead of starting a new walk.
    private var shuffledIndexes: [Int]
    private var nextShuffleIndex = 0

    /// Number of times `presidents.indices` has been shuffled (the initial deal plus every
    /// reshuffle from `resetViewed()`), so callers can tell how many full random cycles have
    /// been dealt.
    private(set) var cycleCount = 0

    /// IDs of presidents whose detail view has been shown, used to drive the progress bar in
    /// `PresidentDetailView`. A `Set` so repeat views (e.g. during a slideshow) don't double-count.
    private(set) var viewedPresidentIDs: Set<President.ID> = []

    /// Which president is currently displayed in `PresidentDetailView`, as an index into
    /// `presidents`. Lives here (rather than as `@State` on the view) so it survives the view
    /// being torn down and recreated — e.g. a non-random slideshow that's stopped and later
    /// restarted picks up from this index instead of always restarting at the first president.
    var slideIndex = 0

    var buildInfo:String {
        "[\(cycleCount)|\(Self.bundleVersion())]"
    }
    
    static func bundleVersion() -> String {
        return String(describing: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion")!)
    }

    init(presidents: [President] = PresidentsRepository.loadAll()) {
        self.presidents = presidents
        self.shuffledIndexes = presidents.indices.shuffled()
        self.cycleCount = 1
    }

    /// Returns the next president in the current shuffle order, wrapping back to its start once
    /// every index has been served. Never reshuffles — only `resetViewed()` deals a new
    /// permutation — so resuming a random-mode slideshow just continues walking the same order.
    @discardableResult
    func nextRandomPresident() -> President? {
        guard !presidents.isEmpty else { return nil }

        if nextShuffleIndex >= shuffledIndexes.count {
            nextShuffleIndex = 0
        }

        let president = presidents[shuffledIndexes[nextShuffleIndex]]
        nextShuffleIndex += 1
        return president
    }

    /// Records `president` as viewed. When `resetIfComplete` is set (the slideshow passes
    /// `true`) and every president has now been shown, resets viewed tracking — and, via
    /// `resetViewed()`, deals a fresh shuffle — so a long-running slideshow starts a new lap
    /// instead of sitting at full.
    func markViewed(_ president: President, resetIfComplete: Bool = false) {
        viewedPresidentIDs.insert(president.id)
        if resetIfComplete, viewedPresidentIDs.count >= presidents.count {
            resetViewed()
        }
    }

    /// Clears viewed tracking, deals a fresh shuffle, and rewinds the sequential slideshow back
    /// to the first president. This is the only place the random draw order is ever reshuffled —
    /// `nextRandomPresident()` just walks (and wraps within) whatever permutation was last dealt
    /// here.
    func resetViewed() {
        viewedPresidentIDs.removeAll()
        shuffledIndexes = presidents.indices.shuffled()
        nextShuffleIndex = 0
        cycleCount += 1
        slideIndex = 0
    }
}
