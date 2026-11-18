import UIKit

extension Notification.Name {
    /// Posted on the UIKit shake gesture (a real shake, or Device ▸ Shake in the Simulator).
    static let deviceDidShake = Notification.Name("deviceDidShake")
}

extension UIWindow {
    /// SwiftUI has no shake modifier; the window sees the gesture when nothing else handles it.
    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: .deviceDidShake, object: nil)
        }
        super.motionEnded(motion, with: event)
    }
}
