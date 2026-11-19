import CoreMotion
import Foundation
import simd

/// The overall direction of a burst of shaking.
enum ShakePattern: String, CaseIterable, Sendable {
    case upDown = "up_down"
    case leftRight = "left_right"
    case forwardBack = "forward_back"
    case circle
    case undetermined

    var label: String {
        switch self {
        case .upDown: "Up and down"
        case .leftRight: "Left and right"
        case .forwardBack: "Forward and back"
        case .circle: "In circles"
        case .undetermined: "Undetermined"
        }
    }

    var systemImage: String {
        switch self {
        case .upDown: "arrow.up.and.down"
        case .leftRight: "arrow.left.and.right"
        case .forwardBack: "arrow.up.left.and.arrow.down.right"
        case .circle: "arrow.clockwise.circle"
        case .undetermined: "questionmark"
        }
    }
}

/// One axis of motion, relative to the ground and to how the phone is held: up/down is along
/// gravity, left/right is along the phone's width (its height when held sideways) laid flat, and
/// forward/back is the remaining horizontal direction, toward or away from the user.
enum ShakeAxis: String, CaseIterable, Sendable {
    case upDown = "up_down"
    case leftRight = "left_right"
    case forwardBack = "forward_back"

    var label: String {
        switch self {
        case .upDown: "Up/down"
        case .leftRight: "Left/right"
        case .forwardBack: "Forward/back"
        }
    }

    var pattern: ShakePattern {
        switch self {
        case .upDown: .upDown
        case .leftRight: .leftRight
        case .forwardBack: .forwardBack
        }
    }
}

/// One shake within a burst, saved in `shake_sessions.device.shakes`.
struct ShakeJolt: Codable, Hashable, Sendable {
    /// Seconds since the burst's first shake.
    var offset: Double
    /// Strongest jolt in this shake, in g; nil for Simulator shakes.
    var peak: Double?
    /// `ShakeAxis` raw value of that jolt's main direction; nil for Simulator shakes.
    var axis: String?

    enum CodingKeys: String, CodingKey {
        case offset = "t"
        case peak
        case axis
    }

    var shakeAxis: ShakeAxis? { axis.flatMap(ShakeAxis.init(rawValue:)) }
}

/// Share of the burst's motion energy along each axis; the three add up to 1.
struct ShakeAxisShare: Codable, Hashable, Sendable {
    var upDown: Double
    var leftRight: Double
    var forwardBack: Double

    enum CodingKeys: String, CodingKey {
        case upDown = "up_down"
        case leftRight = "left_right"
        case forwardBack = "forward_back"
    }

    subscript(axis: ShakeAxis) -> Double {
        switch axis {
        case .upDown: upDown
        case .leftRight: leftRight
        case .forwardBack: forwardBack
        }
    }
}

/// How hard and which way a burst was shaken, worked out from its accelerometer samples.
struct ShakeMotionSummary: Equatable, Sendable {
    /// Mean of each shake's strongest jolt, in g.
    var averageAcceleration: Double
    /// Root mean square of the acceleration over the whole burst, in g: sustained effort.
    var rmsAcceleration: Double
    var pattern: ShakePattern
    var axisShare: ShakeAxisShare
    /// 0–1: how consistently the motion turned one way, in the plane of its two main axes.
    var circularity: Double
}

/// Intensity names for a shake's strength in g. Shakes only count above 1.6 g.
enum ShakeIntensity {
    static func label(for g: Double) -> String {
        switch g {
        case ..<2.2: "Gentle"
        case ..<3.2: "Firm"
        case ..<4.5: "Strong"
        default: "Vigorous"
        }
    }
}

/// Collects a burst's motion samples, splits each into up/down, left/right and forward/back
/// components, and classifies the burst when it ends.
struct ShakeMotionAnalyzer {
    struct Sample {
        let time: Date
        /// Components along `ShakeAxis.upDown`, `.leftRight`, `.forwardBack`, in g.
        let upDown: Double, leftRight: Double, forwardBack: Double
        var magnitude: Double { (upDown * upDown + leftRight * leftRight + forwardBack * forwardBack).squareRoot() }

