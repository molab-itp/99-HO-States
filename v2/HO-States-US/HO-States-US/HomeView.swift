import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var appModel
    private let sourceURL = URL(string: "https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States")!
    @State private var path = NavigationPath()
    @State private var isRandomMode = false
    // Set right before pushing a president to kick off a slideshow (carrying whether it should
    // run in random mode), and cleared whenever navigation returns to Home, so that an ordinary
    // list tap or the "Random Head" button never accidentally lands in slideshow mode.
    @State private var pendingSlideshow: Bool?
    private var remainingCount: Int {
        appModel.presidents.count - appModel.viewedPresidentIDs.count
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 24) {
                Spacer()

                Image(systemName: "building.columns.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.tint)

                Text("USNA Heads")
                    .font(.largeTitle.bold())

                Text("Browse portraits and biographies of every United States of North America Head of State.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Spacer()

                VStack(spacing: 16) {
                    NavigationLink(value: HomeDestination.list) {
                        Label("List of Heads", systemImage: "list.bullet")
                            .frame(maxWidth: .infinity)
                    }
//                    .buttonStyle(.borderedProminent)
                    .buttonStyle(.bordered)

                    Button {
                        goToRandomPresident()
                    } label: {
                        Label("Random Head", systemImage: "shuffle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Toggle(isOn: $isRandomMode) {
                        Label("Random Mode", systemImage: "shuffle")
                    }

                    Button {
                        startSlideshow()
                    } label: {
                        Label("Start Slideshow", systemImage: "play.circle")
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
              VStack(spacing: 4) {
                Text("\(remainingCount) left to see")
                  .font(.callout.weight(.medium))
                Button("Reset Visit Count", role: .destructive) {
                  appModel.resetViewed()
                }
                .font(.footnote)
              }


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
                    isRandomMode: pendingSlideshow ?? false,
                    startSlideshow: pendingSlideshow != nil
                )
                // Forces a fresh view (and fresh @State index) each time a new president is
                // pushed at the same navigation stack position.
                .id(president.id)
            }
        }
        .onChange(of: path) { _, newPath in
            if newPath.isEmpty {
                pendingSlideshow = nil
            }
        }
    }

    private func goToRandomPresident() {
        pendingSlideshow = nil
        guard let president = appModel.nextRandomPresident() else { return }
        var newPath = NavigationPath()
        newPath.append(president)
        path = newPath
    }

    private func startSlideshow() {
        pendingSlideshow = isRandomMode
        let president = isRandomMode ? appModel.nextRandomPresident() : appModel.presidents.first
        guard let president else { return }
        var newPath = NavigationPath()
        newPath.append(president)
        path = newPath
    }
}

private enum HomeDestination: Hashable {
    case list
}

#Preview {
    HomeView()
        .environment(AppModel())
}
