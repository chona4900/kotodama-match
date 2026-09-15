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
