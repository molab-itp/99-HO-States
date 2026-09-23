import SwiftUI

/// Email a magic link, or continue as a guest.
struct SignInView: View {
    @Environment(AuthModel.self) private var auth
    @State private var email = ""
    /// Non-nil once a link has been sent; the address it was sent to.
    @State private var linkSentTo: String?
    @State private var isWorking = false
    @FocusState private var isEmailFocused: Bool

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespaces).lowercased() }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: linkSentTo == nil ? "person.3.fill" : "envelope.badge.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text(linkSentTo == nil ? "HO Users" : "Check your email")
                .font(.largeTitle.bold())
            Text(linkSentTo.map { "Tap the sign-in link sent to \($0) on this device." }
                 ?? "Sign in to see who else is here.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()

            if linkSentTo != nil {
                linkSentStep
            } else {
                emailStep
            }

            if let message = auth.errorMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(32)
        .disabled(isWorking)
    }

    private var emailStep: some View {
        VStack(spacing: 12) {
            TextField("you@example.com", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
                .focused($isEmailFocused)
                .onSubmit(sendLink)
            Button(action: sendLink) {
                Text("Email Me a Sign-In Link").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!trimmedEmail.contains("@"))

            Button {
                isEmailFocused = false
                isWorking = true
                Task {
                    await auth.signInAsGuest()
                    isWorking = false
                }
            } label: {
                Text("Continue as Guest").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
    }

    private var linkSentStep: some View {
        HStack {
            Button("Use a different email") {
                linkSentTo = nil
                auth.errorMessage = nil
            }
            Spacer()
            Button("Resend link", action: sendLink)
        }
        .font(.footnote)
    }

    private func sendLink() {
        guard trimmedEmail.contains("@") else { return }
        let address = trimmedEmail
        isEmailFocused = false
        isWorking = true
        Task {
            if await auth.sendMagicLink(to: address) {
                linkSentTo = address
            }
            isWorking = false
        }
    }
}
