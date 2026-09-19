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

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(appModel)
        }
    }
}
