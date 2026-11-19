import Foundation

/// A row of `public.shake_sessions`: one burst of shaking.
struct ShakeSession: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let userID: UUID
    let shakeCount: Int
    let durationMS: Int
    let startedAt: Date
    /// Location, altitude and device details; nil when fetched without the `device` column.
    var device: ShakeDeviceInfo? = nil

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case shakeCount = "shake_count"
        case durationMS = "duration_ms"
        case startedAt = "started_at"
        case device
    }

    var duration: TimeInterval { TimeInterval(durationMS) / 1000 }
}

/// What the app inserts; the database fills in `id`, `user_id` and `created_at`.
struct NewShakeSession: Encodable, Sendable {
    let shakeCount: Int
    let durationMS: Int
    let startedAt: Date
    let device: ShakeDeviceInfo

    enum CodingKeys: String, CodingKey {
        case shakeCount = "shake_count"
        case durationMS = "duration_ms"
        case startedAt = "started_at"
        case device
    }
}

/// A row of the `public.shake_totals` view: one user's totals and latest burst.
struct ShakeTotals: Codable, Hashable, Sendable {
    let userID: UUID
    let sessionCount: Int
    let totalShakes: Int
    let totalDurationMS: Int
    let lastShakeCount: Int
    let lastDurationMS: Int
    let lastShakeAt: Date

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case sessionCount = "session_count"
        case totalShakes = "total_shakes"
        case totalDurationMS = "total_duration_ms"
        case lastShakeCount = "last_shake_count"
        case lastDurationMS = "last_duration_ms"
        case lastShakeAt = "last_shake_at"
    }

    var lastDuration: TimeInterval { TimeInterval(lastDurationMS) / 1000 }
}

/// A leaderboard row: a user and their totals (`nil` if they've never shaken).
struct ShakeRanking: Identifiable, Hashable, Sendable {
    let profile: Profile
    let totals: ShakeTotals?

    var id: UUID { profile.id }
    var totalShakes: Int { totals?.totalShakes ?? 0 }

    /// Most shakes first; ties go to whoever shook most recently, and never-shaken users sort by
    /// name at the bottom.
    static func rank(profiles: [Profile], totals: [ShakeTotals]) -> [ShakeRanking] {
        let byUser = Dictionary(totals.map { ($0.userID, $0) }, uniquingKeysWith: { a, _ in a })
        return profiles
            .map { ShakeRanking(profile: $0, totals: byUser[$0.id]) }
            .sorted { a, b in
                if a.totalShakes != b.totalShakes { return a.totalShakes > b.totalShakes }
                let aAt = a.totals?.lastShakeAt ?? .distantPast, bAt = b.totals?.lastShakeAt ?? .distantPast
                if aAt != bAt { return aAt > bAt }
                return a.profile.name.localizedCaseInsensitiveCompare(b.profile.name) == .orderedAscending
            }
    }
}

extension TimeInterval {
    /// "2.4 s" — shake bursts are short, so seconds with one decimal.
    var shakeDurationText: String {
        "\(formatted(.number.precision(.fractionLength(1)))) s"
    }
}
