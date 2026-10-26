import Supabase
import SwiftUI

/// The Account sheet opened from `LandingView`: `SignInView` while signed out, otherwise who is
/// signed in and a Sign Out button. Signing in doesn't change anything else in the app yet.
struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var isSigningOut = false

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
            } footer: {
                Text("You'll appear in the HO Users lobby. Reactions, drawings and your place in the slideshow stay on this device for now.")
            }

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

    /// The email, or the name Apple gave on first sign-in, or "Guest".
    static func displayName(of user: User) -> String {
        if let email = user.email, !email.isEmpty { return email }
        if case .string(let name)? = user.userMetadata["full_name"], !name.isEmpty { return name }
        return "Guest"
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
}
#endif
