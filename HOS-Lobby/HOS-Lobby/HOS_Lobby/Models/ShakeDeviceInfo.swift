import CoreLocation
import Foundation
import UIKit

/// What's saved with each burst in `shake_sessions.device` (a `jsonb` object). Every field is
/// optional, so adding one here needs no migration, and rows saved before it existed still decode.
/// Keys are snake_case in the database.
struct ShakeDeviceInfo: Codable, Hashable, Sendable {
    // Location (absent if the user declined location access or no fix arrived yet).
    var latitude: Double?
    var longitude: Double?
    /// Meters, radius of uncertainty.
    var horizontalAccuracy: Double?
    /// Meters above sea level.
    var altitude: Double?
    /// Meters above the WGS 84 ellipsoid.
    var ellipsoidalAltitude: Double?
    var verticalAccuracy: Double?
    /// Building floor, where Apple knows it.
    var floor: Int?
    /// Meters per second, while moving.
    var speed: Double?
    /// Degrees from true north, while moving.
    var course: Double?
    var locationTimestamp: Date?

    // The burst itself.
    /// Strongest jolt in the burst, in g.
    var peakAcceleration: Double?

    // The device.
    /// Hardware identifier, e.g. "iPhone17,1".
    var model: String?
    /// "iPhone" or "iPad".
    var deviceKind: String?
    var systemName: String?
    var systemVersion: String?
    var appVersion: String?
    var appBuild: String?
    /// 0–1, or nil where iOS doesn't report it (the Simulator).
    var batteryLevel: Double?
    /// "charging", "full", "unplugged" or "unknown".
    var batteryState: String?
    var lowPowerMode: Bool?
    var locale: String?
    var timeZone: String?

    enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case horizontalAccuracy = "horizontal_accuracy"
        case altitude
        case ellipsoidalAltitude = "ellipsoidal_altitude"
        case verticalAccuracy = "vertical_accuracy"
        case floor, speed, course
        case locationTimestamp = "location_timestamp"
        case peakAcceleration = "peak_acceleration"
        case model
        case deviceKind = "device_kind"
        case systemName = "system_name"
        case systemVersion = "system_version"
        case appVersion = "app_version"
        case appBuild = "app_build"
        case batteryLevel = "battery_level"
        case batteryState = "battery_state"
        case lowPowerMode = "low_power_mode"
        case locale
        case timeZone = "time_zone"
    }

    var hasLocation: Bool { latitude != nil && longitude != nil }
}

extension ShakeDeviceInfo {
    /// A snapshot of this device now, plus `location` if there is one.
    @MainActor
    static func current(location: CLLocation?, peakAcceleration: Double?) -> ShakeDeviceInfo {
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true
        let info = Bundle.main.infoDictionary
        var result = ShakeDeviceInfo(
            peakAcceleration: peakAcceleration.map { ($0 * 100).rounded() / 100 },
            model: hardwareIdentifier,
            deviceKind: device.model,
            systemName: device.systemName,
            systemVersion: device.systemVersion,
            appVersion: info?["CFBundleShortVersionString"] as? String,
            appBuild: info?["CFBundleVersion"] as? String,
            batteryLevel: device.batteryLevel >= 0 ? Double(device.batteryLevel) : nil,
            batteryState: device.batteryState.name,
            lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled,
            locale: Locale.current.identifier,
            timeZone: TimeZone.current.identifier)
        if let location, location.horizontalAccuracy >= 0 {
            result.latitude = location.coordinate.latitude
            result.longitude = location.coordinate.longitude
            result.horizontalAccuracy = location.horizontalAccuracy
            result.locationTimestamp = location.timestamp
            if location.verticalAccuracy >= 0 {
                result.altitude = location.altitude
                result.ellipsoidalAltitude = location.ellipsoidalAltitude
                result.verticalAccuracy = location.verticalAccuracy
            }
            result.floor = location.floor?.level
            if location.speed >= 0 { result.speed = location.speed }
            if location.course >= 0 { result.course = location.course }
        }
        return result
    }

    /// "iPhone17,1"; in the Simulator, the simulated model's identifier.
    private static let hardwareIdentifier: String = {
        if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
            return simulated
        }
        var system = utsname()
        uname(&system)
        return withUnsafeBytes(of: &system.machine) { buffer in
            String(decoding: buffer.prefix { $0 != 0 }, as: UTF8.self)
        }
    }()
}

private extension UIDevice.BatteryState {
    var name: String {
        switch self {
        case .charging: "charging"
        case .full: "full"
        case .unplugged: "unplugged"
        default: "unknown"
        }
    }
}
