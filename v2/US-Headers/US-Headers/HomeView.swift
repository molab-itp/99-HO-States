import SwiftUI

struct HomeView: View {
    private let presidents = PresidentsRepository.loadAll()
    private let sourceURL = URL(string: "https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States")!
    @State private var path = NavigationPath()

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
                    .buttonStyle(.borderedProminent)

                    Button {
                        goToRandomPresident()
                    } label: {
                        Label("Random President", systemImage: "shuffle")
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
                    ContentView(presidents: presidents)
                }
            }
            .navigationDestination(for: President.self) { president in
                PresidentDetailView(presidents: presidents, selected: president)
            }
        }
    }

    private func goToRandomPresident() {
        guard let president = presidents.randomElement() else { return }
        path.append(president)
    }
}

private enum HomeDestination: Hashable {
    case list
}

#Preview {
    HomeView()
}
