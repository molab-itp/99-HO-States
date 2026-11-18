import CoreMotion
import Foundation
import Observation

/// Counts shakes from the accelerometer and groups them into bursts. A shake is a jolt of
/// `userAcceleration` (gravity removed) above `threshold`; jolts closer than `minGap` together are
/// one shake (a single flick spikes several samples). A burst ends after `burstTimeout` with no
/// shake, and is then handed to `onBurstEnded`.
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

    func start() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 60
        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let self, let a = data?.userAcceleration else { return }
            let magnitude = (a.x * a.x + a.y * a.y + a.z * a.z).squareRoot()
            if magnitude > self.threshold { self.registerShake() }
        }
    }

    /// Stops listening and finishes any burst in progress, so it isn't lost.
    func stop() {
        motion.stopDeviceMotionUpdates()
        finishBurst()
    }

    func registerShake(at now: Date = .now) {
        if let last = lastShakeAt, now.timeIntervalSince(last) < minGap { return }
        if currentStart == nil { currentStart = now }
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
        }
        guard currentCount > 0, let start = currentStart else { return }
        let burst = Burst(count: currentCount, startedAt: start,
                          duration: (lastShakeAt ?? start).timeIntervalSince(start))
        lastBurst = burst
        onBurstEnded?(burst)
    }
}
