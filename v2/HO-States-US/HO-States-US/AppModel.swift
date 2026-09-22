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

    /// User-picked feedback per president (heart / thumbs up / thumbs down / question mark),
    /// keyed by `President.id`. Set from `PresidentSummaryView`'s reaction strip.
    private(set) var reactions: [President.ID: PresidentReaction] = [:]

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
        loadPersistedState()
    }

    func reaction(for president: President) -> PresidentReaction? {
        reactions[president.id]
    }

    /// Passing `nil` clears an existing reaction (used when tapping the already-selected one
    /// again in the picker strip).
    func setReaction(_ reaction: PresidentReaction?, for president: President) {
        reactions[president.id] = reaction
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

    // MARK: - Persistence
    //
    // Only `slideIndex`, the shuffle state (`shuffledIndexes`/`nextShuffleIndex`), and
    // `reactions` survive across app launches — enough to resume browsing where the user left
    // off and keep their feedback, without also persisting `viewedPresidentIDs`/`cycleCount`
    // (not asked for, and would make "Reset Visit Count" behave inconsistently across launches).
    //
    // Deliberately *not* written on every mutation: `persistState()` is only ever called from
    // `HO_States_US_App`'s `scenePhase` observer when the app backgrounds, so a slideshow ticking
    // every 0.1s or a reaction pick doesn't each cause a disk write — only leaving the app does.

    private struct PersistedState: Codable {
        var slideIndex: Int
        var shuffledIndexes: [Int]
        var nextShuffleIndex: Int
        /// String-keyed (rather than `[Int: PresidentReaction]`) so the written JSON is a normal
        /// `{"1": "heart", ...}` object instead of `Codable`'s flattened-array encoding of
        /// non-string-keyed dictionaries.
        var reactions: [String: PresidentReaction]
    }

    private static func stateFileURL() -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("AppState.json")
    }

    private func loadPersistedState() {
        guard let data = try? Data(contentsOf: Self.stateFileURL()),
              let state = try? JSONDecoder().decode(PersistedState.self, from: data) else {
            return
        }
        // Guards against a stale file left over from a build with a different president count
        // (e.g. after adding/removing entries in Presidents.json) producing an out-of-range index.
        if state.shuffledIndexes.count == presidents.count {
            shuffledIndexes = state.shuffledIndexes
            nextShuffleIndex = state.nextShuffleIndex
        }
        if presidents.indices.contains(state.slideIndex) {
            slideIndex = state.slideIndex
        }
        reactions = Dictionary(uniqueKeysWithValues: state.reactions.compactMap { key, value in
            Int(key).map { ($0, value) }
        })
    }

    /// Writes the current resumable state to disk. See the note above `PersistedState` — call
    /// this sparingly; it's not meant to run on every state change.
    func persistState() {
        let state = PersistedState(
            slideIndex: slideIndex,
            shuffledIndexes: shuffledIndexes,
            nextShuffleIndex: nextShuffleIndex,
            reactions: Dictionary(uniqueKeysWithValues: reactions.map { (String($0.key), $0.value) })
        )
        guard let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: Self.stateFileURL(), options: .atomic)
    }
}
