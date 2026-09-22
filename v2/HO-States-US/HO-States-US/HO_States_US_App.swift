//
//  US_HeadersApp.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

@main
struct HO_States_US_App: App {
    @State private var appModel = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(appModel)
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
}
