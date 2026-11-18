import SwiftUI

/// Records the signed-in user's shakes while open, and ranks every user by total shakes.
struct ShakesView: View {
    let currentUserID: UUID

    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    @State private var detector = ShakeDetector()
    @State private var rankings: [ShakeRanking] = []
    @State private var hasLoaded = false
    @State private var errorMessage: String?
    @State private var isSaving = false

    private var isPreview = false

    init(currentUserID: UUID) {
        self.currentUserID = currentUserID
    }

    #if DEBUG
    init(currentUserID: UUID, sampleRankings: [ShakeRanking]) {
        self.currentUserID = currentUserID
        _rankings = State(initialValue: sampleRankings)
        _hasLoaded = State(initialValue: true)
        isPreview = true
    }
    #endif

    private var service: ShakesService { ShakesService(client: auth.client) }
    private var photos: ProfilePhotoService { ProfilePhotoService(client: auth.client) }
    private var myTotals: ShakeTotals? { rankings.first { $0.id == currentUserID }?.totals }

    var body: some View {
        List {
            Section {
                recorder
            } header: {
                Text("Your shaking")
            } footer: {
                if !detector.isAccelerometerAvailable && !isPreview {
                    Text("No accelerometer here. In the Simulator, use Device ▸ Shake: each one counts as a shake.")
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Section("Leaderboard") {
                ForEach(Array(rankings.enumerated()), id: \.element.id) { index, ranking in
                    NavigationLink(value: ranking) {
                        ShakeRankingRow(rank: index + 1, ranking: ranking,
                                        isCurrentUser: ranking.id == currentUserID,
                                        thumbURL: photos.publicURL(for: ranking.profile.photoThumbPath))
                    }
                }
            }
        }
        .overlay {
            if !hasLoaded { ProgressView() }
        }
        .navigationTitle("Shakes")
        .navigationDestination(for: ShakeRanking.self) { ranking in
            ShakeHistoryView(profile: ranking.profile, isCurrentUser: ranking.id == currentUserID) {
                await reload()
            }
        }
        .refreshable { await reload() }
        .task { await reload() }
        .task { await watchChanges() }
        .onAppear {
            detector.onBurstEnded = { burst in Task { await save(burst) } }
            detector.start()
        }
        .onDisappear { detector.stop() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { detector.start() } else { detector.stop() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
            // The UIKit gesture only matters where Core Motion can't see the shaking.
            if !detector.isAccelerometerAvailable { detector.registerShake() }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: detector.currentCount) { _, new in new > 0 }
    }

    private var recorder: some View {
        VStack(spacing: 6) {
            if detector.isShaking {
                Text(detector.currentCount, format: .number)
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(.tint)
                Text("Shaking…").font(.subheadline).foregroundStyle(.secondary)
            } else {
                Image(systemName: "iphone.radiowaves.left.and.right")
                    .font(.system(size: 40))
                    .foregroundStyle(.tint)
                    .symbolEffect(.pulse)
                Text("Shake your phone to start counting")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let burst = detector.lastBurst {
                HStack(spacing: 4) {
                    if isSaving { ProgressView().controlSize(.mini) }
                    Text("Last: \(burst.count) shakes in \(burst.duration.shakeDurationText)")
                }
                .font(.footnote.weight(.medium))
            } else if let totals = myTotals {
                Text("Last: \(totals.lastShakeCount) shakes in \(totals.lastDuration.shakeDurationText)")
                    .font(.footnote.weight(.medium))
            }
            if let totals = myTotals {
                Text("\(totals.totalShakes) shakes total across \(totals.sessionCount) bursts")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 140)
        .animation(.snappy, value: detector.currentCount)
    }

    private func save(_ burst: ShakeDetector.Burst) async {
        guard !isPreview else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await service.record(NewShakeSession(
                shakeCount: burst.count,
                durationMS: Int((burst.duration * 1000).rounded()),
                startedAt: burst.startedAt))
            errorMessage = nil
            await reload()
        } catch {
            errorMessage = "Couldn't save that burst: \(error.localizedDescription)"
        }
    }

    private func reload() async {
        guard !isPreview else { return }
        do {
            async let profiles = ProfilesService(client: auth.client).fetchAll()
            async let totals = service.fetchTotals()
            rankings = ShakeRanking.rank(profiles: try await profiles, totals: try await totals)
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
        hasLoaded = true
    }

    private func watchChanges() async {
        guard !isPreview else { return }
        do {
            try await service.observeChanges { Task { await reload() } }
        } catch is CancellationError {
            return
        } catch {
            errorMessage = "Live updates are off: \(error.localizedDescription)"
        }
    }
}

private struct ShakeRankingRow: View {
    let rank: Int
    let ranking: ShakeRanking
    let isCurrentUser: Bool
    let thumbURL: URL?

    var body: some View {
        HStack(spacing: 12) {
            Text("\(rank)")
                .font(.headline.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(minWidth: 24)
            AsyncImage(url: thumbURL ?? ranking.profile.avatarURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Image(systemName: "person.crop.circle.fill")
                    .resizable()
                    .foregroundStyle(.secondary)
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(ranking.profile.name).font(.headline).lineLimit(1)
                    if isCurrentUser {
                        Text("You")
                            .font(.caption.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.tint.opacity(0.15), in: Capsule())
                    }
                }
                if let totals = ranking.totals {
                    Text("Last: \(totals.lastShakeCount) in \(totals.lastDuration.shakeDurationText) · \(totals.lastShakeAt.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("No shakes yet").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(ranking.totalShakes, format: .number)
                .font(.title3.bold().monospacedDigit())
        }
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ShakesView(currentUserID: Profile.sampleMe.id, sampleRankings: ShakeRanking.samples)
    }
    .environment(AuthModel.preview())
}
#endif
