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
        isAnonymous: Bool = false,
        photoPath: String? = nil,
        photoOriginalPath: String? = nil,
        lastSeen: TimeInterval? = 0
    ) -> Profile {
        Profile(
            id: id, email: email, displayName: displayName, avatarURLString: nil,
            photoPath: photoPath, photoThumbPath: photoPath, photoOriginalPath: photoOriginalPath,
            isAnonymous: isAnonymous,
            createdAt: .now.addingTimeInterval(-30 * 24 * 60 * 60),
            lastSignInAt: .now.addingTimeInterval(-2 * 60 * 60),
            lastSeenAt: lastSeen.map { .now.addingTimeInterval(-$0) },
            lastSignOutAt: nil)
    }

    static let sampleMe = sample(email: "ada@example.com", displayName: "Ada Lovelace",
                                 photoPath: "preview/me-full.jpg", photoOriginalPath: "preview/me-original.jpg")

    /// Most recently active first, as `ProfilesService.fetchAll` returns them.
    static let samples: [Profile] = [
        sampleMe,
        sample(email: "grace@example.com", displayName: "Grace Hopper", lastSeen: 5 * 60),
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
