import SwiftUI

/// Shown when `Supabase.plist` hasn't been filled in yet (see v06/README.md).
struct SetupRequiredView: View {
    let message: String

    var body: some View {
        ContentUnavailableView {
            Label("Supabase not configured", systemImage: "gearshape.2")
        } description: {
            Text(message)
        }
    }
}
