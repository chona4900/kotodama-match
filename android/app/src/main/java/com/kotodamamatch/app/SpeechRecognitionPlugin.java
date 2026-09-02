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
    private static final int MAX_RECOVERY_ATTEMPTS = 4;
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
        if (listening) {
            call.reject("Speech recognition is already running");
            return;
        }

        language = call.getString("language", "ja-JP");
        partialResults = call.getBoolean("partialResults", true);
        maxResults = call.getInt("maxResults", 1);

        getActivity().runOnUiThread(() -> {
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
        result.put("listening", listening);
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
                scheduleRecognizerRestart(250, false, error);
                break;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
            case SpeechRecognizer.ERROR_SERVER_DISCONNECTED:
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                // サービスとの接続が揺れた時は認識器を作り直して少し待つ。
                scheduleRecognizerRestart(1000, true, error);
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
        // これはユーザーがMICを止めた意味ではないので、同じ認識器を再開する。
        scheduleRecognizerRestart(250, false, 0);
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
        boolean wasListening = listening;
        listeningRequested = false;
        mainHandler.removeCallbacksAndMessages(null);
        restartScheduled = false;
        listening = false;
        destroyRecognizer();
        BackgroundListeningService.stop(getContext());
        if (wasListening) {
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
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
        }

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, partialResults);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, maxResults);
        // 長い言霊も途中で切れにくいよう、少し長めの無音を待つ。
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
        listening = true;
        recognitionSessionId += 1;
        recognizer.startListening(intent);
    }

    private void scheduleRecognizerRestart(long baseDelayMillis, boolean recreateRecognizer, int errorCode) {
        if (!listeningRequested || restartScheduled) return;
        if (recoveryAttempt >= MAX_RECOVERY_ATTEMPTS) {
            notifySpeechError(errorCode, false);
            stopAndNotify();
            return;
        }

        recoveryAttempt += 1;
        restartScheduled = true;
        listening = false;
        if (recreateRecognizer) destroyRecognizer();
        notifySpeechError(errorCode, true);
        notifyListeningState("recovering");
        long retryDelay = Math.min(baseDelayMillis * (1L << Math.min(recoveryAttempt - 1, 3)), 8000L);
        mainHandler.postDelayed(() -> {
            restartScheduled = false;
            if (!listeningRequested) return;
            try {
                startRecognizer();
            } catch (Exception error) {
                // 一時的な通信・認識サービスの揺れでは、間隔を広げて再試行する。
                scheduleRecognizerRestart(1000, true, 0);
            }
        }, retryDelay);
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
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
