import SwiftUI

/// Everything saved with one burst: its intensity, direction, each shake, where it happened and on
/// what device. Bursts saved before a field existed just leave that part out.
struct ShakeSessionDetailView: View {
    let session: ShakeSession

    private var device: ShakeDeviceInfo? { session.device }
    private var shakes: [ShakeJolt] { device?.shakes ?? [] }

    var body: some View {
        List {
            Section("Burst") {
                LabeledContent("Started", value: session.startedAt.formatted(date: .abbreviated, time: .standard))
                LabeledContent("Shakes", value: "\(session.shakeCount)")
                LabeledContent("Duration", value: session.duration.shakeDurationText)
                if session.duration > 0 {
                    LabeledContent("Pace",
                                   value: "\((Double(session.shakeCount - 1) / session.duration).formatted(.number.precision(.fractionLength(1)))) shakes/s")
                }
            }
            .monospacedDigit()

            if let device, device.peakAcceleration != nil || device.averageAcceleration != nil {
                Section {
                    if let average = device.averageAcceleration ?? device.peakAcceleration {
                        LabeledContent("Intensity", value: ShakeIntensity.label(for: average))
                    }
                    if let peak = device.peakAcceleration { LabeledContent("Strongest jolt", value: peak.gText) }
                    if let average = device.averageAcceleration { LabeledContent("Average shake", value: average.gText) }
                    if let rms = device.rmsAcceleration { LabeledContent("Sustained (RMS)", value: rms.gText) }
                } header: {
                    Text("Intensity")
                } footer: {
                    Text("In g, with gravity removed. A shake counts from 1.6 g.")
                }
                .monospacedDigit()
            }

            if let pattern = device?.shakePattern {
                Section {
                    Label(pattern.label, systemImage: pattern.systemImage)
                        .font(.headline)
                    if let share = device?.axisShare {
                        ForEach(ShakeAxis.allCases, id: \.self) { axis in
                            ShareBar(title: axis.label, value: share[axis])
                        }
                    }
                    if let circularity = device?.circularity {
                        ShareBar(title: "Turning", value: circularity)
                    }
                } header: {
                    Text("Direction")
                } footer: {
                    Text("Up/down is along gravity; left/right is across the phone's screen; forward/back is toward or away from you. Turning is how steadily the motion went around one way.")
                }
            }

            Section {
                if shakes.isEmpty {
                    Text("Per-shake detail wasn't recorded for this burst.")
                        .foregroundStyle(.secondary)
                } else {
                    let strongest = shakes.compactMap(\.peak).max() ?? 0
                    ForEach(Array(shakes.enumerated()), id: \.offset) { index, shake in
                        ShakeRow(number: index + 1, shake: shake,
                                 gap: index > 0 ? shake.offset - shakes[index - 1].offset : nil,
                                 strongest: strongest)
                    }
                }
            } header: {
                Text(shakes.count < session.shakeCount && !shakes.isEmpty
                     ? "Each shake (first \(shakes.count))" : "Each shake")
            }

            if let device, device.hasLocation {
                Section("Location") {
                    if let lat = device.latitude, let lon = device.longitude {
                        LabeledContent("Coordinates",
                                       value: "\(lat.formatted(.number.precision(.fractionLength(5)))), \(lon.formatted(.number.precision(.fractionLength(5))))")
                    }
                    if let accuracy = device.horizontalAccuracy { LabeledContent("Accuracy", value: meters(accuracy)) }
                    if let altitude = device.altitude { LabeledContent("Altitude", value: meters(altitude)) }
                    if let floor = device.floor { LabeledContent("Floor", value: "\(floor)") }
                    if let speed = device.speed { LabeledContent("Speed", value: "\(speed.formatted(.number.precision(.fractionLength(1)))) m/s") }
                }
                .monospacedDigit()
            }

            if let device, device.model != nil {
                Section("Device") {
                    if let model = device.model { LabeledContent("Model", value: model) }
                    if let name = device.systemName, let version = device.systemVersion {
                        LabeledContent("System", value: "\(name) \(version)")
                    }
                    if let version = device.appVersion {
                        LabeledContent("App", value: device.appBuild.map { "\(version) (\($0))" } ?? version)
                    }
                    if let level = device.batteryLevel {
                        LabeledContent("Battery", value: "\(level.formatted(.percent.precision(.fractionLength(0))))\(device.batteryState.map { ", \($0)" } ?? "")")
                    }
                    if device.lowPowerMode == true { LabeledContent("Low Power Mode", value: "On") }
                    if let timeZone = device.timeZone { LabeledContent("Time zone", value: timeZone) }
                }
            }
        }
        .navigationTitle("\(session.shakeCount) Shakes")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func meters(_ value: Double) -> String {
        "\(value.formatted(.number.precision(.fractionLength(0...1)))) m"
    }
}

/// A labeled 0–1 value as a percentage and a bar.
private struct ShareBar: View {
    let title: String
    let value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            LabeledContent(title, value: value.formatted(.percent.precision(.fractionLength(0))))
                .monospacedDigit()
            ProgressView(value: min(max(value, 0), 1))
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ShakeRow: View {
    let number: Int
    let shake: ShakeJolt
    /// Seconds since the previous shake.
    let gap: Double?
    let strongest: Double

    var body: some View {
        HStack(spacing: 12) {
            Text("\(number)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(minWidth: 24, alignment: .trailing)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("+\(shake.offset.formatted(.number.precision(.fractionLength(2)))) s")
                    if let gap {
                        Text("(\(gap.formatted(.number.precision(.fractionLength(2)))) s after)")
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.subheadline.monospacedDigit())
                if let peak = shake.peak, strongest > 0 {
                    ProgressView(value: peak / strongest)
                        .tint(peak == strongest ? .orange : .accentColor)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let peak = shake.peak {
                    Text(peak.gText).font(.subheadline.monospacedDigit().weight(.semibold))
                }
                if let axis = shake.shakeAxis {
                    Label(axis.label, systemImage: axis.pattern.systemImage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

extension Double {
    /// "2.45 g"
    var gText: String { "\(formatted(.number.precision(.fractionLength(2)))) g" }
}

#if DEBUG
#Preview {
    NavigationStack {
        ShakeSessionDetailView(session: ShakeSession.samples(for: Profile.sampleMe.id)[0])
    }
}
#endif
