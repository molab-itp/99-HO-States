//
//  US_HeadersApp.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

@main
struct US_HeadersApp: App {
    @State private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(appModel)
        }
    }
}
