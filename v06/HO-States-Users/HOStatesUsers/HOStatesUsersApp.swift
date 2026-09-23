import Supabase
import SwiftUI

@main
struct HOStatesUsersApp: App {
    /// A failure until `Supabase.plist` is filled in; the app then shows what's wrong instead of
    /// crashing, so a fresh clone still builds and runs.
    @State private var auth: Result<AuthModel, SupabaseConfig.LoadError> = SupabaseConfig.load().map { config in
        AuthModel(client: SupabaseClient(
            supabaseURL: config.url,
            supabaseKey: config.publishableKey,
            options: .init(auth: .init(emitLocalSessionAsInitialSession: true))
        ))
    }

    var body: some Scene {
        WindowGroup {
            switch auth {
            case .success(let auth):
                RootView()
                    .environment(auth)
                    .onOpenURL { url in
                        Task { await auth.handleAuthCallback(url) }
                    }
            case .failure(let error):
                SetupRequiredView(message: error.message)
            }
        }
    }
}
