#if DEBUG
import Supabase
import UIKit

/// Sample data for SwiftUI previews. Nothing here touches the network: the client points at a
/// host that's never reached, so photo URLs fall back to their placeholders.
extension AuthModel {
    static func preview(state: State = .signedOut, errorMessage: String? = nil) -> AuthModel {
        let client = SupabaseClient(supabaseURL: URL(string: "https://preview.invalid")!, supabaseKey: "preview")
        let model = AuthModel(client: client, state: state)
        model.errorMessage = errorMessage
        return model
    }
}

extension Profile {
    static func sample(
        id: UUID = UUID(),
        email: String? = nil,
        displayName: String? = nil,
        caption: String? = nil,
        isAnonymous: Bool = false,
        photoPath: String? = nil,
        photoOriginalPath: String? = nil,
        lastSeen: TimeInterval? = 0
    ) -> Profile {
        Profile(
            id: id, email: email, displayName: displayName, avatarURLString: nil,
            photoPath: photoPath, photoThumbPath: photoPath, photoOriginalPath: photoOriginalPath,
            caption: caption, isAnonymous: isAnonymous,
            createdAt: .now.addingTimeInterval(-30 * 24 * 60 * 60),
            lastSignInAt: .now.addingTimeInterval(-2 * 60 * 60),
            lastSeenAt: lastSeen.map { .now.addingTimeInterval(-$0) },
            lastSignOutAt: nil)
    }

    static let sampleMe = sample(email: "ada@example.com", displayName: "Ada Lovelace",
                                 caption: "Writing the first program",
                                 photoPath: "preview/me-full.jpg", photoOriginalPath: "preview/me-original.jpg")

    /// Most recently active first, as `ProfilesService.fetchAll` returns them.
    static let samples: [Profile] = [
        sampleMe,
        sample(email: "grace@example.com", displayName: "Grace Hopper",
               caption: "Hunting bugs in the Mark II", lastSeen: 5 * 60),
        sample(email: "alan@example.com", lastSeen: 3 * 60 * 60),
        sample(isAnonymous: true, lastSeen: 2 * 24 * 60 * 60),
        sample(email: "new@example.com", lastSeen: nil),
    ]
}

extension UIImage {
    /// A landscape gradient to crop in `PhotoCropView` previews.
    static let sample = UIGraphicsImageRenderer(size: CGSize(width: 1200, height: 800)).image { context in
        let colors = [UIColor.systemTeal.cgColor, UIColor.systemIndigo.cgColor] as CFArray
        let gradient = CGGradient(colorsSpace: nil, colors: colors, locations: nil)!
        context.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 1200, y: 800), options: [])
    }
}
#endif

#if DEBUG
extension ShakeSession {
    static func samples(for userID: UUID) -> [ShakeSession] {
        let patterns: [ShakePattern] = [.upDown, .circle, .leftRight]
        return [(14, 3200, 120), (6, 1400, 3600), (22, 5100, 86_400)].enumerated().map { index, burst in
            let (count, ms, ago) = burst
            let step = Double(ms) / 1000 / Double(count - 1)
            let shakes = (0..<count).map { i in
                ShakeJolt(offset: Double(i) * step, peak: 1.8 + Double((i * 7) % 5) * 0.4,
                          axis: ShakeAxis.allCases[(i % 4 == 3) ? 1 : 0].rawValue)
            }
            let device = ShakeDeviceInfo(
                latitude: 40.6942, longitude: -73.9866, horizontalAccuracy: 12, altitude: 18,
                peakAcceleration: shakes.compactMap(\.peak).max(), averageAcceleration: 2.6,
                rmsAcceleration: 1.4, pattern: patterns[index].rawValue,
                axisShare: ShakeAxisShare(upDown: 0.71, leftRight: 0.18, forwardBack: 0.11),
                circularity: index == 1 ? 0.74 : 0.12, shakes: shakes,
                model: "iPhone17,1", systemName: "iOS", systemVersion: "26.1",
                appVersion: "0.8", appBuild: "1023", batteryLevel: 0.82, batteryState: "unplugged",
                timeZone: "America/New_York")
            return ShakeSession(id: UUID(), userID: userID, shakeCount: count, durationMS: ms,
                                startedAt: .now.addingTimeInterval(-Double(ago)), device: device)
        }
    }
}

extension ShakeRanking {
    static let samples: [ShakeRanking] = {
        let totals = Profile.samples.prefix(3).enumerated().map { index, profile in
            ShakeTotals(userID: profile.id, sessionCount: 3 - index, totalShakes: [42, 57, 9][index],
                        totalDurationMS: 9700, lastShakeCount: [14, 20, 9][index],
                        lastDurationMS: [3200, 4100, 1800][index],
                        lastShakeAt: .now.addingTimeInterval(-Double(index + 1) * 600))
        }
        return rank(profiles: Profile.samples, totals: totals)
    }()
}
#endif
