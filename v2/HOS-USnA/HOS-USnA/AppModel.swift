import Foundation
import Observation
import UIKit

/// App-wide state shared via the SwiftUI environment. Owns the loaded HOS list and a
/// shuffled draw order used by every "Random" control (`LandingView`'s Random Head button and
/// `HOSDetailView`'s random-mode slideshow / Next button) so random selection cycles
/// through the full set before repeating instead of drawing independently each time.
@Observable
final class AppModel {
    let hosList: [HOS]

    /// A shuffled permutation of `hosList.indices`. `nextRandomHOS()` walks through it
    /// in order, wrapping back to the start once every index has been served. The permutation
    /// itself is only ever redealt by `resetViewed()` — never here — so a random-mode slideshow
    /// that stops and restarts resumes from `nextShuffleIndex` instead of starting a new walk.
    private var shuffledIndexes: [Int]
    private var nextShuffleIndex = 0

    /// Number of times `hosList.indices` has been shuffled (the initial deal plus every
    /// reshuffle from `resetViewed()`), so callers can tell how many full random cycles have
    /// been dealt.
    private(set) var cycleCount = 0

    /// IDs of heads of state whose detail view has been shown, used to drive the progress bar in
    /// `HOSDetailView`. A `Set` so repeat views (e.g. during a slideshow) don't double-count.
    private(set) var viewedHOSIDs: Set<HOS.ID> = []

    /// Which HOS is currently displayed in `HOSDetailView`, as an index into
    /// `hosList`. Lives here (rather than as `@State` on the view) so it survives the view
    /// being torn down and recreated — e.g. a non-random slideshow that's stopped and later
    /// restarted picks up from this index instead of always restarting at the first HOS.
    var slideIndex = 0

    /// The top-level screen currently showing, kept in sync with the navigation path by
    /// `AppLandingView` and persisted so the next launch reopens on the same screen.
    var screen: AppScreen = .landing

    /// User-picked emoji feedback per HOS (a preset like 🐘, or any emoji from the sheet), in
    /// the order added. An ordered list rather than a `Set` — the same reaction can be added more
    /// than once (each "+" press appends whatever was picked), and "-" always removes just the
    /// most recently added one.
    private(set) var reactions: [HOS.ID: [HOSReaction]] = [:]

    /// Per-HOS pinch-zoom/pan state for `ZoomableHeaderImage`, so returning to an HOS
    /// shows the same zoom/pan as when it was last left. An HOS with no entry (never zoomed,
    /// or reset back to 1x) renders at the default 1x/no-offset.
    private(set) var imageZoomStates: [HOS.ID: ImageZoomState] = [:]

    /// Per-HOS choice from the eye menu (photo, photo + drawing, or drawing only). A
    /// HOS with no entry uses the default, `.photoAndDrawing`.
    private(set) var drawingDisplayModes: [HOS.ID: DrawingDisplayMode] = [:]

    /// PNG file name (inside `HOSDrawingStore`'s Photos folder) of each HOS's saved
    /// photo drawing, overlaid on the portrait by `ZoomableHeaderImage`. No entry means no drawing.
    private(set) var drawingFileNames: [HOS.ID: String] = [:]

    /// Bumped on every drawing save/clear. A re-saved drawing keeps the same file name, so this is
    /// what tells views reading `drawingImage(for:)` that the image behind that name changed.
    private var drawingRevision = 0
    @ObservationIgnored private var drawingImageCache: [HOS.ID: UIImage] = [:]

    var buildInfo:String {
        "[\(cycleCount)|\(Self.bundleVersion())]"
    }
    
