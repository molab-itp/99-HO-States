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

    /// Emails a 6-digit code, creating the user on first use. The code comes from `{{ .Token }}`
    /// in the "Confirm signup" and "Magic Link" email templates. The templates leave out the link
    /// (`{{ .ConfirmationURL }}`) because mail scanners open it and use up the shared token; if
    /// it's added back, it reopens the app at `SupabaseConfig.authRedirectURL`, which
    /// `handleAuthCallback` finishes. Returns whether the email was sent, so the UI can switch to
    /// "enter the code".
    func sendSignInEmail(to email: String) async -> Bool {
        errorMessage = nil
        do {
            try await client.auth.signInWithOTP(email: email, redirectTo: SupabaseConfig.authRedirectURL)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Verifies the 6-digit code from the email, which fires `authStateChanges`. Unlike the link,
    /// the code works on any device, so the email can be read on a phone or Mac.
    func verifyCode(_ code: String, email: String) async -> Bool {
        errorMessage = nil
        do {
            _ = try await client.auth.verifyOTP(email: email, token: code, type: .email)
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

    /// Native Sign in with Apple: exchanges Apple's ID token for a Supabase session, which fires
    /// `authStateChanges`. `nonce` is the raw value whose SHA-256 went into the Apple request;
    /// Supabase hashes it again to check the token. Apple sends the name only on the very first
    /// authorization, and it isn't in the token, so it's saved to user metadata as `full_name`,
    /// which the `profiles` trigger copies to `display_name`. Needs the Apple provider enabled in
    /// the Supabase dashboard, with the app's bundle id as a Client ID.
    func signInWithApple(idToken: String, nonce: String, fullName: PersonNameComponents?) async {
        errorMessage = nil
        do {
            try await client.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))
            let name = fullName.map { $0.formatted() } ?? ""
            if !name.isEmpty {
                try await client.auth.update(user: UserAttributes(data: ["full_name": .string(name)]))
            }
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
