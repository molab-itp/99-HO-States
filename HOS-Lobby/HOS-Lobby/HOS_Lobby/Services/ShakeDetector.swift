import CoreMotion
import Foundation
import Observation

/// Counts shakes from the accelerometer and groups them into bursts. A shake is a jolt of
/// `userAcceleration` (gravity removed) above `threshold`; jolts closer than `minGap` together are
/// one shake (a single flick spikes several samples). A burst ends after `burstTimeout` with no
/// shake, and is then handed to `onBurstEnded`, with each shake's strength and direction and the
/// burst's overall pattern (see `ShakeMotionAnalyzer`).
///
/// The Simulator has no accelerometer; there, `registerShake()` is called from the UIKit shake
/// gesture (Device ▸ Shake), so each gesture counts as one shake.
@Observable
@MainActor
final class ShakeDetector {
    struct Burst: Equatable {
        let count: Int
        let startedAt: Date
        let duration: TimeInterval
        /// Strongest jolt in the burst, in g; nil for Simulator shakes.
        var peakAcceleration: Double?
        /// Intensity and direction; nil for Simulator shakes.
        var motion: ShakeMotionSummary?
        /// One entry per counted shake.
        var shakes: [ShakeJolt] = []
    }

    /// Shakes so far in the burst in progress (0 when idle).
    private(set) var currentCount = 0
    private(set) var currentStart: Date?
    private(set) var lastShakeAt: Date?
    /// The most recent finished burst.
    private(set) var lastBurst: Burst?

    @ObservationIgnored var onBurstEnded: ((Burst) -> Void)?

    var isAccelerometerAvailable: Bool { motion.isAccelerometerAvailable }
    var isShaking: Bool { currentCount > 0 }

    /// In g. A firm wrist shake peaks around 2–3 g; walking stays under 1.
    @ObservationIgnored var threshold = 1.6
    @ObservationIgnored var minGap: TimeInterval = 0.2
    @ObservationIgnored var burstTimeout: TimeInterval = 1.2

    @ObservationIgnored private let motion = CMMotionManager()
    @ObservationIgnored private var timeoutTask: Task<Void, Never>?
    @ObservationIgnored private var currentPeak: Double?
    @ObservationIgnored private var currentShakes: [ShakeJolt] = []
    @ObservationIgnored private var analyzer = ShakeMotionAnalyzer()
    /// Caps the per-shake list saved with a burst.
    @ObservationIgnored private let maxShakesSaved = 300

    func start() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 60
        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let self, let data else { return }
            let now = Date.now
            let sample = ShakeMotionAnalyzer.sample(from: data, at: now)
            // Only samples during a burst are kept; the one that starts a burst is added by
            // registerShake.
            if self.isShaking { self.analyzer.add(sample) }
            if sample.magnitude > self.threshold { self.registerShake(at: now, sample: sample) }
        }
    }

    /// Stops listening and finishes any burst in progress, so it isn't lost.
    func stop() {
        motion.stopDeviceMotionUpdates()
        finishBurst()
    }

    /// Counts a jolt. `sample` is nil for the Simulator's shake gesture.
    func registerShake(at now: Date = .now, sample: ShakeMotionAnalyzer.Sample? = nil) {
        let magnitude = sample?.magnitude
        // Every jolt counts toward the peak, even ones too close together to be a new shake.
        if let magnitude { currentPeak = max(currentPeak ?? 0, magnitude) }
        if let last = lastShakeAt, now.timeIntervalSince(last) < minGap {
            // Part of the shake just counted: keep that shake's strongest jolt.
            if let sample, let magnitude, let i = currentShakes.indices.last,
               magnitude > currentShakes[i].peak ?? 0 {
                currentShakes[i].peak = magnitude
                currentShakes[i].axis = sample.mainAxis.rawValue
            }
            return
        }
        if currentStart == nil {
            currentStart = now
            analyzer.reset()
            if let sample { analyzer.add(sample) }
        }
        if currentShakes.count < maxShakesSaved {
            currentShakes.append(ShakeJolt(offset: now.timeIntervalSince(currentStart ?? now),
                                           peak: magnitude, axis: sample?.mainAxis.rawValue))
        }
        currentCount += 1
        lastShakeAt = now
        timeoutTask?.cancel()
        timeoutTask = Task { [weak self, burstTimeout] in
            try? await Task.sleep(for: .seconds(burstTimeout))
            guard !Task.isCancelled else { return }
            self?.finishBurst()
        }
    }

    private func finishBurst() {
        timeoutTask?.cancel()
        timeoutTask = nil
        defer {
            currentCount = 0
            currentStart = nil
            lastShakeAt = nil
            currentPeak = nil
            currentShakes = []
            analyzer.reset()
        }
        guard currentCount > 0, let start = currentStart else { return }
        let last = lastShakeAt ?? start
        // The burst's motion runs until its last shake has played out, not to the timeout.
        let motion = analyzer.summary(until: last.addingTimeInterval(minGap),
                                      shakePeaks: currentShakes.compactMap(\.peak))
        let burst = Burst(count: currentCount, startedAt: start,
                          duration: last.timeIntervalSince(start),
                          peakAcceleration: currentPeak, motion: motion, shakes: currentShakes)
        lastBurst = burst
        onBurstEnded?(burst)
    }
}
