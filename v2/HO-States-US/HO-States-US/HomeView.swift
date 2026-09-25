import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var appModel
    
    private let sourceDataURL = URL(string: "https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States")!
    private let sourceCodeURL = URL(string: "https://github.com/molab-itp/99-HO-States")!

    @State private var path = NavigationPath()
    @State private var isRandomMode = false
    // Set right before pushing a president to kick off a slideshow (carrying whether it should
    // run in random mode), and cleared whenever navigation returns to Home, so that an ordinary
    // list tap or the "Random Head" button never accidentally lands in slideshow mode.
    @State private var pendingSlideshow: Bool?
    @AppStorage(SlideshowSettings.intervalSecsKey)
    private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
    @AppStorage(SlideshowSettings.delayFractionKey)
    private var delayFraction = SlideshowSettings.defaultDelayFraction
    @AppStorage(SlideshowSettings.fadePeriodKey)
    private var fadePeriod = SlideshowSettings.defaultFadePeriod
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
                
                Text("USnA Heads")
                    .font(.largeTitle.bold())
                
                Text("Browse portraits and biographies of every United States of North America \nHead of State.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
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

                    LabeledContent("Slide Interval") {
                        Picker("Slide Interval", selection: $slideshowIntervalSecs) {
                            ForEach(SlideshowSettings.intervalSecsOptions, id: \.self) { secs in
                                Text("\(Int(secs))s").tag(secs)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    LabeledContent("Fadein Delay") {
                        Picker("Fadein Delay", selection: $delayFraction) {
                            ForEach(SlideshowSettings.delayFractionOptions, id: \.self) { fraction in
                                Text(String(format: "%.1fs", slideshowIntervalSecs * fraction)).tag(fraction)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    LabeledContent("Fade Period") {
                        Picker("Fade Period", selection: $fadePeriod) {
                            ForEach(SlideshowSettings.fadePeriodOptions, id: \.self) { secs in
                                Text("\(secs.formatted())s").tag(secs)
                            }
                        }
                        .pickerStyle(.segmented)
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
                
                VStack(spacing: 4) {
                    Text("\(remainingCount) left to see")
                        .font(.callout.weight(.medium))
                    Button("Reset Visit Count", role: .destructive) {
                        appModel.resetViewed()
                    }
                    .font(.footnote)
                }
                VStack(spacing: 4) {
                    Link(destination: sourceDataURL) {
                        Label("Data Source: Wikipedia", systemImage: "link")
                            .font(.footnote)
                    }
                    //                .padding(.top, 8)
                    Link(destination: sourceCodeURL) {
                        Label("Source Code", systemImage: "link")
                            .font(.footnote)
                    }
                }
                
                Text(appModel.buildInfo)
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
                
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
                // NB: this closure is *not* a run-once initializer — NavigationStack re-invokes
                // it whenever HomeView's body recomputes (e.g. every `markViewed` call changes
                // `remainingCount`, which HomeView's body reads), even while `president` itself
                // hasn't changed. A side effect here previously reset `appModel.slideIndex` back
                // to this same starting value on every such re-invocation, silently undoing every
                // slideshow advance. `PresidentDetailView` now owns seeding/advancing
                // `appModel.slideIndex` itself instead (in `onAppear` and its own navigation
                // methods), which only run once per view *identity*, not once per re-invocation.
                PresidentDetailView(
                    presidents: appModel.presidents,
                    selected: president,
                    isRandomMode: pendingSlideshow ?? false,
                    startSlideshow: pendingSlideshow != nil
                )
                // Forces a fresh view each time a new president is pushed at the same
                // navigation stack position.
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
        // Random mode draws the next card from the shared shuffle (resuming at
        // `nextShuffleIndex`); sequential mode resumes from wherever `slideIndex` was last left,
        // falling back to the first president only if that index is somehow out of bounds.
        let president: President?
        if isRandomMode {
            president = appModel.nextRandomPresident()
        } else if appModel.presidents.indices.contains(appModel.slideIndex) {
            president = appModel.presidents[appModel.slideIndex]
        } else {
            president = appModel.presidents.first
        }
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
