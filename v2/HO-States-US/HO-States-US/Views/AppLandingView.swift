import SwiftUI

/// The app's root view: owns `AppModel` and the navigation stack that `LandingView` sits at the
/// bottom of. Everything `HO_States_US_App` needs lives here rather than in the `App` itself so
/// the whole navigation flow can be run in a preview.
struct AppLandingView: View {
    @State private var appModel: AppModel
    /// The screens pushed on top of `LandingView`. Mirrored into `appModel.screen` so the last
    /// screen shown is restored on the next launch.
    @State private var path: [AppScreen]
    /// Whether the next `HOSDetailView` pushed should open with its slideshow playing (Landing's
    /// Start Slideshow) rather than paused.
    @State private var startsSlideshowOnOpen = false
    @Environment(\.scenePhase) private var scenePhase

    init(appModel: AppModel = AppModel()) {
        _appModel = State(initialValue: appModel)
        _path = State(initialValue: appModel.screen == .landing ? [] : [appModel.screen])
    }

    var body: some View {
        NavigationStack(path: $path) {
            LandingView(
                onShowList: { path = [.hosList] },
                onShowDetail: showDetail,
                onShowNews: { path = [.news] },
                onShowCredits: { path = [.credits] },
                onShowSpeechSetup: { path = [.speechSetup] }
            )
                .navigationDestination(for: AppScreen.self) { screen in
                    switch screen {
                    case .landing:
                        EmptyView()
                    case .hosList:
                        HOSListView(hosList: appModel.hosList) { hos in
                            appModel.select(hos)
                            showDetail(startSlideshow: false)
                        }
                    case .hosDetail:
                        HOSDetailView(
                            hosList: appModel.hosList,
                            selected: appModel.hosList.indices.contains(appModel.slideIndex)
                                ? appModel.hosList[appModel.slideIndex]
                                : appModel.hosList[0],
                            startsPlaying: startsSlideshowOnOpen
                        )
                    case .news:
                        NewsView()
                    case .credits:
                        CreditsView()
                    case .speechSetup:
                        SpeechSetupView()
                    }
                }
        }
        .environment(appModel)
        .onChange(of: path) { _, newPath in
            appModel.screen = newPath.last ?? .landing
        }
        // The one place `AppModel.persistState()` is called — writing on every mutation (a
        // slideshow tick, a reaction pick) would mean far more disk I/O than the data warrants,
        // so it's deferred until the app is actually about to leave the foreground.
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background {
                appModel.persistState()
            }
        }
    }

    /// Shows `HOSDetailView` at `appModel.slideIndex`, replacing anything pushed (e.g. the list)
    /// so Back returns to `LandingView`.
    private func showDetail(startSlideshow: Bool) {
        startsSlideshowOnOpen = startSlideshow
        path = [.hosDetail]
    }
}

#Preview {
    AppLandingView()
}
