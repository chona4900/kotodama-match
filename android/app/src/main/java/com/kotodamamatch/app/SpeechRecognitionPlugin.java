package com.kotodamamatch.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(
    name = "SpeechRecognition",
    permissions = {
        @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})
    }
)
public class SpeechRecognitionPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private boolean listening = false;
    private boolean listeningRequested = false;
    private boolean partialResults = true;
    private String language = "ja-JP";
    private int maxResults = 1;
    private boolean restartScheduled = false;
    private int recognitionSessionId = 0;
    private int recoveryAttempt = 0;
    private static final int MAX_FOREGROUND_RECOVERY_ATTEMPTS = 4;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is unavailable");
            return;
        }
        if (listening || listeningRequested || restartScheduled) {
            call.reject("Speech recognition is already running");
            return;
        }

        language = call.getString("language", "ja-JP");
        partialResults = call.getBoolean("partialResults", true);
        maxResults = call.getInt("maxResults", 1);

        getActivity().runOnUiThread(() -> {
            if (listening || listeningRequested || restartScheduled) {
                call.reject("Speech recognition is already running");
                return;
            }
            try {
                // ユーザーがMICをオンにした直後だけ開始する。Android 14以降は
                // バックグラウンドからマイク用サービスを起動できないため、ここで維持する。
                BackgroundListeningService.start(getContext());
                listeningRequested = true;
                startRecognizer();
                notifyListeningState("started");
                call.resolve();
            } catch (Exception error) {
                listeningRequested = false;
                BackgroundListeningService.stop(getContext());
                call.reject("Failed to start background listening: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            listeningRequested = false;
            mainHandler.removeCallbacksAndMessages(null);
            if (recognizer != null) {
                recognizer.stopListening();
            }
            stopAndNotify();
            call.resolve();
        });
    }

    @PluginMethod
    public void isListening(PluginCall call) {
        JSObject result = new JSObject();
        // 発話間の短い再開待ちも、ユーザーにとってはMICオンの状態。
        // ここでfalseを返すと画面復帰と再開タイマーが競合して停止扱いになる。
        result.put("listening", listeningRequested);
        call.resolve(result);
    }

    @PluginMethod
    public void getSupportedLanguages(PluginCall call) {
        Set<String> languageTags = new LinkedHashSet<>();
        for (Locale locale : Locale.getAvailableLocales()) {
            String tag = locale.toLanguageTag();
            if (!tag.isEmpty() && !tag.equals("und")) {
                languageTags.add(tag);
            }
        }
        JSObject result = new JSObject();
        result.put("languages", new JSArray(new ArrayList<>(languageTags)));
        call.resolve(result);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        resolvePermissions(call);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            resolvePermissions(call);
            return;
        }
        requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        resolvePermissions(call);
    }

    private void resolvePermissions(PluginCall call) {
        String state = permissionStateForJavascript();
        JSObject result = new JSObject();
        result.put("microphone", state);
        result.put("speechRecognition", state);
        call.resolve(result);
    }

    private String permissionStateForJavascript() {
        PermissionState state = getPermissionState("microphone");
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.DENIED) return "denied";
        return "prompt";
    }

    @Override
    public void onReadyForSpeech(Bundle params) {
        recoveryAttempt = 0;
    }

    @Override
    public void onBeginningOfSpeech() {}

    @Override
    public void onRmsChanged(float rmsdB) {}

    @Override
    public void onBufferReceived(byte[] buffer) {}

    @Override
    public void onEndOfSpeech() {}

    @Override
    public void onError(int error) {
        if (!listeningRequested) return;

        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                // 無音・認識なしは通常の発話区切り。すぐ次を聞き始める。
                recoveryAttempt = 0;
                scheduleRecognizerRestart(250, true, 0, false);
                break;
            case SpeechRecognizer.ERROR_CLIENT:
            case SpeechRecognizer.ERROR_AUDIO:
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
            case SpeechRecognizer.ERROR_SERVER_DISCONNECTED:
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                // サービスとの接続が揺れた時は認識器を作り直して少し待つ。
                scheduleRecognizerRestart(1000, true, error, true);
                break;
            case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:
                // 再開要求が短時間に集中した時は、長めに待ってから再接続する。
                scheduleRecognizerRestart(2000, true, error, true);
                break;
            default:
                // マイク・権限など、再試行しても直らない可能性が高いエラーは
                // ループせず、アプリ側へ理由を伝えて停止する。
                notifySpeechError(error, false);
                stopAndNotify();
                break;
        }
    }

    @Override
    public void onResults(Bundle results) {
        emitMatches("partialResults", results, true);
        // AndroidのSpeechRecognizerは1発話ごとに結果を返して終了する。
        // これはユーザーがMICを止めた意味ではない。古いコールバックを
        // 次の発話へ混ぜないため、認識器はセッションごとに作り直す。
        recoveryAttempt = 0;
        scheduleRecognizerRestart(250, true, 0, false);
    }

    @Override
    public void onPartialResults(Bundle partial) {
        if (partialResults) {
            emitMatches("partialResults", partial, false);
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) {}

    private void emitMatches(String eventName, Bundle bundle, boolean isFinal) {
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        JSObject data = new JSObject();
        data.put("matches", new JSArray(matches));
        data.put("isFinal", isFinal);
        data.put("sessionId", recognitionSessionId);
        notifyListeners(eventName, data);
    }

    private void notifyListeningState(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("listeningState", data);
    }

    private void stopAndNotify() {
        boolean shouldNotify = listening || listeningRequested || restartScheduled;
        listeningRequested = false;
        mainHandler.removeCallbacksAndMessages(null);
        restartScheduled = false;
        listening = false;
        destroyRecognizer();
        BackgroundListeningService.stop(getContext());
        if (shouldNotify) {
            notifyListeningState("stopped");
        }
    }

    private void notifySpeechError(int error, boolean willRetry) {
        JSObject data = new JSObject();
        data.put("code", error);
        data.put("willRetry", willRetry);
        notifyListeners("recognitionError", data);
    }

    private void startRecognizer() {
        if (recognizer != null) destroyRecognizer();
        recognitionSessionId += 1;
        int sessionId = recognitionSessionId;
        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new SessionRecognitionListener(sessionId));

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, partialResults);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, maxResults);
        // 長い言霊も途中で切れにくいよう、少し長めの無音を待つ。
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
        recognizer.startListening(intent);
        listening = true;
    }

    private void scheduleRecognizerRestart(
        long baseDelayMillis,
        boolean recreateRecognizer,
        int errorCode,
        boolean countRecoveryAttempt
    ) {
        if (!listeningRequested || restartScheduled) return;
        // ホーム画面へ移動した直後は、端末や認識サービスによって
        // ERROR_CLIENT / ERROR_AUDIO が返ることがある。MICをオンにした
        // 意思とフォアグラウンドサービスが残っている間は、4回で勝手に
        // 停止せず、上限付きの待機時間で聞き取りを再接続し続ける。
        // 明示的なMICオフ、権限エラーなどの致命的な経路は従来どおり停止する。
        boolean keepForegroundServiceAlive = BackgroundListeningService.isRunning();
        if (countRecoveryAttempt
            && !keepForegroundServiceAlive
            && recoveryAttempt >= MAX_FOREGROUND_RECOVERY_ATTEMPTS) {
            notifySpeechError(errorCode, false);
            stopAndNotify();
            return;
        }

        if (countRecoveryAttempt) recoveryAttempt += 1;
        restartScheduled = true;
        listening = false;
        if (recreateRecognizer) destroyRecognizer();
        if (countRecoveryAttempt) notifySpeechError(errorCode, true);
        notifyListeningState("recovering");
        int backoffExponent = countRecoveryAttempt ? Math.min(Math.max(recoveryAttempt - 1, 0), 3) : 0;
        long retryDelay = Math.min(baseDelayMillis * (1L << backoffExponent), 8000L);
        mainHandler.postDelayed(() -> {
            restartScheduled = false;
            if (!listeningRequested) return;
            try {
                startRecognizer();
            } catch (Exception error) {
                // 一時的な通信・認識サービスの揺れでは、間隔を広げて再試行する。
                scheduleRecognizerRestart(1000, true, SpeechRecognizer.ERROR_CLIENT, true);
            }
        }, retryDelay);
    }

    private void destroyRecognizer() {
        // cancel/destroy後に遅れて届く旧セッションの結果を、現在の結果として扱わない。
        recognitionSessionId += 1;
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
        }
    }

    private final class SessionRecognitionListener implements RecognitionListener {
        private final int sessionId;

        SessionRecognitionListener(int sessionId) {
            this.sessionId = sessionId;
        }

        private boolean isCurrent() {
            return listeningRequested && recognitionSessionId == sessionId;
        }

        @Override public void onReadyForSpeech(Bundle params) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onReadyForSpeech(params);
        }
        @Override public void onBeginningOfSpeech() {
            if (isCurrent()) SpeechRecognitionPlugin.this.onBeginningOfSpeech();
        }
        @Override public void onRmsChanged(float rmsdB) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onRmsChanged(rmsdB);
        }
        @Override public void onBufferReceived(byte[] buffer) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onBufferReceived(buffer);
        }
        @Override public void onEndOfSpeech() {
            if (isCurrent()) SpeechRecognitionPlugin.this.onEndOfSpeech();
        }
        @Override public void onError(int error) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onError(error);
        }
        @Override public void onResults(Bundle results) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onResults(results);
        }
        @Override public void onPartialResults(Bundle partialResults) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onPartialResults(partialResults);
        }
        @Override public void onEvent(int eventType, Bundle params) {
            if (isCurrent()) SpeechRecognitionPlugin.this.onEvent(eventType, params);
        }
    }

    @Override
    protected void handleOnDestroy() {
        listeningRequested = false;
        mainHandler.removeCallbacksAndMessages(null);
        restartScheduled = false;
        destroyRecognizer();
        BackgroundListeningService.stop(getContext());
        super.handleOnDestroy();
    }
}
