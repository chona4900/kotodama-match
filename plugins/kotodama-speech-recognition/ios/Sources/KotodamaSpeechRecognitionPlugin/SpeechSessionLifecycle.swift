// Access only from the main queue. An OS-stopped audio engine can still own a
// recognition request, so terminal notifications must follow session ownership.
struct SpeechSessionLifecycle {
    private(set) var generation = 0
    private(set) var isActive = false

    mutating func begin() -> Int {
        generation += 1
        isActive = true
        return generation
    }

    func accepts(_ sessionId: Int) -> Bool {
        isActive && generation == sessionId
    }

    @discardableResult
    mutating func end() -> Bool {
        let wasActive = isActive
        generation += 1
        isActive = false
        return wasActive
    }
}

// A task ends after each utterance; the user's MIC-on intent must survive a
// phone-call interruption without spending the web layer's restart budget.
struct SpeechAudioRecovery {
    private(set) var listeningRequested = false
    private(set) var isInterrupted = false

    var isWaitingToResume: Bool { isInterrupted && listeningRequested }

    func shouldPreserveRecordingSession(engineIsRunning: Bool) -> Bool {
        listeningRequested || engineIsRunning
    }

    mutating func requestListening() { listeningRequested = true }
    mutating func cancelListening() { listeningRequested = false }
    mutating func beginInterruption() { isInterrupted = true }

    // Return whether JS needs a terminal event; JS still owns restarting.
    mutating func endInterruption(shouldResume: Bool) -> Bool {
        guard isInterrupted else { return false }
        isInterrupted = false
        let wasRequested = listeningRequested
        if !shouldResume { listeningRequested = false }
        return wasRequested
    }

    mutating func mediaServicesReset() {
        isInterrupted = false
        listeningRequested = false
    }
}

// Non-partial start promises must also settle on cancellation, exactly once.
struct SpeechPendingResult<Value> {
    private var value: Value?

    init() {}

    mutating func store(_ value: Value) { self.value = value }

    mutating func take() -> Value? {
        let result = value
        value = nil
        return result
    }
}

// AVAudioSession can throw isBusy after actually deactivating a session with
// running audio objects. Continue restoration for that one documented outcome;
// all other failures must still reach the caller.
enum SpeechPlaybackRestoration {
    static func restore(resetOutput: Bool,
                        deactivate: () throws -> Void,
                        isAlreadyInactiveError: (Error) -> Bool,
                        configure: () throws -> Void,
                        activate: () throws -> Void) throws {
        if resetOutput {
            do { try deactivate() }
            catch {
                guard isAlreadyInactiveError(error) else { throw error }
            }
        }
        try configure()
        try activate()
    }
}
