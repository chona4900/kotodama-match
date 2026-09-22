import AVFoundation
import Capacitor
import Speech
import UIKit

@objc(SpeechRecognition)
public final class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognition"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshAudioSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise)
    ]

    private var speechRecognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var lifecycle = SpeechSessionLifecycle()
    private var inputTapInstalled = false
    private var audioRecovery = SpeechAudioRecovery()
    private var pendingResult = SpeechPendingResult<CAPPluginCall>()
    private var audioObservers: [NSObjectProtocol] = []
    private var engineConfigurationObserver: NSObjectProtocol?
    private var latestSessionId = 0

    override public func load() {
        let center = NotificationCenter.default
        audioObservers.append(center.addObserver(forName: AVAudioSession.interruptionNotification,
                                                  object: nil, queue: nil) { [weak self] notification in
            DispatchQueue.main.async { self?.handleInterruption(notification) }
        })
        audioObservers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                                                  object: nil, queue: nil) { [weak self] _ in
            DispatchQueue.main.async { self?.handleMediaServicesReset() }
        })
        audioObservers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                  object: nil, queue: nil) { [weak self] _ in
            DispatchQueue.main.async { self?.recoverUnfinishedInterruption() }
        })
    }

    deinit {
        audioObservers.forEach { NotificationCenter.default.removeObserver($0) }
        if let engineConfigurationObserver {
            NotificationCenter.default.removeObserver(engineConfigurationObserver)
        }
    }

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer(locale: Locale(identifier: "ja-JP"))?.isAvailable ?? false])
    }

    @objc func start(_ call: CAPPluginCall) {
        // Capacitor invokes plugin methods on its bridge queue; Speech callbacks
        // must use the same queue as start/stop to make generation checks atomic.
        DispatchQueue.main.async {
            self.startRecognition(call)
        }
    }

    private func startRecognition(_ call: CAPPluginCall) {
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("Speech recognition permission is required")
            return
        }
        guard AVAudioSession.sharedInstance().recordPermission == .granted else {
            call.reject("Microphone permission is required")
            return
        }
        guard audioEngine?.isRunning != true else {
            call.reject("Speech recognition is already running")
            return
        }

        // A user retry can recover when iOS never sent interruption-ended.
        // Activation still fails while a higher-priority phone call owns audio.
        if audioRecovery.isInterrupted {
            do {
                try AVAudioSession.sharedInstance().setActive(true)
                _ = audioRecovery.endInterruption(shouldResume: true)
            } catch {
                call.reject("Audio session is interrupted: \(error.localizedDescription)")
                return
            }
        }

        stopRecognition(notify: false)

        let language = call.getString("language") ?? "ja-JP"
        let partialResults = call.getBool("partialResults") ?? false
        let maxResults = max(1, min(call.getInt("maxResults") ?? 5, 5))
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))

        guard let recognizer, recognizer.isAvailable else {
            call.reject("Speech recognition is unavailable")
            return
        }

        speechRecognizer = recognizer
        let sessionId = lifecycle.begin()
        latestSessionId = sessionId
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = partialResults
        request.taskHint = .dictation
        audioEngine = engine
        recognitionRequest = request

        do {
            let session = AVAudioSession.sharedInstance()
            try configureRecordingSession(session)

            let inputNode = engine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                throw NSError(domain: "KotodamaSpeechRecognition", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "Microphone input is unavailable"])
            }
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [request] buffer, _ in
                // Capture this request, never the mutable current-session field.
                request.append(buffer)
            }
            inputTapInstalled = true

            if !partialResults { pendingResult.store(call) }

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                guard let self, self.lifecycle.accepts(sessionId) else { return }

                if let result {
                    let matches = Array(result.transcriptions.prefix(maxResults)).map(\.formattedString)
                    if partialResults {
                        self.notifyListeners("partialResults", data: [
                            "matches": matches,
                            "isFinal": result.isFinal,
                            "sessionId": sessionId
                        ])
                    } else if result.isFinal {
                        self.pendingResult.take()?.resolve(["matches": matches])
                    }
                    if result.isFinal {
                        if !partialResults { self.audioRecovery.cancelListening() }
                        self.stopRecognition(notify: true, reason: "completed")
                        return
                    }
                }

                if let error {
                    let nativeError = error as NSError
                    self.notifyListeners("recognitionError", data: [
                        "platform": "ios", "domain": nativeError.domain,
                        "nativeCode": nativeError.code, "message": error.localizedDescription,
                        "willRetry": partialResults, "sessionId": sessionId
                    ])
                    if !partialResults {
                        self.pendingResult.take()?.reject(error.localizedDescription)
                        self.audioRecovery.cancelListening()
                    }
                    self.stopRecognition(notify: true, reason: "error")
                }
                }
            }

            engine.prepare()
            try engine.start()
            audioRecovery.requestListening()
            observeEngineConfiguration(engine, sessionId: sessionId)
            notifyListeners("listeningState", data: ["status": "started", "sessionId": sessionId])
            if partialResults {
                call.resolve()
            }
        } catch {
            // Preserve the original start error and settle a held call once.
            _ = pendingResult.take()
            stopRecognition(notify: false)
            call.reject(error.localizedDescription)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let wasWaiting = self.audioRecovery.isWaitingToResume
            self.audioRecovery.cancelListening()
            self.stopRecognition(notify: true)
            if wasWaiting {
                self.notifyListeners("listeningState", data: [
                    "status": "stopped", "reason": "stopped", "sessionId": self.latestSessionId
                ])
            }
            call.resolve()
        }
    }

    @objc func refreshAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.refreshAudioSessionOnMain(call)
        }
    }

    private func refreshAudioSessionOnMain(_ call: CAPPluginCall) {
        if audioRecovery.isWaitingToResume {
            call.resolve(["listening": true, "interrupted": true])
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            // With MIC off, a later sound gesture can also release an orphaned
            // interruption once the system allows activation again.
            if audioRecovery.isInterrupted {
                try session.setActive(true)
                _ = audioRecovery.endInterruption(shouldResume: true)
            }
            if lifecycle.isActive && audioEngine?.isRunning != true {
                stopRecognition(notify: true, restorePlayback: false, reason: "engine-stopped")
            }
            if audioRecovery.shouldPreserveRecordingSession(engineIsRunning: audioEngine?.isRunning == true) {
                // A refresh queued before MIC-on can arrive after the recording
                // started. It must not touch that session or its input routing.
                call.resolve(["listening": audioEngine?.isRunning == true])
                return
            }
            // MIC is off: recover playback after mute/route/interruption changes.
            try configurePlaybackSession(session, resetOutput: true)
            call.resolve(["listening": audioEngine?.isRunning == true])
        } catch {
            call.reject("Failed to refresh the audio session: \(error.localizedDescription)")
        }
    }

    @objc func isListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "listening": (self.audioEngine?.isRunning ?? false) || self.audioRecovery.isWaitingToResume,
                "interrupted": self.audioRecovery.isInterrupted
            ])
        }
    }

    @objc func getSupportedLanguages(_ call: CAPPluginCall) {
        call.resolve(["languages": SFSpeechRecognizer.supportedLocales().map(\.identifier).sorted()])
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(permissionPayload())
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { [weak self] _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                DispatchQueue.main.async {
                    self?.checkPermissions(call)
                }
            }
        }
    }

    private func permissionPayload() -> [String: String] {
        [
            "speechRecognition": speechPermissionState(),
            "microphone": microphonePermissionState()
        ]
    }

    private func speechPermissionState() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return "granted"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }

    private func microphonePermissionState() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        case .undetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }

    private func configureRecordingSession(_ session: AVAudioSession) throws {
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .mixWithOthers])
        try session.setActive(true)
    }

    private func configurePlaybackSession(_ session: AVAudioSession, resetOutput: Bool = false) throws {
        try SpeechPlaybackRestoration.restore(
            resetOutput: resetOutput,
            deactivate: { try session.setActive(false, options: [.notifyOthersOnDeactivation]) },
            isAlreadyInactiveError: { error in
                let nativeError = error as NSError
                return nativeError.domain == NSOSStatusErrorDomain
                    && nativeError.code == AVAudioSession.ErrorCode.isBusy.rawValue
            },
            configure: { try session.setCategory(.playback, mode: .default, options: [.mixWithOthers]) },
            activate: { try session.setActive(true) }
        )
    }

    private func observeEngineConfiguration(_ engine: AVAudioEngine, sessionId: Int) {
        engineConfigurationObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
        ) { [weak self, weak engine] _ in
            // Never tear down synchronously on the engine's notification queue:
            // Apple documents that this can deadlock its internal dispatch queue.
            DispatchQueue.main.async {
                guard let self, let engine, self.lifecycle.accepts(sessionId),
                      self.audioEngine === engine, !engine.isRunning else { return }
                self.stopRecognition(notify: !self.audioRecovery.isInterrupted,
                                     reason: "audio-configuration-changed")
            }
        }
    }

    private func handleInterruption(_ notification: Notification) {
        guard let value = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: value) else { return }
        if type == .began {
            audioRecovery.beginInterruption()
            stopRecognition(notify: false)
            if audioRecovery.isWaitingToResume {
                notifyListeners("listeningState", data: [
                    "status": "recovering", "interrupted": true, "sessionId": latestSessionId
                ])
            }
        } else if type == .ended {
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            finishInterruption(shouldResume: AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume))
        }
    }

    private func finishInterruption(shouldResume: Bool) {
        guard audioRecovery.endInterruption(shouldResume: shouldResume) else { return }
        if !shouldResume {
            notifyListeners("recognitionError", data: [
                "platform": "ios", "message": "Audio session was interrupted. Tap MIC to resume.",
                "willRetry": false, "sessionId": latestSessionId
            ])
        }
        notifyListeners("listeningState", data: [
            "status": "stopped", "reason": "interruption-ended", "sessionId": latestSessionId
        ])
    }

    private func recoverUnfinishedInterruption() {
        guard audioRecovery.isInterrupted else { return }
        do {
            // iOS need not send interruption-ended after suspension. Release
            // the pending state only after audio activation actually succeeds.
            try AVAudioSession.sharedInstance().setActive(true)
            finishInterruption(shouldResume: true)
        } catch {
            // A higher-priority session still owns audio; leave MIC intent pending.
        }
    }

    private func handleMediaServicesReset() {
        let hadRequestedListening = audioRecovery.listeningRequested || lifecycle.isActive
        audioRecovery.mediaServicesReset()
        stopRecognition(notify: false, restorePlayback: false)
        // Apple's reset contract requires user action before audio reactivation.
        if hadRequestedListening {
            notifyListeners("recognitionError", data: [
                "platform": "ios", "message": "Audio services restarted. Tap MIC to resume.",
                "willRetry": false, "sessionId": latestSessionId
            ])
            notifyListeners("listeningState", data: [
                "status": "stopped", "reason": "media-services-reset", "sessionId": latestSessionId
            ])
        }
    }

    private func stopRecognition(notify: Bool, restorePlayback: Bool = true, reason: String = "stopped") {
        // cancel()後に届く古いコールバックが、次の認識セッションを止めないよう無効化する。
        let sessionId = latestSessionId
        let hadActiveSession = lifecycle.end()
        if let engineConfigurationObserver {
            NotificationCenter.default.removeObserver(engineConfigurationObserver)
            self.engineConfigurationObserver = nil
        }
        audioEngine?.stop()
        if inputTapInstalled {
            audioEngine?.inputNode.removeTap(onBus: 0)
            inputTapInstalled = false
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioEngine = nil
        speechRecognizer = nil
        pendingResult.take()?.reject("Speech recognition was stopped")

        if restorePlayback && !audioRecovery.isInterrupted {
            do {
                try configurePlaybackSession(AVAudioSession.sharedInstance(), resetOutput: true)
            } catch {
                print("Failed to restore playback audio session: \(error)")
            }
        }

        if hadActiveSession && notify {
            notifyListeners("listeningState", data: [
                "status": "stopped", "reason": reason, "sessionId": sessionId
            ])
        }
    }
}
