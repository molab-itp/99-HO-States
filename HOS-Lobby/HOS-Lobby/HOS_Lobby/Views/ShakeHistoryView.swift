import SwiftUI

/// One user's shake totals and every burst they've recorded; tap a burst for its details. Users
/// can delete their own bursts.
struct ShakeHistoryView: View {
    let profile: Profile
    let isCurrentUser: Bool
    /// Called after a delete, so the leaderboard catches up.
    var onChange: () async -> Void = {}

    @Environment(AuthModel.self) private var auth
    @State private var sessions: [ShakeSession] = []
    @State private var hasLoaded = false
    @State private var errorMessage: String?
    @State private var confirmingClear = false

    private var isPreview = false

    init(profile: Profile, isCurrentUser: Bool, onChange: @escaping () async -> Void = {}) {
        self.profile = profile
        self.isCurrentUser = isCurrentUser
        self.onChange = onChange
    }

    #if DEBUG
    init(profile: Profile, isCurrentUser: Bool, sampleSessions: [ShakeSession]) {
        self.profile = profile
        self.isCurrentUser = isCurrentUser
        _sessions = State(initialValue: sampleSessions)
        _hasLoaded = State(initialValue: true)
        isPreview = true
    }
    #endif

    private var service: ShakesService { ShakesService(client: auth.client) }

    var body: some View {
        List {
            if let errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }
            if !sessions.isEmpty {
                Section("Summary") {
                    stat("Total shakes", "\(sessions.reduce(0) { $0 + $1.shakeCount })")
                    stat("Bursts", "\(sessions.count)")
                    stat("Total time shaking",
                         sessions.reduce(0) { $0 + $1.duration }.shakeDurationText)
                    if let best = sessions.max(by: { $0.shakeCount < $1.shakeCount }) {
                        stat("Biggest burst", "\(best.shakeCount) in \(best.duration.shakeDurationText)")
                    }
                    if let last = sessions.first {
                        stat("Last burst", "\(last.shakeCount) in \(last.duration.shakeDurationText)")
                    }
                    if let strongest = sessions.compactMap(\.device?.peakAcceleration).max() {
                        stat("Strongest jolt", strongest.gText)
                    }
                    if let favorite = favoritePattern {
                        stat("Usual direction", favorite.label)
                    }
                }
                Section("History") {
                    ForEach(sessions) { session in
                        NavigationLink(value: session) {
                            HistoryRow(session: session)
                        }
                    }
                    .onDelete(perform: isCurrentUser ? { offsets in delete(at: offsets) } : nil)
                }
            }
        }
        .overlay {
            if !hasLoaded {
                ProgressView()
            } else if sessions.isEmpty && errorMessage == nil {
                ContentUnavailableView("No shakes yet", systemImage: "iphone.radiowaves.left.and.right")
            }
        }
        .navigationDestination(for: ShakeSession.self) { session in
            ShakeSessionDetailView(session: session)
        }
        .navigationTitle(profile.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isCurrentUser && !sessions.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Delete All Shakes", systemImage: "trash", role: .destructive) {
                        confirmingClear = true
                    }
                }
            }
        }
        .confirmationDialog("Delete all your shake stats?", isPresented: $confirmingClear,
                            titleVisibility: .visible) {
            Button("Delete \(sessions.count) Bursts", role: .destructive) { clearAll() }
        } message: {
            Text("This removes every burst you've recorded and takes you off the leaderboard.")
        }
        .refreshable { await reload() }
        .task { await reload() }
    }

    /// The most common pattern among bursts that have one, other than undetermined.
    private var favoritePattern: ShakePattern? {
        let patterns = sessions.compactMap { $0.device?.shakePattern }.filter { $0 != .undetermined }
        let counts = Dictionary(patterns.map { ($0, 1) }, uniquingKeysWith: +)
        return counts.max { $0.value < $1.value }?.key
    }

    private func stat(_ title: String, _ value: String) -> some View {
        LabeledContent(title, value: value)
            .monospacedDigit()
    }

    private func reload() async {
        guard !isPreview else { return }
        do {
            sessions = try await service.fetchHistory(userID: profile.id)
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
        hasLoaded = true
    }

    private func clearAll() {
        sessions.removeAll()
        guard !isPreview else { return }
        Task {
            do {
                try await service.clearStats(userIDs: [profile.id])
            } catch {
                errorMessage = error.localizedDescription
                await reload()
            }
            await onChange()
        }
    }

    private func delete(at offsets: IndexSet) {
        let doomed = offsets.map { sessions[$0] }
        sessions.remove(atOffsets: offsets)
        guard !isPreview else { return }
        Task {
            do {
                for session in doomed { try await service.delete(id: session.id) }
            } catch {
                errorMessage = error.localizedDescription
                await reload()
            }
            await onChange()
        }
    }
}

private struct HistoryRow: View {
    let session: ShakeSession

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(session.startedAt.formatted(date: .abbreviated, time: .standard))
                    .font(.subheadline)
                HStack(spacing: 6) {
                    Text(session.duration.shakeDurationText)
                    if let g = session.device?.averageAcceleration ?? session.device?.peakAcceleration {
                        Text("· \(ShakeIntensity.label(for: g))")
                    }
                    if let pattern = session.device?.shakePattern {
                        Image(systemName: pattern.systemImage)
                            .accessibilityLabel(pattern.label)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(session.shakeCount) shakes")
                .font(.headline.monospacedDigit())
        }
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ShakeHistoryView(profile: .sampleMe, isCurrentUser: true, sampleSessions: ShakeSession.samples(for: Profile.sampleMe.id))
    }
    .environment(AuthModel.preview())
}
#endif
