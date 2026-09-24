import SwiftUI

struct UsersListView: View {
    let currentUserID: UUID

    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    @State private var profiles: [Profile] = []
    @State private var errorMessage: String?
    @State private var hasLoaded = false

    private var service: ProfilesService { ProfilesService(client: auth.client) }
    private var photos: ProfilePhotoService { ProfilePhotoService(client: auth.client) }

    var body: some View {
        NavigationStack {
            List {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                ForEach(profiles) { profile in
                    NavigationLink(value: profile) {
                        ProfileRow(
                            profile: profile,
                            isCurrentUser: profile.id == currentUserID,
                            thumbURL: photos.publicURL(for: profile.photoThumbPath)
                        )
                    }
                }
            }
            .overlay {
                if !hasLoaded {
                    ProgressView()
                } else if profiles.isEmpty && errorMessage == nil {
                    ContentUnavailableView("No users yet", systemImage: "person.slash")
                }
            }
            .navigationTitle("Signed-on Users")
            .navigationDestination(for: Profile.self) { profile in
                ProfileDetailView(profile: profile, isCurrentUser: profile.id == currentUserID) {
                    await reload()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign Out") {
                        Task { await auth.signOut() }
                    }
                }
            }
            .refreshable { await reload() }
        }
        .task { await reload() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { await reload() }
            }
        }
    }

    private func reload() async {
        do {
            try await service.touchLastSeen()
            profiles = try await service.fetchAll()
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
        hasLoaded = true
    }
}
