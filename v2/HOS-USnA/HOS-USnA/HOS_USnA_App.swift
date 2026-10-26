//
//  US_HeadersApp.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

@main
struct HOS_USnA_App: App {
    /// `nil` until `Supabase.plist` is filled in, which hides the Account feature.
    @State private var auth = AccountSession.makeAuthModel()

    var body: some Scene {
        WindowGroup {
            AppLandingView()
                .accountSession(auth)
        }
    }
}
