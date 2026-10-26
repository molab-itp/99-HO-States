import Supabase
import SwiftUI

/// The Account screen pushed from `LandingView`, like News: `SignInView` while signed out,
/// otherwise who is signed in (with their profile photo), Export/Import of the app state (see
/// `AppStateHistory`), the other users with an Import action for each one's latest export, and a
/// Sign Out button.
struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(AppModel.self) private var appModel
    @State private var isSigningOut = false
    @State private var isTransferring = false
    /// When the user's most recent export was saved, from any device; `nil` if none or not loaded.
    @State private var lastExportAt: Date?
    @State private var transferMessage: String?
    /// Everyone in `profiles`, most recently active first, the signed-in user included; empty
    /// until loaded.
    @State private var profiles: [Profile] = []
    @State private var profilesError: String?

    var body: some View {
        Group {
            switch auth.state {
            case .loading:
                ProgressView()
            case .signedOut:
                ScrollView {
                    SignInView()
                }
            case .signedIn(let user):
                signedIn(user)
            }
        }
        .navigationTitle("Account")
    }

    private func signedIn(_ user: User) -> some View {
        let me = profiles.first { $0.id == user.id }
        let others = profiles.filter { $0.id != user.id }
        return List {
            Section {
                HStack {
                    Spacer()
                    ProfileImage(url: profilePhotoURL(me), size: 96)
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }

            Section {
                LabeledContent("Signed in as", value: Self.displayName(of: user))
                LabeledContent("Method", value: Self.method(of: user))
                if user.isAnonymous {
                    LabeledContent("Guest code") {
                        Text(Self.guestCode(of: user))
                            .font(.body.monospaced())
                    }
                }
            } footer: {
                Text(user.isAnonymous
                     ? "You'll appear in the HO Users lobby as \(Self.displayName(of: user))."
                     : "You'll appear in the HO Users lobby.")
            }

            Section {
                Button("Export App State", systemImage: "square.and.arrow.up", action: exportState)
                Button("Import App State", systemImage: "square.and.arrow.down", action: importState)
                if let lastExportAt {
                    LabeledContent("Last export", value: lastExportAt.formatted(date: .abbreviated, time: .shortened))
                }
                if let transferMessage {
                    Text(transferMessage)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("App State")
            } footer: {
                Text("Export saves your reactions, zoom, drawing display choices and Greatest progress as a new dated copy; earlier copies are kept. Import merges the most recent copy into this device. Drawings and your place in the slideshow stay on this device.")
            }
            .disabled(isTransferring)
            .task(id: user.id) {
                await loadLastExport()
                await loadProfiles()
            }

            Section {
                ForEach(others) { profile in
                    HStack(spacing: 12) {
                        ProfileImage(url: profilePhotoURL(profile), size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.name)
                                .lineLimit(1)
                            if let caption = profile.caption, !caption.isEmpty {
                                Text(caption)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer()
                        Button("Import", systemImage: "square.and.arrow.down") {
                            importState(from: profile)
                        }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Import from \(profile.name)")
                    }
                }
                if let profilesError {
                    Text(profilesError)
                        .foregroundStyle(.secondary)
                } else if others.isEmpty {
                    Text("No other users yet.")
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Other Users")
            } footer: {
                Text("Import merges that user's most recent export into this device, the same way as Import App State.")
            }
            .disabled(isTransferring)

            if let message = auth.errorMessage {
                Section {
                    Text(message)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    isSigningOut = true
                    Task {
                        await auth.signOut()
                        isSigningOut = false
                    }
                }
                .disabled(isSigningOut)
            }
        }
    }

    private var history: AppStateHistory { AppStateHistory(client: auth.client) }

    private var profilesService: ProfilesService { ProfilesService(client: auth.client) }

    private func loadLastExport() async {
        guard case .signedIn(let user) = auth.state else { return }
        lastExportAt = try? await history.latest(of: user.id)?.savedAt
    }

    private func loadProfiles() async {
        do {
            profiles = try await profilesService.fetchAll()
            profilesError = nil
        } catch {
            profilesError = "Couldn't load users: \(error.localizedDescription)"
        }
    }

    /// The uploaded photo's thumbnail, else the avatar from sign-in (if any).
    private func profilePhotoURL(_ profile: Profile?) -> URL? {
        guard let profile else { return nil }
        return profilesService.publicURL(for: profile.photoThumbPath) ?? profile.avatarURL
    }

    private func exportState() {
        isTransferring = true
        transferMessage = nil
        Task {
            do {
                try await history.export(appModel.snapshot())
                transferMessage = "Exported."
                await loadLastExport()
            } catch {
                transferMessage = "Export failed: \(error.localizedDescription)"
            }
            isTransferring = false
        }
    }

    private func importState() {
        guard case .signedIn(let user) = auth.state else { return }
        isTransferring = true
        transferMessage = nil
        Task {
            do {
                if let entry = try await history.latest(of: user.id) {
                    appModel.merge(entry.snapshot)
                    lastExportAt = entry.savedAt
                    transferMessage = "Merged the export from \(entry.savedAt.formatted(date: .abbreviated, time: .shortened))."
                } else {
                    transferMessage = "Nothing to import yet. Export first, on this or another device."
                }
            } catch {
                transferMessage = "Import failed: \(error.localizedDescription)"
            }
            isTransferring = false
        }
    }

    /// Merges `profile`'s latest export, reporting the result under App State. Leaves
    /// `lastExportAt` alone, since that's this user's own export.
    private func importState(from profile: Profile) {
        isTransferring = true
        transferMessage = nil
        Task {
            do {
                if let entry = try await history.latest(of: profile.id) {
                    appModel.merge(entry.snapshot)
                    transferMessage = "Merged \(profile.name)'s export from \(entry.savedAt.formatted(date: .abbreviated, time: .shortened))."
                } else {
                    transferMessage = "\(profile.name) hasn't exported yet."
                }
            } catch {
                transferMessage = "Import failed: \(error.localizedDescription)"
            }
            isTransferring = false
        }
    }

    /// The email, or the name Apple gave on first sign-in, or "Guest XXXX" as the HO Users lobby
    /// shows it (`Profile.name` in v06).
    static func displayName(of user: User) -> String {
        if let email = user.email, !email.isEmpty { return email }
        if case .string(let name)? = user.userMetadata["full_name"], !name.isEmpty { return name }
        return "Guest \(guestCode(of: user))"
    }

    /// The slice of the user id that tells guests apart in the lobby.
    static func guestCode(of user: User) -> String {
        String(user.id.uuidString.prefix(4))
    }

    private static func method(of user: User) -> String {
        if user.isAnonymous { return "Guest" }
        switch user.appMetadata["provider"] {
        case .string("apple")?: return "Sign in with Apple"
        case .string("email")?: return "Email code"
        case .string(let other)?: return other
        default: return "Unknown"
        }
    }
}

/// A round profile photo, or a placeholder symbol while loading or when there's none.
private struct ProfileImage: View {
    let url: URL?
    let size: CGFloat

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.secondary)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

#if DEBUG
#Preview("Signed out") {
    NavigationStack {
        AccountView()
    }
    .environment(AuthModel.preview())
    .environment(AppModel())
}
#endif
