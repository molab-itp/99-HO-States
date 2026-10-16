import Combine
import QuartzCore

/// Publishes the seconds since the previous display frame, once per frame while running, so
/// per-frame work such as Auto Scroll keeps in step with the screen's refresh rate. Delivered
/// through a publisher (for `.onReceive`) rather than a stored closure, so the receiving view
/// always sees its current settings.
final class FrameTicker: NSObject {
    let frames = PassthroughSubject<Double, Never>()
    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval?

    func start() {
        guard displayLink == nil else { return }
        lastTimestamp = nil
        // The link retains its target until `stop` invalidates it.
        let link = CADisplayLink(target: self, selector: #selector(step(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func step(_ link: CADisplayLink) {
        defer { lastTimestamp = link.timestamp }
        guard let lastTimestamp else { return }
        // Capped so a stall (e.g. the app in the background) can't turn into one big jump.
        frames.send(min(link.timestamp - lastTimestamp, 0.1))
    }
}
