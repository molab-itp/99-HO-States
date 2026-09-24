import AuthenticationServices
import CryptoKit
import SwiftUI

/// Email a 6-digit code, Sign in with Apple, or continue as a guest.
struct SignInView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(\.colorScheme) private var colorScheme
    /// Raw nonce for the Apple request in flight; Apple gets its SHA-256, Supabase gets this.
    @State private var appleNonce: String?
    @State private var email = ""
    /// Non-nil once a code has been sent; the address it was sent to.
    @State private var codeSentTo: String?
    @State private var code = ""
    @State private var isWorking = false
    @FocusState private var isEmailFocused: Bool
    @FocusState private var isCodeFocused: Bool

    private static let codeLength = 6

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespaces).lowercased() }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: codeSentTo == nil ? "person.3.fill" : "envelope.badge.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text(codeSentTo == nil ? "HO Users" : "Check your email")
                .font(.largeTitle.bold())
            Text(codeSentTo.map { "Enter the \(Self.codeLength)-digit code sent to \($0)." }
                 ?? "Sign in to see who else is here.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()

            if codeSentTo != nil {
                codeStep
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
                .onSubmit(sendCode)
            Button(action: sendCode) {
                Text("Email Me a Sign-In Code").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!trimmedEmail.contains("@"))

            SignInWithAppleButton(.signIn, onRequest: configureAppleRequest, onCompletion: finishAppleSignIn)
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 50)

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

    private var codeStep: some View {
        VStack(spacing: 12) {
            TextField("123456", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .font(.title2.monospacedDigit())
                .multilineTextAlignment(.center)
                .textFieldStyle(.roundedBorder)
                .focused($isCodeFocused)
                .onChange(of: code) {
                    // Keep digits only (pasted codes may carry spaces); submit once complete.
                    let digits = String(code.filter(\.isNumber).prefix(Self.codeLength))
                    if digits != code { code = digits }
                    if digits.count == Self.codeLength { verify() }
                }
            Button(action: verify) {
                Text("Sign In").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(code.count != Self.codeLength)

            HStack {
                Button("Use a different email") {
                    codeSentTo = nil
                    code = ""
                    auth.errorMessage = nil
                }
                Spacer()
                Button("Resend code", action: sendCode)
            }
            .font(.footnote)
        }
        .onAppear { isCodeFocused = true }
    }

    private func sendCode() {
        guard trimmedEmail.contains("@") else { return }
        let address = trimmedEmail
        isEmailFocused = false
        isWorking = true
        Task {
            if await auth.sendSignInEmail(to: address) {
                codeSentTo = address
                code = ""
            }
            isWorking = false
        }
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        isEmailFocused = false
        auth.errorMessage = nil
        let nonce = Self.randomNonce()
        appleNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func finishAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = appleNonce else {
                auth.errorMessage = "Sign in with Apple didn't return an identity token."
                return
            }
            isWorking = true
            Task {
                await auth.signInWithApple(idToken: idToken, nonce: nonce, fullName: credential.fullName)
                isWorking = false
            }
        case .failure(let error):
            // Closing the Apple sheet isn't an error worth showing.
            if (error as? ASAuthorizationError)?.code != .canceled {
                auth.errorMessage = error.localizedDescription
            }
        }
    }

    private static func randomNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private func verify() {
        guard let address = codeSentTo, code.count == Self.codeLength, !isWorking else { return }
        isCodeFocused = false
        isWorking = true
        Task {
            let ok = await auth.verifyCode(code, email: address)
            isWorking = false
            if !ok {
                code = ""
                isCodeFocused = true
            }
        }
    }
}
