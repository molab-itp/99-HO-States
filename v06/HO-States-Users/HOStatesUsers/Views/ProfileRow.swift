import SwiftUI

struct ProfileRow: View {
    let profile: Profile
    let isCurrentUser: Bool

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: profile.avatarURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Image(systemName: "person.crop.circle.fill")
                    .resizable()
                    .foregroundStyle(.secondary)
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(profile.name)
                        .font(.headline)
                    if isCurrentUser {
                        Text("You")
                            .font(.caption.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.tint.opacity(0.15), in: Capsule())
                    }
                }
                // `name` already falls back to the email, so only repeat it under a real name.
                if profile.displayName != nil, let email = profile.email {
                    Text(email)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let lastSeen = profile.lastSeenAt {
                    Text("Active \(lastSeen.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}
