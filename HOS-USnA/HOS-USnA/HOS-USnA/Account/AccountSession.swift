import Supabase
import SwiftUI

/// Builds the app's `AuthModel` from the bundled (gitignored) `Supabase.plist`. `nil` when the
/// plist is missing or still holds the example values: v2 then simply has no Account feature,
/// rather than showing v06's full-screen `SetupRequiredView`, since sign-in is optional here.
enum AccountSession {
    static func makeAuthModel() -> AuthModel? {
        switch SupabaseConfig.load() {
        case .success(let config):
            return AuthModel(client: SupabaseClient(
                supabaseURL: config.url,
                supabaseKey: config.publishableKey,
                options: .init(auth: .init(emitLocalSessionAsInitialSession: true))
            ))
        case .failure(let error):
            print("Account disabled: \(error.message)")
            return nil
        }
    }
}

extension View {
    /// Puts `auth` in the environment (as an optional `AuthModel`), mirrors its session for the
    /// app's lifetime, and marks the user active in `profiles` whenever the app comes to the
    /// foreground signed in. Sign-in only: nothing in `AppModel` is uploaded or downloaded.
    func accountSession(_ auth: AuthModel?) -> some View {
        modifier(AccountSessionModifier(auth: auth))
    }
}

private struct AccountSessionModifier: ViewModifier {
    let auth: AuthModel?
    @Environment(\.scenePhase) private var scenePhase

    /// The signed-in user's id while the app is active, so `touchLastSeen` runs on each sign-in
    /// and each return to the foreground.
    private var activeUserID: UUID? {
        guard scenePhase == .active, case .signedIn(let user) = auth?.state else { return nil }
        return user.id
    }

    func body(content: Content) -> some View {
        content
            .environment(auth)
            .task { await auth?.observeAuthChanges() }
            .task(id: activeUserID) {
                guard activeUserID != nil, let auth else { return }
                try? await ProfilesService(client: auth.client).touchLastSeen()
            }
    }
}
