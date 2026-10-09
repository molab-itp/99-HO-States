import SwiftUI

struct RootView: View {
    @Environment(AuthModel.self) private var auth

    var body: some View {
        Group {
            switch auth.state {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn(let user):
                UsersListView(currentUserID: user.id)
            }
        }
        .task { await auth.observeAuthChanges() }
    }
}
