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
    @State private var location = LocationTracker()
    /// Bumped whenever the leader's total goes up, which jiggles the leader card.
    @State private var leaderJiggle = 0
    @State private var listHeight: CGFloat = 0

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
    /// The top-ranked user, once anyone has shaken.
    private var leader: ShakeRanking? { rankings.first.flatMap { $0.totalShakes > 0 ? $0 : nil } }
    /// Everyone below the leader card.
    private var others: ArraySlice<ShakeRanking> { leader == nil ? rankings[...] : rankings.dropFirst() }

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
                if let leader {
                    NavigationLink(value: leader) {
                        LeaderCard(ranking: leader, isCurrentUser: leader.id == currentUserID,
                                   thumbURL: photos.publicURL(for: leader.profile.photoPath ?? leader.profile.photoThumbPath),
                                   jiggle: leaderJiggle)
                            // About a quarter of the screen.
                            .frame(height: max(listHeight * 0.25, 180))
                    }
                }
                ForEach(Array(others.enumerated()), id: \.element.id) { index, ranking in
                    NavigationLink(value: ranking) {
                        ShakeRankingRow(rank: index + (leader == nil ? 1 : 2), ranking: ranking,
                                        isCurrentUser: ranking.id == currentUserID,
                                        thumbURL: photos.publicURL(for: ranking.profile.photoThumbPath))
                    }
                }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { listHeight = $0 }
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
            if !isPreview { location.start() }
        }
        .onDisappear {
            detector.stop()
            location.stop()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                detector.start()
                if !isPreview { location.start() }
            } else {
                detector.stop()
                location.stop()
            }
        }
        .onChange(of: detector.currentCount) { old, new in
            // Live shakes by the leader count as their total going up.
            if new > old, leader?.id == currentUserID { leaderJiggle += 1 }
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
                startedAt: burst.startedAt,
                device: .current(location: location.latest, peakAcceleration: burst.peakAcceleration)))
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
            let previousLeader = leader
            rankings = ShakeRanking.rank(profiles: try await profiles, totals: try await totals)
            // Jiggle when the top total goes up, whether the same leader shook more or someone
            // overtook them. Not on the first load.
            if hasLoaded, let leader, leader.totalShakes > (previousLeader?.totalShakes ?? 0) {
                leaderJiggle += 1
            }
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

/// The top-ranked user, shown large at the head of the leaderboard. Jiggles each time `jiggle`
/// changes.
private struct LeaderCard: View {
    let ranking: ShakeRanking
    let isCurrentUser: Bool
    let thumbURL: URL?
    let jiggle: Int

    var body: some View {
        GeometryReader { proxy in
            let photoSize = min(proxy.size.height * 0.8, proxy.size.width * 0.4)
            HStack(spacing: 16) {
                ZStack(alignment: .topLeading) {
                    AsyncImage(url: thumbURL ?? ranking.profile.avatarURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "person.crop.circle.fill")
                            .resizable()
                            .foregroundStyle(.secondary)
                    }
                    .frame(width: photoSize, height: photoSize)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(.yellow, lineWidth: 4))
                    Image(systemName: "crown.fill")
                        .font(.system(size: photoSize * 0.28))
                        .foregroundStyle(.yellow)
                        .shadow(radius: 2)
                        .rotationEffect(.degrees(-25))
                        .offset(x: -photoSize * 0.06, y: -photoSize * 0.12)
                        .symbolEffect(.bounce, value: jiggle)
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("#1").font(.headline).foregroundStyle(.secondary)
                        if isCurrentUser {
                            Text("You")
                                .font(.caption.bold())
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.tint.opacity(0.15), in: Capsule())
                        }
                    }
                    Text(ranking.profile.name)
                        .font(.title2.bold())
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(ranking.totalShakes, format: .number)
                        .font(.system(size: min(proxy.size.height * 0.3, 56), weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(ranking.totalShakes)))
                        .foregroundStyle(.tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    if let totals = ranking.totals {
                        Text("shakes · last \(totals.lastShakeAt.formatted(.relative(presentation: .named)))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxHeight: .infinity)
            .keyframeAnimator(initialValue: Jiggle(), trigger: jiggle) { content, value in
                content
                    .rotationEffect(.degrees(value.angle))
                    .scaleEffect(value.scale)
            } keyframes: { _ in
                KeyframeTrack(\.angle) {
                    CubicKeyframe(-6, duration: 0.07)
                    CubicKeyframe(6, duration: 0.1)
                    CubicKeyframe(-4, duration: 0.1)
                    CubicKeyframe(3, duration: 0.1)
                    CubicKeyframe(0, duration: 0.12)
                }
                KeyframeTrack(\.scale) {
                    SpringKeyframe(1.08, duration: 0.15)
                    SpringKeyframe(1, duration: 0.35)
                }
            }
        }
        .animation(.snappy, value: ranking.totalShakes)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Leader: \(ranking.profile.name), \(ranking.totalShakes) shakes")
    }

    private struct Jiggle {
        var angle = 0.0
        var scale = 1.0
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
