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

    /// IDs of presidents whose detail view has been shown, used to drive the progress bar in
    /// `PresidentDetailView`. A `Set` so repeat views (e.g. during a slideshow) don't double-count.
    private(set) var viewedPresidentIDs: Set<President.ID> = []

    init(presidents: [President] = PresidentsRepository.loadAll()) {
        self.presidents = presidents
        self.shuffledIndexes = presidents.indices.shuffled()
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
        }

        let president = presidents[shuffledIndexes[nextDrawPosition]]
        nextDrawPosition += 1
        return president
    }

    func markViewed(_ president: President) {
        viewedPresidentIDs.insert(president.id)
    }
}
