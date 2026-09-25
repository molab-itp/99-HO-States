import Foundation
import Observation
import UIKit

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

    /// User-picked emoji feedback per president (a preset like 🐘, or any emoji from the sheet), in
    /// the order added. An ordered list rather than a `Set` — the same reaction can be added more
    /// than once (each "+" press appends whatever was picked), and "-" always removes just the
    /// most recently added one.
    private(set) var reactions: [President.ID: [PresidentReaction]] = [:]

    /// Per-president pinch-zoom/pan state for `ZoomableHeaderImage`, so returning to a president
    /// shows the same zoom/pan as when it was last left. A president with no entry (never zoomed,
    /// or reset back to 1x) renders at the default 1x/no-offset.
    private(set) var imageZoomStates: [President.ID: ImageZoomState] = [:]

    /// PNG file name (inside `PresidentDrawingStore`'s Photos folder) of each president's saved
    /// photo drawing, overlaid on the portrait by `ZoomableHeaderImage`. No entry means no drawing.
    private(set) var drawingFileNames: [President.ID: String] = [:]

    /// Bumped on every drawing save/clear. A re-saved drawing keeps the same file name, so this is
    /// what tells views reading `drawingImage(for:)` that the image behind that name changed.
    private var drawingRevision = 0
    @ObservationIgnored private var drawingImageCache: [President.ID: UIImage] = [:]

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

    func reactions(for president: President) -> [PresidentReaction] {
        reactions[president.id] ?? []
    }

    func addReaction(_ reaction: PresidentReaction, for president: President) {
        reactions[president.id, default: []].append(reaction)
    }

    /// Removes whichever reaction was added most recently, regardless of which kind it was.
    /// Removes the entry for `president` entirely once its last reaction is gone, rather than
    /// leaving an empty array behind, so `reactions(for:)` and a persisted-then-reloaded file
    /// agree on what "no reactions" looks like.
    func removeLastReaction(for president: President) {
        guard var list = reactions[president.id], !list.isEmpty else { return }
        list.removeLast()
        reactions[president.id] = list.isEmpty ? nil : list
    }

    func imageZoomState(for president: President) -> ImageZoomState? {
        imageZoomStates[president.id]
    }

    /// Passing `nil` clears the stored state (used once the image is back at 1x/no-offset, so a
    /// "reset" president doesn't linger as a redundant entry).
    func setImageZoomState(_ state: ImageZoomState?, for president: President) {
        imageZoomStates[president.id] = state
    }

    /// The saved drawing PNG for `president`, loaded from disk once and then cached, since the
    /// header image reads this on every body pass (including each frame of a pinch or pan).
    func drawingImage(for president: President) -> UIImage? {
        _ = drawingRevision
        guard let fileName = drawingFileNames[president.id] else { return nil }
        if let cached = drawingImageCache[president.id] {
            return cached
        }
        let image = PresidentDrawingStore.loadImage(named: fileName)
        drawingImageCache[president.id] = image
        return image
    }

    /// Links (or, with `nil`, unlinks) a drawing PNG already written by `PresidentDrawingStore`.
    /// Unlike other state, this persists immediately: the PNG is already on disk, and losing the
    /// link to it if the app were killed before backgrounding would orphan the user's drawing.
    func setDrawingFileName(_ fileName: String?, for president: President) {
        drawingFileNames[president.id] = fileName
        drawingImageCache[president.id] = nil
        drawingRevision += 1
        persistState()
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
    // Only `slideIndex`, the shuffle state (`shuffledIndexes`/`nextShuffleIndex`), `reactions`,
    // `imageZoomStates`, and `drawingFileNames` survive across app launches — enough to resume browsing where the user left
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
        /// String-keyed (rather than `[Int: [PresidentReaction]]`) so the written JSON is a
        /// normal `{"1": ["🐘", "🐘", "🌍"], ...}` object instead of `Codable`'s
        /// flattened-array encoding of non-string-keyed dictionaries. Order matters here (it's
        /// add-order, and "-" pops the end), unlike the earlier `Set`-based version.
        var reactions: [String: [PresidentReaction]]
        /// String-keyed for the same reason as `reactions` above.
        var imageZoomStates: [String: ImageZoomState]
        /// String-keyed like `reactions`. Optional so a state file written before drawings
        /// existed still decodes instead of discarding everything else in it.
        var drawingFileNames: [String: String]?
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
        imageZoomStates = Dictionary(uniqueKeysWithValues: state.imageZoomStates.compactMap { key, value in
            Int(key).map { ($0, value) }
        })
        drawingFileNames = Dictionary(uniqueKeysWithValues: (state.drawingFileNames ?? [:]).compactMap { key, value in
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
            reactions: Dictionary(uniqueKeysWithValues: reactions.map { (String($0.key), $0.value) }),
            imageZoomStates: Dictionary(uniqueKeysWithValues: imageZoomStates.map { (String($0.key), $0.value) }),
            drawingFileNames: Dictionary(uniqueKeysWithValues: drawingFileNames.map { (String($0.key), $0.value) })
        )
        guard let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: Self.stateFileURL(), options: .atomic)
    }
}