        subscript(axis: ShakeAxis) -> Double {
            switch axis {
            case .upDown: upDown
            case .leftRight: leftRight
            case .forwardBack: forwardBack
            }
        }

        /// The axis carrying most of this sample.
        var mainAxis: ShakeAxis {
            ShakeAxis.allCases.max { abs(self[$0]) < abs(self[$1]) }!
        }
    }

    /// One linear axis must carry at least this share of the energy to name the burst after it.
    static let linearShare = 0.6
    /// A circle needs its two main axes this balanced (smaller / larger)…
    static let circleBalance = 0.35
    /// …and to turn the same way at least this consistently.
    static let circleConsistency = 0.5
    /// About 30 s at 60 Hz; longer bursts keep their first 30 s.
    static let maxSamples = 1800

    private(set) var samples: [Sample] = []

    /// Splits `motion.userAcceleration` into axes relative to gravity and the phone's width.
    static func sample(from motion: CMDeviceMotion, at time: Date) -> Sample {
        let a = SIMD3(motion.userAcceleration.x, motion.userAcceleration.y, motion.userAcceleration.z)
        var down = SIMD3(motion.gravity.x, motion.gravity.y, motion.gravity.z)
        let gravityLength = length(down)
        guard gravityLength > 0.1 else {
            // No usable gravity (free fall): fall back to the phone's own axes.
            return Sample(time: time, upDown: a.y, leftRight: a.x, forwardBack: a.z)
        }
        down /= gravityLength
        // The phone's width, laid flat. Held sideways the width points up, so use its height.
        var across = flatten(SIMD3(1, 0, 0), against: down)
        if length(across) < 0.3 { across = flatten(SIMD3(0, 1, 0), against: down) }
        across /= length(across)
        let ahead = cross(down, across)
        return Sample(time: time, upDown: dot(a, down), leftRight: dot(a, across), forwardBack: dot(a, ahead))
    }

    mutating func add(_ sample: Sample) {
        if samples.count < Self.maxSamples { samples.append(sample) }
    }

    mutating func reset() { samples.removeAll(keepingCapacity: true) }

    /// Summarizes the samples up to `end`, given each shake's peak; nil without enough samples.
    func summary(until end: Date, shakePeaks: [Double]) -> ShakeMotionSummary? {
        let used = samples.filter { $0.time <= end }
        guard used.count >= 6, !shakePeaks.isEmpty else { return nil }

        var energy: [ShakeAxis: Double] = [:]
        for axis in ShakeAxis.allCases {
            energy[axis] = used.reduce(0) { $0 + $1[axis] * $1[axis] }
        }
        let total = energy.values.reduce(0, +)
        guard total > 0 else { return nil }
        let share = ShakeAxisShare(upDown: energy[.upDown]! / total,
                                   leftRight: energy[.leftRight]! / total,
                                   forwardBack: energy[.forwardBack]! / total)
        let ranked = ShakeAxis.allCases.sorted { energy[$0]! > energy[$1]! }
        let (first, second) = (ranked[0], ranked[1])

        // Turning: the cross product of consecutive samples in the plane of the two main axes is
        // positive when the motion turns one way and negative the other. A circle keeps one sign;
        // a line or a jumble mixes them.
        var signed = 0.0, unsigned = 0.0
        for (prev, next) in zip(used, used.dropFirst()) {
            let turn = prev[first] * next[second] - prev[second] * next[first]
            signed += turn
            unsigned += abs(turn)
        }
        let circularity = unsigned > 0 ? abs(signed) / unsigned : 0

        let pattern: ShakePattern =
            if share[first] >= Self.linearShare {
                first.pattern
            } else if energy[second]! / energy[first]! >= Self.circleBalance,
                      circularity >= Self.circleConsistency {
                .circle
            } else {
                .undetermined
            }

        return ShakeMotionSummary(
            averageAcceleration: shakePeaks.reduce(0, +) / Double(shakePeaks.count),
            rmsAcceleration: (total / Double(used.count)).squareRoot(),
            pattern: pattern,
            axisShare: share,
            circularity: circularity)
    }

    private static func flatten(_ v: SIMD3<Double>, against down: SIMD3<Double>) -> SIMD3<Double> {
        v - dot(v, down) * down
    }
}
