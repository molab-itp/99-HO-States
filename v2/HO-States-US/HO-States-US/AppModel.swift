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
    /// in order, reshuffling (and resetting to the start) once every index has been served.
    private var shuffledIndexes: [Int]
    private var nextDrawPosition = 0

    /// Number of times `presidents.indices` has been shuffled (the initial deal plus every
    /// reshuffle once a shuffle is exhausted), so callers can tell how many full random cycles
    /// have been dealt.
    private(set) var cycleCount = 0

    /// IDs of presidents whose detail view has been shown, used to drive the progress bar in
    /// `PresidentDetailView`. A `Set` so repeat views (e.g. during a slideshow) don't double-count.
    private(set) var viewedPresidentIDs: Set<President.ID> = []

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

    /// Returns the next president in the current shuffle order, reshuffling first if the
    /// previous shuffle has been fully consumed. Reshuffling avoids re-dealing the president that
    /// was just shown as the first card of the new shuffle, so back-to-back draws never repeat.
    @discardableResult
    func nextRandomPresident() -> President? {
        guard !presidents.isEmpty else { return nil }

        if nextDrawPosition >= shuffledIndexes.count {
            let lastDrawnIndex = shuffledIndexes.last
            shuffledIndexes = presidents.indices.shuffled()
            if presidents.count > 1, shuffledIndexes.first == lastDrawnIndex {
                shuffledIndexes.swapAt(0, 1)
            }
            nextDrawPosition = 0
            cycleCount += 1
        }

        let president = presidents[shuffledIndexes[nextDrawPosition]]
        nextDrawPosition += 1
        return president
    }

    /// Records `president` as viewed. When `resetIfComplete` is set (the slideshow passes
    /// `true`) and every president has now been shown, clears the tracking back to empty so a
    /// long-running slideshow's progress bar starts a fresh lap instead of sitting at full.
    func markViewed(_ president: President, resetIfComplete: Bool = false) {
        viewedPresidentIDs.insert(president.id)
        if resetIfComplete, viewedPresidentIDs.count >= presidents.count {
            viewedPresidentIDs.removeAll()
        }
    }

    func resetViewed() {
        viewedPresidentIDs.removeAll()
    }
}
