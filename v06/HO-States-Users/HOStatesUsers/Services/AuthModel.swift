import Foundation
import Observation
import Supabase

/// Owns the `SupabaseClient` and mirrors its auth session into SwiftUI-observable state.
@Observable
@MainActor
final class AuthModel {
    enum State {
        case loading
        case signedOut
        case signedIn(User)
    }

    let client: SupabaseClient
    private(set) var state: State = .loading
    var errorMessage: String?

    init(client: SupabaseClient) {
        self.client = client
    }

    /// Runs for the app's lifetime (started from `RootView`'s `.task`). The first event is the
    /// locally stored session, if any, so a returning user goes straight to the list; the client
    /// refreshes an expired token on its own and emits `.signedOut` if that fails.
    func observeAuthChanges() async {
        for await (_, session) in client.auth.authStateChanges {
            state = session.map { .signedIn($0.user) } ?? .signedOut
        }
    }

    /// Emails a sign-in link, creating the user on first use. It uses Supabase's default email
    /// template, so nothing needs editing on the free plan. Tapping the link in Mail on this device
    /// reopens the app at `SupabaseConfig.authRedirectURL`, which `handleAuthCallback` finishes.
    /// Returns whether the email was sent, so the UI can switch to "check your email".
    func sendMagicLink(to email: String) async -> Bool {
        errorMessage = nil
        do {
            try await client.auth.signInWithOTP(email: email, redirectTo: SupabaseConfig.authRedirectURL)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Exchanges the magic link's one-time code for a session, which fires `authStateChanges`.
    /// Links use PKCE, so they only work in the app install that requested them.
    func handleAuthCallback(_ url: URL) async {
        errorMessage = nil
        do {
            _ = try await client.auth.session(from: url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// "Continue as Guest": a real user with its own id (so `app_state` and RLS work as usual),
    /// but no email. Needs "Allow anonymous sign-ins" enabled in the Supabase dashboard.
    func signInAsGuest() async {
        errorMessage = nil
        do {
            try await client.auth.signInAnonymously()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        do {
            try await client.auth.signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