    static func bundleVersion() -> String {
        return String(describing: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion")!)
    }

    init(hosList: [HOS] = HOSRepository.loadAll()) {
        self.hosList = hosList
        self.shuffledIndexes = hosList.indices.shuffled()
        self.cycleCount = 1
        loadPersistedState()
    }

    /// Makes `hos` the one `HOSDetailView` shows when it's next opened.
    func select(_ hos: HOS) {
        if let index = hosList.firstIndex(of: hos) {
            slideIndex = index
        }
    }

    func reactions(for hos: HOS) -> [HOSReaction] {
        reactions[hos.id] ?? []
    }

    func addReaction(_ reaction: HOSReaction, for hos: HOS) {
        reactions[hos.id, default: []].append(reaction)
    }

    /// Removes whichever reaction was added most recently, regardless of which kind it was.
    /// Removes the entry for `hos` entirely once its last reaction is gone, rather than
    /// leaving an empty array behind, so `reactions(for:)` and a persisted-then-reloaded file
    /// agree on what "no reactions" looks like.
    func removeLastReaction(for hos: HOS) {
        guard var list = reactions[hos.id], !list.isEmpty else { return }
        list.removeLast()
        reactions[hos.id] = list.isEmpty ? nil : list
    }

    func imageZoomState(for hos: HOS) -> ImageZoomState? {
        imageZoomStates[hos.id]
    }

    /// Passing `nil` clears the stored state (used once the image is back at 1x/no-offset, so a
    /// "reset" HOS doesn't linger as a redundant entry).
    func setImageZoomState(_ state: ImageZoomState?, for hos: HOS) {
        imageZoomStates[hos.id] = state
    }

    func drawingDisplayMode(for hos: HOS) -> DrawingDisplayMode {
        drawingDisplayModes[hos.id] ?? .photoAndDrawing
    }

    /// Choosing the default clears the stored entry, like `setImageZoomState(nil, for:)`.
    func setDrawingDisplayMode(_ mode: DrawingDisplayMode, for hos: HOS) {
        drawingDisplayModes[hos.id] = mode == .photoAndDrawing ? nil : mode
    }

    /// The saved drawing PNG for `hos`, loaded from disk once and then cached, since the
    /// header image reads this on every body pass (including each frame of a pinch or pan).
    func drawingImage(for hos: HOS) -> UIImage? {
        _ = drawingRevision
        guard let fileName = drawingFileNames[hos.id] else { return nil }
        if let cached = drawingImageCache[hos.id] {
            return cached
        }
        let image = HOSDrawingStore.loadImage(named: fileName)
        drawingImageCache[hos.id] = image
        return image
    }

    /// Links (or, with `nil`, unlinks) a drawing PNG already written by `HOSDrawingStore`.
    /// Unlike other state, this persists immediately: the PNG is already on disk, and losing the
    /// link to it if the app were killed before backgrounding would orphan the user's drawing.
    func setDrawingFileName(_ fileName: String?, for hos: HOS) {
        drawingFileNames[hos.id] = fileName
        drawingImageCache[hos.id] = nil
        drawingRevision += 1
        persistState()
    }

    /// Returns the next HOS in the current shuffle order, wrapping back to its start once
    /// every index has been served. Never reshuffles — only `resetViewed()` deals a new
    /// permutation — so resuming a random-mode slideshow just continues walking the same order.
    @discardableResult
    func nextRandomHOS() -> HOS? {
        guard !hosList.isEmpty else { return nil }

        if nextShuffleIndex >= shuffledIndexes.count {
            nextShuffleIndex = 0
        }

        let hos = hosList[shuffledIndexes[nextShuffleIndex]]
        nextShuffleIndex += 1
        return hos
    }

    /// Records `hos` as viewed. When `resetIfComplete` is set (the slideshow passes
    /// `true`) and every HOS has now been shown, resets viewed tracking — and, via
    /// `resetViewed()`, deals a fresh shuffle — so a long-running slideshow starts a new lap
    /// instead of sitting at full.
    func markViewed(_ hos: HOS, resetIfComplete: Bool = false) {
        viewedHOSIDs.insert(hos.id)
        if resetIfComplete, viewedHOSIDs.count >= hosList.count {
            resetViewed()
        }
    }

    /// Clears viewed tracking, deals a fresh shuffle, and rewinds the sequential slideshow back
    /// to the first HOS. This is the only place the random draw order is ever reshuffled —
    /// `nextRandomHOS()` just walks (and wraps within) whatever permutation was last dealt
    /// here.
    func resetViewed() {
        viewedHOSIDs.removeAll()
        shuffledIndexes = hosList.indices.shuffled()
        nextShuffleIndex = 0
        cycleCount += 1
        slideIndex = 0
    }

    // MARK: - Persistence
    //
    // Only `slideIndex`, `screen`, the shuffle state (`shuffledIndexes`/`nextShuffleIndex`), `reactions`,
    // `imageZoomStates`, `drawingDisplayModes`, and `drawingFileNames` survive across app launches — enough to resume browsing where the user left
    // off and keep their feedback, without also persisting `viewedHOSIDs`/`cycleCount`
    // (not asked for, and would make "Reset Visit Count" behave inconsistently across launches).
    //
    // Deliberately *not* written on every mutation: `persistState()` is only ever called from
    // `AppLandingView`'s `scenePhase` observer when the app backgrounds, so a slideshow ticking
    // every 0.1s or a reaction pick doesn't each cause a disk write — only leaving the app does.

    private struct PersistedState: Codable {
        var slideIndex: Int
        var shuffledIndexes: [Int]
        var nextShuffleIndex: Int
        /// String-keyed (rather than `[Int: [HOSReaction]]`) so the written JSON is a
        /// normal `{"1": ["🐘", "🐘", "🌍"], ...}` object instead of `Codable`'s
        /// flattened-array encoding of non-string-keyed dictionaries. Order matters here (it's
        /// add-order, and "-" pops the end), unlike the earlier `Set`-based version.
        var reactions: [String: [HOSReaction]]
        /// String-keyed for the same reason as `reactions` above.
        var imageZoomStates: [String: ImageZoomState]
        /// String-keyed like `reactions`. Optional so a state file written before drawings
        /// existed still decodes instead of discarding everything else in it.
        var drawingFileNames: [String: String]?
        /// String-keyed like `reactions`; optional like `drawingFileNames`, for older state files.
        var drawingDisplayModes: [String: DrawingDisplayMode]?
        /// `AppScreen` raw value. Optional for older state files, and a plain string so a screen
        /// this build doesn't know falls back to Landing instead of failing the whole decode.
        var screen: String?
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
        // Guards against a stale file left over from a build with a different HOS count
        // (e.g. after adding/removing entries in HOS.json) producing an out-of-range index.
        if state.shuffledIndexes.count == hosList.count {
            shuffledIndexes = state.shuffledIndexes
            nextShuffleIndex = state.nextShuffleIndex
        }
        if hosList.indices.contains(state.slideIndex) {
            slideIndex = state.slideIndex
        }
        screen = state.screen.flatMap(AppScreen.init(rawValue:)) ?? .landing
        reactions = Dictionary(uniqueKeysWithValues: state.reactions.compactMap { key, value in
            Int(key).map { ($0, value) }
        })
        imageZoomStates = Dictionary(uniqueKeysWithValues: state.imageZoomStates.compactMap { key, value in
            Int(key).map { ($0, value) }
        })
        drawingFileNames = Dictionary(uniqueKeysWithValues: (state.drawingFileNames ?? [:]).compactMap { key, value in
            Int(key).map { ($0, value) }
        })
        drawingDisplayModes = Dictionary(uniqueKeysWithValues: (state.drawingDisplayModes ?? [:]).compactMap { key, value in
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
            drawingFileNames: Dictionary(uniqueKeysWithValues: drawingFileNames.map { (String($0.key), $0.value) }),
            drawingDisplayModes: Dictionary(uniqueKeysWithValues: drawingDisplayModes.map { (String($0.key), $0.value) }),
            screen: screen.rawValue
        )
        guard let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: Self.stateFileURL(), options: .atomic)
    }
}
