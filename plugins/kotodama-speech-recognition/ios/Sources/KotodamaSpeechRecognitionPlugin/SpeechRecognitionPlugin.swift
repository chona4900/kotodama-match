import AVFoundation
import Capacitor
import Speech

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
                        call.resolve(["matches": matches])
                    }
                    if result.isFinal {
                        self.stopRecognition(notify: true)
                        return
                    }
                }

                if let error {
                    self.stopRecognition(notify: true)
                    if !partialResults {
                        call.reject(error.localizedDescription)
                    }
                }
                }
            }

            engine.prepare()
            try engine.start()
            notifyListeners("listeningState", data: ["status": "started"])
            if partialResults {
                call.resolve()
            }
        } catch {
            stopRecognition(notify: false)
            call.reject(error.localizedDescription)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopRecognition(notify: true)
            call.resolve()
        }
    }

    @objc func refreshAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.refreshAudioSessionOnMain(call)
        }
    }

    private func refreshAudioSessionOnMain(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            if audioEngine?.isRunning == true {
                try configureRecordingSession(session)
            } else {
                // 消音スイッチの解除後など、Web Audioが動作中でも出力先だけが
                // 古い状態になることがある。いったん非アクティブにしてから
                // playback セッションを作り直すと、アプリ再起動なしで復帰できる。
                try configurePlaybackSession(session, resetOutput: true)
            }
            call.resolve(["listening": audioEngine?.isRunning == true])
        } catch {
            call.reject("Failed to refresh the audio session: \(error.localizedDescription)")
        }
    }

    @objc func isListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["listening": self.audioEngine?.isRunning ?? false])
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
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }

    private func configurePlaybackSession(_ session: AVAudioSession, resetOutput: Bool = false) throws {
        if resetOutput {
            try session.setActive(false, options: [.notifyOthersOnDeactivation])
        }
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }

    private func stopRecognition(notify: Bool) {
        // cancel()後に届く古いコールバックが、次の認識セッションを止めないよう無効化する。
        let hadActiveSession = lifecycle.end()
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

        do {
            try configurePlaybackSession(AVAudioSession.sharedInstance(), resetOutput: true)
        } catch {
            print("Failed to restore playback audio session: \(error)")
        }

        if hadActiveSession && notify {
            notifyListeners("listeningState", data: ["status": "stopped"])
        }
    }
}
