import SwiftUI

/// Fixed-width (leading-zero, fully monospaced) principal toolbar title, so the number/countdown
/// don't jiggle side-to-side as their digits change every tenth of a second.
///
/// `navigationTitle(_:)` only accepts unstyled `Text`, so this styled title is rendered via a
/// principal toolbar item instead (see `PresidentDetailView`'s `.toolbar`).
struct PresidentDetailTitleView: View {
    let order: Int
    let buildInfo: String
    /// `nil` when no slideshow is running; otherwise the countdown, in tenths of a second, until
    /// the next auto-advance.
    let slideshowRemainingTenths: Int?

    var body: some View {
        let orderText = String(format: "%02d", order)
        HStack {
            if let tenths = slideshowRemainingTenths {
                let secondsText = String(format: "%04.1f", Double(tenths) / 10)
                Text("#\(orderText) · \(secondsText)s \(buildInfo)").font(.system(.body, design: .monospaced))
            } else {
                Text("#\(orderText) \(buildInfo)").font(.system(.body, design: .monospaced))
            }
        }
        .frame(maxWidth: .infinity)
    }
}
