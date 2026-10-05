import SwiftUI

/// The app's version and build number, e.g. "Version 0.6 (1003)". Both come from the target's
/// build settings (`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`).
struct AppVersionLabel: View {
    private static let text: String = {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Version \(version) (\(build))"
    }()

    var body: some View {
        Text(Self.text)
            .font(.footnote)
            .foregroundStyle(.secondary)
    }
}
