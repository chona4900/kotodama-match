// Run on macOS with:
// swiftc ios/Sources/KotodamaSpeechRecognitionPlugin/SpeechSessionLifecycle.swift \
//   ios/Tests/SpeechSessionLifecycleTests.swift -o /tmp/kotodama-speech-tests
// /tmp/kotodama-speech-tests
@main
enum SpeechSessionLifecycleTests {
    enum AudioFailure: Error { case busy, other }

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
        // A hardware format change can stop AVAudioEngine without ending the
        // Speech task. Its queued configuration callback is still session-scoped.
        let routeSession = lifecycle.begin()
        precondition(lifecycle.end(), "OS-stopped engine must still end its owned task")
        let replacementSession = lifecycle.begin()
        precondition(!lifecycle.accepts(routeSession), "Late route callback cannot stop replacement engine")
        precondition(lifecycle.accepts(replacementSession))
        lifecycle.end()

        var recovery = SpeechAudioRecovery()
        precondition(!recovery.isWaitingToResume)
        precondition(!recovery.shouldPreserveRecordingSession(engineIsRunning: false))
        precondition(recovery.shouldPreserveRecordingSession(engineIsRunning: true), "A running engine must survive a queued playback refresh")
        recovery.requestListening()
        precondition(recovery.shouldPreserveRecordingSession(engineIsRunning: false), "MIC intent protects the gap before engine start/retry")
        let interruptedSession = lifecycle.begin()
        recovery.beginInterruption()
        precondition(lifecycle.end())
        precondition(!lifecycle.accepts(interruptedSession), "Interrupted recognition callbacks are stale")
        precondition(recovery.isWaitingToResume, "OS-stop must retain MIC-on intent during a long call")
        precondition(recovery.endInterruption(shouldResume: true), "Ended interruption must unlock a JS restart")
        precondition(!recovery.isInterrupted)
        precondition(recovery.listeningRequested)
        precondition(!recovery.endInterruption(shouldResume: true), "Duplicate end cannot restart twice")

        recovery.beginInterruption()
        recovery.cancelListening()
        precondition(!recovery.shouldPreserveRecordingSession(engineIsRunning: false), "Explicit MIC off allows playback recovery")
        precondition(recovery.isInterrupted, "MIC off cannot pretend a system call ended")
        precondition(!recovery.isWaitingToResume)
        precondition(!recovery.endInterruption(shouldResume: true), "MIC off during a call must prevent later restart")

        recovery.requestListening()
        recovery.beginInterruption()
        precondition(recovery.endInterruption(shouldResume: false), "Denied resumption still needs a terminal event")
        precondition(!recovery.listeningRequested, "No-resume hint must require another user MIC action")
        precondition(!recovery.isInterrupted)

        // Preserve intent even if the interrupt arrives in the gap between two
        // utterances, after lifecycle.end() but before the JS restart timer.
        recovery.requestListening()
        let finishedUtterance = lifecycle.begin()
        lifecycle.end()
        precondition(!lifecycle.accepts(finishedUtterance))
        recovery.beginInterruption()
        precondition(recovery.isWaitingToResume)
        precondition(recovery.endInterruption(shouldResume: true))

        recovery.beginInterruption()
        recovery.mediaServicesReset()
        precondition(!recovery.isInterrupted, "Media reset must clear orphaned interruption state")
        precondition(!recovery.listeningRequested, "Media reset must not auto-record without user action")
        precondition(!recovery.endInterruption(shouldResume: true), "Old interruption end cannot revive a reset session")
        recovery.requestListening()
        precondition(recovery.listeningRequested, "Explicit user retry after reset must be allowed")

        var pending = SpeechPendingResult<String>()
        precondition(pending.take() == nil)
        pending.store("non-partial-start")
        precondition(pending.take() == "non-partial-start", "Stop/error must settle the held start promise")
        precondition(pending.take() == nil, "Late final cannot settle a canceled promise twice")
        pending.store("replacement-start")
        precondition(pending.take() == "replacement-start", "Old call must not leak into the next session")
        precondition(pending.take() == nil)

        var restorationEvents: [String] = []
        do {
            try SpeechPlaybackRestoration.restore(
                resetOutput: true,
                deactivate: { restorationEvents.append("deactivate"); throw AudioFailure.busy },
                isAlreadyInactiveError: { if case AudioFailure.busy = $0 { return true }; return false },
                configure: { restorationEvents.append("configure") },
                activate: { restorationEvents.append("activate") }
            )
        } catch { preconditionFailure("Already-inactive busy outcome must finish playback restoration") }
        precondition(restorationEvents == ["deactivate", "configure", "activate"], "Busy deactivation must not strand output inactive")

        restorationEvents = []
        do {
            try SpeechPlaybackRestoration.restore(
                resetOutput: true,
                deactivate: { restorationEvents.append("deactivate"); throw AudioFailure.other },
                isAlreadyInactiveError: { if case AudioFailure.busy = $0 { return true }; return false },
                configure: { restorationEvents.append("configure") },
                activate: { restorationEvents.append("activate") }
            )
            preconditionFailure("Unrelated deactivation errors must propagate")
        } catch AudioFailure.other { }
        catch { preconditionFailure("Original deactivation error must be preserved") }
        precondition(restorationEvents == ["deactivate"])

        restorationEvents = []
        do {
            try SpeechPlaybackRestoration.restore(
                resetOutput: false,
                deactivate: { restorationEvents.append("deactivate") },
                isAlreadyInactiveError: { _ in false },
                configure: { restorationEvents.append("configure") },
                activate: { restorationEvents.append("activate"); throw AudioFailure.other }
            )
            preconditionFailure("Activation failure must propagate, never report restored output")
        } catch AudioFailure.other { }
        catch { preconditionFailure("Original activation error must be preserved") }
        precondition(restorationEvents == ["configure", "activate"], "No-reset recovery must skip deactivation")

        print("Speech lifecycle, audio recovery/restoration and pending result: all regression checks passed")
    }
}
