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
        CAPPluginMethod(name: "isListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise)
    ]

    private var speechRecognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer()?.isAvailable ?? false])
    }

    @objc func start(_ call: CAPPluginCall) {
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
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = partialResults
        audioEngine = engine
        recognitionRequest = request

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let inputNode = engine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }

                if let result {
                    let matches = Array(result.transcriptions.prefix(maxResults)).map(\.formattedString)
                    if partialResults {
                        self.notifyListeners("partialResults", data: ["matches": matches])
                    } else if result.isFinal {
                        call.resolve(["matches": matches])
                    }
                    if result.isFinal {
                        self.stopRecognition(notify: true)
                    }
                }

                if let error {
                    self.stopRecognition(notify: true)
                    if !partialResults {
                        call.reject(error.localizedDescription)
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
        stopRecognition(notify: true)
        call.resolve()
    }

    @objc func isListening(_ call: CAPPluginCall) {
        call.resolve(["listening": audioEngine?.isRunning ?? false])
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

    private func stopRecognition(notify: Bool) {
        let wasRunning = audioEngine?.isRunning == true
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioEngine = nil
        speechRecognizer = nil

        if wasRunning && notify {
            notifyListeners("listeningState", data: ["status": "stopped"])
        }
    }
}
