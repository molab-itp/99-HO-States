import Supabase
import SwiftUI

/// The Account sheet opened from `LandingView`: `SignInView` while signed out, otherwise who is
/// signed in, Export/Import of the app state (see `AppStateHistory`), and a Sign Out button.
struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss
    @State private var isSigningOut = false
    @State private var isTransferring = false
    /// When the user's most recent export was saved, from any device; `nil` if none or not loaded.
    @State private var lastExportAt: Date?
    @State private var transferMessage: String?

    var body: some View {
        NavigationStack {
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func signedIn(_ user: User) -> some View {
        List {
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
            .task(id: user.id) { await loadLastExport() }

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

    private func loadLastExport() async {
        lastExportAt = try? await history.latest()?.savedAt
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
        isTransferring = true
        transferMessage = nil
        Task {
            do {
                if let entry = try await history.latest() {
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

#if DEBUG
#Preview("Signed out") {
    AccountView()
        .environment(AuthModel.preview())
        .environment(AppModel())
}
#endif
