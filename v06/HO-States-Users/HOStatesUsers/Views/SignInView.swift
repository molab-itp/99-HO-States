import SwiftUI

/// Email a 6-digit code, or continue as a guest.
struct SignInView: View {
    @Environment(AuthModel.self) private var auth
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
