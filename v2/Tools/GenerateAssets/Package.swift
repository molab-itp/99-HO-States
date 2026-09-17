// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "GenerateAssets",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "GenerateAssets",
            path: "Sources/GenerateAssets"
        )
    ]
)
