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
    /// Admins (`public.admins`) can check rows and delete those users from the Actions menu.
    @State private var isAdmin = false
    /// The checked rows, which the Actions menu works on.
    @State private var selection: Set<UUID> = []
    /// Up while the "are you sure" dialog for deleting the checked users is showing.
    @State private var isConfirmingDelete = false

    /// Set by previews, which show these instead of loading from Supabase.
    private var isPreview = false

    init(currentUserID: UUID) {
        self.currentUserID = currentUserID
    }

    #if DEBUG
    init(currentUserID: UUID, sampleProfiles: [Profile], isAdmin: Bool = false, banner: UserEvent? = nil) {
        self.currentUserID = currentUserID
        _profiles = State(initialValue: sampleProfiles)
        _hasLoaded = State(initialValue: true)
        _isAdmin = State(initialValue: isAdmin)
        _banner = State(initialValue: banner)
        isPreview = true
    }
    #endif

    private var service: ProfilesService { ProfilesService(client: auth.client) }
    private var photos: ProfilePhotoService { ProfilePhotoService(client: auth.client) }

    /// Whether rows show checkboxes. Delete is the only action so far, and it's admin-only;
    /// widen this when actions any user can take are added to the menu.
    private var canSelect: Bool { isAdmin }

    private var selectedProfiles: [Profile] { profiles.filter { selection.contains($0.id) } }

    /// The checked users Delete applies to: never the signed-in user.
    private var deletableSelection: [Profile] { selectedProfiles.filter { $0.id != currentUserID } }

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
                        HStack(spacing: 12) {
                            if canSelect {
                                checkbox(for: profile)
                            }
                            NavigationLink(value: profile) {
                                ProfileRow(
                                    profile: profile,
                                    isCurrentUser: profile.id == currentUserID,
                                    thumbURL: photos.publicURL(for: profile.photoThumbPath)
                                )
                            }
                        }
                    }
                } header: {
                    VStack(spacing: 4) {
                        AppVersionLabel(font: .caption2)
                            .frame(maxWidth: .infinity)
                        if hasLoaded && !profiles.isEmpty {
                            UserCountsView(profiles: profiles)
                        }
                    }
                    .textCase(nil)
                }
            }
            .overlay {
                if !hasLoaded {
                    ProgressView()
                } else if profiles.isEmpty && errorMessage == nil {
                    ContentUnavailableView("No users yet", systemImage: "person.slash")
                }
            }
            .navigationTitle("HOS-Lobby")
            .navigationDestination(for: Profile.self) { profile in
                ProfileDetailView(profile: profile, isCurrentUser: profile.id == currentUserID) {
                    await reload()
                }
            }
            .toolbar {
                if canSelect {
                    ToolbarItem(placement: .topBarLeading) {
                        actionsMenu
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign Out") {
                        Task { await auth.signOut() }
                    }
                }
            }
            .refreshable { await reload() }
            .confirmationDialog(
                deleteTitle,
                isPresented: $isConfirmingDelete,
                titleVisibility: .visible
            ) {
                Button(deletableSelection.count == 1 ? "Delete User" : "Delete \(deletableSelection.count) Users",
                       role: .destructive) {
                    Task { await delete(deletableSelection) }
                }
            } message: {
                Text("Their accounts, photos and saved data are removed for good.")
            }
            // Drop checks for users who are gone, e.g. deleted by another admin.
            .onChange(of: profiles) { _, newProfiles in
                selection.formIntersection(newProfiles.map(\.id))
            }
            .onChange(of: canSelect) { _, newValue in
                if !newValue { selection.removeAll() }
            }
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

    private func checkbox(for profile: Profile) -> some View {
        let isSelected = selection.contains(profile.id)
        return Button {
            if isSelected {
                selection.remove(profile.id)
            } else {
                selection.insert(profile.id)
            }
        } label: {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                .contentTransition(.symbolEffect(.replace))
        }
        // Borderless so a tap on the checkbox doesn't also open the row's NavigationLink.
        .buttonStyle(.borderless)
        .accessibilityLabel(isSelected ? "Deselect \(profile.name)" : "Select \(profile.name)")
    }

    /// Operations on the checked users. New ones go here, below the selection controls.
    private var actionsMenu: some View {
        Menu {
            Section {
                Button("Select All", systemImage: "checkmark.circle") {
                    selection = Set(profiles.map(\.id))
                }
                .disabled(selection.count == profiles.count)
                Button("Deselect All", systemImage: "circle") {
                    selection.removeAll()
                }
                .disabled(selection.isEmpty)
            }
            Section {
                Button(role: .destructive) {
                    isConfirmingDelete = true
                } label: {
                    Label(deletableSelection.isEmpty ? "Delete" : "Delete (\(deletableSelection.count))",
                          systemImage: "trash")
                }
                .disabled(deletableSelection.isEmpty)
            }
        } label: {
            Label(selection.isEmpty ? "Actions" : "Actions (\(selection.count))",
                  systemImage: "ellipsis.circle")
                .labelStyle(.titleAndIcon)
        }
    }

    private var deleteTitle: String {
        let users = deletableSelection
        return users.count == 1 ? "Delete \(users[0].name)?" : "Delete \(users.count) users?"
    }

    private func reload() async {
        guard !isPreview else { return }
        do {
            try await service.touchLastSeen()
            profiles = try await service.fetchAll()
            // Best effort: before the `admins` migration is pushed there is no `is_admin()`.
            isAdmin = (try? await service.isAdmin()) ?? false
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
        hasLoaded = true
    }

    /// Deletes one at a time and keeps going past failures, so one bad row doesn't block the rest.
    private func delete(_ users: [Profile]) async {
        var failures: [String] = []
        for profile in users {
            do {
                try await service.deleteUser(id: profile.id)
                // Realtime removes the row too; this covers live updates being off.
                profiles.removeAll { $0.id == profile.id }
                selection.remove(profile.id)
            } catch {
                failures.append("\(profile.name): \(error.localizedDescription)")
            }
        }
        errorMessage = failures.isEmpty ? nil : failures.joined(separator: "\n")
    }

    /// Keeps the list live for as long as it's on screen, and announces what other users do.
    private func watchChanges() async {
        guard !isPreview else { return }
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
            // An admin deleted this account: the session is dead, so go back to sign-in.
            if id == currentUserID {
                Task { await auth.signOut() }
                return
            }
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

/// Totals shown above the list: every user, and those seen in the last 24 hours. Ticks each
/// minute so users drop out of the 24-hour count without a reload.
private struct UserCountsView: View {
    let profiles: [Profile]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let cutoff = context.date.addingTimeInterval(-24 * 60 * 60)
            let activeCount = profiles.filter { ($0.lastSeenAt ?? .distantPast) > cutoff }.count
            HStack {
                stat("Total Users", profiles.count)
                Divider()
                    .frame(height: 12)
                stat("Active in 24h", activeCount)
            }
        }
    }

    private func stat(_ title: String, _ value: Int) -> some View {
        HStack(spacing: 2) {
            Text(value, format: .number)
                .font(.caption2.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview {
    UsersListView(currentUserID: Profile.sampleMe.id, sampleProfiles: Profile.samples, isAdmin: true,
                  banner: UserEvent(kind: .signedIn, name: "Grace Hopper"))
        .environment(AuthModel.preview())
}

#Preview("Empty") {
    UsersListView(currentUserID: UUID(), sampleProfiles: [])
        .environment(AuthModel.preview())
}
#endif
