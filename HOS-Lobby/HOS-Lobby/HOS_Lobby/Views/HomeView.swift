import SwiftUI

/// The signed-in landing page: a welcome and the app's sections.
struct HomeView: View {
    let currentUserID: UUID

    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase

    enum Route: Hashable {
        case users, shakes
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 8) {
                        Image(systemName: "door.left.hand.open")
                            .font(.system(size: 48))
                            .foregroundStyle(.tint)
                        Text("Welcome to HOS-Lobby")
                            .font(.title2.bold())
                            .multilineTextAlignment(.center)
                        AppVersionLabel(font: .caption2)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .listRowBackground(Color.clear)
                }
                Section {
                    NavigationLink(value: Route.users) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Users").font(.headline)
                                Text("Everyone who has signed on, most recently active first")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "person.2.fill")
                        }
                    }
                    NavigationLink(value: Route.shakes) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Shakes").font(.headline)
                                Text("Shake your phone and see who has shaken the most")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "iphone.radiowaves.left.and.right")
                        }
                    }
                }
            }
            .navigationTitle("HOS-Lobby")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .users: UsersListView(currentUserID: currentUserID)
                case .shakes: ShakesView(currentUserID: currentUserID)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign Out") {
                        Task { await auth.signOut() }
                    }
                }
            }
        }
        // App opens count as activity in the Users list even if it's never opened.
        .task { try? await ProfilesService(client: auth.client).touchLastSeen() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { try? await ProfilesService(client: auth.client).touchLastSeen() }
            }
        }
    }
}

#if DEBUG
#Preview {
    HomeView(currentUserID: Profile.sampleMe.id)
        .environment(AuthModel.preview())
}
#endif
