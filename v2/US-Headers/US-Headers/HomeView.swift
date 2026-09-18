import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var appModel
    private let sourceURL = URL(string: "https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States")!
    private let slideshowIntervalTenths = 50 // 5.0 seconds
    @State private var path = NavigationPath()
    @State private var slideshowTimer: Timer?
    @State private var slideshowRemainingTenths = 0
    private var isSlideshowRunning: Bool { slideshowTimer != nil }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 24) {
                Spacer()

                Image(systemName: "building.columns.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.tint)

                Text("US Presidents")
                    .font(.largeTitle.bold())

                Text("Browse portraits and biographies of every US president.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Spacer()

                VStack(spacing: 16) {
                    NavigationLink(value: HomeDestination.list) {
                        Label("List of Presidents", systemImage: "list.bullet")
                            .frame(maxWidth: .infinity)
                    }
//                    .buttonStyle(.borderedProminent)
                    .buttonStyle(.bordered)

                    Button {
                        goToRandomPresident()
                    } label: {
                        Label("Random President", systemImage: "shuffle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        toggleSlideshow()
                    } label: {
                        Label(
                            isSlideshowRunning ? "Stop Slideshow" : "Start Slideshow",
                            systemImage: isSlideshowRunning ? "stop.circle" : "play.circle"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .controlSize(.large)
                .padding(.horizontal, 32)

                Link(destination: sourceURL) {
                    Label("Source: Wikipedia", systemImage: "link")
                        .font(.footnote)
                }
                .padding(.top, 8)

                Spacer()
            }
            .padding()
            .navigationDestination(for: HomeDestination.self) { destination in
                switch destination {
                case .list:
                    PresidenttListView(presidents: appModel.presidents)
                }
            }
            .navigationDestination(for: President.self) { president in
                PresidentDetailView(
                    presidents: appModel.presidents,
                    selected: president,
                    slideshowCountdownTenths: isSlideshowRunning ? slideshowRemainingTenths : nil,
                    onManualNavigation: stopSlideshow
                )
                // Forces a fresh view (and fresh @State index) each time the slideshow swaps in a
                // different president at the same navigation stack position; otherwise SwiftUI
                // reuses the existing PresidentDetailView instance and its stale `index`.
                .id(president.id)
            }
        }
        .onChange(of: path) { _, newPath in
            if newPath.isEmpty {
                stopSlideshow()
            }
        }
    }

    private func goToRandomPresident() {
        guard let president = appModel.nextRandomPresident() else { return }
        var newPath = NavigationPath()
        newPath.append(president)
        path = newPath
    }

    private func toggleSlideshow() {
        if isSlideshowRunning {
            stopSlideshow()
        } else {
            startSlideshow()
        }
    }

    private func startSlideshow() {
        goToRandomPresident()
        slideshowRemainingTenths = slideshowIntervalTenths
        let timer = Timer(timeInterval: 0.1, repeats: true) { _ in
            Task { @MainActor in
                tickSlideshow()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        slideshowTimer = timer
    }

    private func tickSlideshow() {
        slideshowRemainingTenths -= 1
        if slideshowRemainingTenths <= 0 {
            goToRandomPresident()
            slideshowRemainingTenths = slideshowIntervalTenths
        }
    }

    private func stopSlideshow() {
        slideshowTimer?.invalidate()
        slideshowTimer = nil
        slideshowRemainingTenths = 0
    }
}

private enum HomeDestination: Hashable {
    case list
}

#Preview {
    HomeView()
        .environment(AppModel())
}
