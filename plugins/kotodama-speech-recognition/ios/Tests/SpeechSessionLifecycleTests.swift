// Run on macOS with:
// swiftc ios/Sources/KotodamaSpeechRecognitionPlugin/SpeechSessionLifecycle.swift \
//   ios/Tests/SpeechSessionLifecycleTests.swift -o /tmp/kotodama-speech-tests
// /tmp/kotodama-speech-tests
@main
enum SpeechSessionLifecycleTests {
    static func main() {
        var lifecycle = SpeechSessionLifecycle()
        precondition(!lifecycle.end(), "Stopping before start must not emit stopped")

        let first = lifecycle.begin()
        precondition(lifecycle.accepts(first), "Active session must accept results")
        // Simulate the OS already stopping the engine: session ownership, not
        // engine.isRunning, must still request one terminal notification.
        precondition(lifecycle.end(), "Interrupted session must emit stopped")
        precondition(!lifecycle.accepts(first), "Canceled callback must be stale")
        precondition(!lifecycle.end(), "Duplicate stop must not emit stopped")

        let second = lifecycle.begin()
        precondition(second != first, "Every recognition needs a fresh ID")
        precondition(!lifecycle.accepts(first), "Old callback cannot stop new session")
        precondition(lifecycle.accepts(second), "New session remains active")
        precondition(lifecycle.end(), "Normal final result must emit stopped")

        for _ in 0..<10 {
            let next = lifecycle.begin()
            precondition(lifecycle.accepts(next))
            precondition(lifecycle.end(), "Every utterance must allow JS restart")
            precondition(!lifecycle.accepts(next))
        }
        print("SpeechSessionLifecycle: all regression checks passed")
    }
}
