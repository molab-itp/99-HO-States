import SwiftUI

struct UsersListView: View {
    let currentUserID: UUID

    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    @State private var profiles: [Profile] = []
    @State private var errorMessage: String?
    @State private var hasLoaded = false
    /// The latest live event about another user; clears itself after a few seconds.
    @State private var banner: UserEvent?

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
                Section {
                    ForEach(profiles) { profile in
                        NavigationLink(value: profile) {
                            ProfileRow(
                                profile: profile,
                                isCurrentUser: profile.id == currentUserID,
                                thumbURL: photos.publicURL(for: profile.photoThumbPath)
                            )
                        }
                    }
                } footer: {
                    AppVersionLabel()
                        .frame(maxWidth: .infinity)
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
            .safeAreaInset(edge: .bottom) {
                if let banner {
                    Label(banner.message, systemImage: banner.systemImage)
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(.regularMaterial, in: Capsule())
                        .shadow(radius: 4, y: 2)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .id(banner.id)
                }
            }
            .animation(.snappy, value: banner)
        }
        .task { await reload() }
        .task { await watchChanges() }
        .task(id: banner?.id) {
            guard banner != nil else { return }
            try? await Task.sleep(for: .seconds(4))
            if !Task.isCancelled { banner = nil }
        }
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

    /// Keeps the list live for as long as it's on screen, and announces what other users do.
    private func watchChanges() async {
        do {
            try await service.observeChanges { apply($0) }
        } catch is CancellationError {
            return
        } catch {
            errorMessage = "Live updates are off: \(error.localizedDescription)"
        }
    }

    private func apply(_ change: ProfilesService.Change) {
        switch change {
        case .inserted(let profile):
            upsert(profile)
            announce(.created, profile)
        case .updated(let profile):
            // Updates don't say which column changed, and most are `last_seen_at` bumps, so a
            // sign-in or sign-out is one that moves `last_sign_in_at` or `last_sign_out_at` on
            // from the copy already in the list. A new user's first sign-in counts too: their row
            // is created when the code is sent.
            if let known = profiles.first(where: { $0.id == profile.id }) {
                if let signedInAt = profile.lastSignInAt,
                   signedInAt.timeIntervalSince(known.lastSignInAt ?? .distantPast) > 1 {
                    announce(.signedIn, profile)
                } else if let signedOutAt = profile.lastSignOutAt,
                          signedOutAt.timeIntervalSince(known.lastSignOutAt ?? .distantPast) > 1 {
                    announce(.signedOut, profile)
                }
            }
            upsert(profile)
        case .deleted(let id):
            guard let index = profiles.firstIndex(where: { $0.id == id }) else { return }
            announce(.deleted, profiles.remove(at: index))
        }
    }

    /// Same order as `ProfilesService.fetchAll`: most recently active first, never-seen last.
    private func upsert(_ profile: Profile) {
        profiles.removeAll { $0.id == profile.id }
        profiles.append(profile)
        profiles.sort { ($0.lastSeenAt ?? .distantPast) > ($1.lastSeenAt ?? .distantPast) }
    }

    private func announce(_ kind: UserEvent.Kind, _ profile: Profile) {
        guard profile.id != currentUserID else { return }
        banner = UserEvent(kind: kind, name: profile.name)
    }
}
