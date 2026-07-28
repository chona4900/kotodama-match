// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KotodamaSpeechRecognition",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "KotodamaSpeechRecognition",
            targets: ["KotodamaSpeechRecognitionPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "KotodamaSpeechRecognitionPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/KotodamaSpeechRecognitionPlugin")
    ]
)
