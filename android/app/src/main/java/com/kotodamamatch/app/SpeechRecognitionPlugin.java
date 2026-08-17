package com.kotodamamatch.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
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
    private boolean partialResults = true;

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

        String language = call.getString("language", "ja-JP");
        partialResults = call.getBoolean("partialResults", true);

        getActivity().runOnUiThread(() -> {
            destroyRecognizer();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, partialResults);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, call.getInt("maxResults", 1));

            listening = true;
            recognizer.startListening(intent);
            notifyListeningState("started");
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
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
    public void onReadyForSpeech(Bundle params) {}

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
        stopAndNotify();
    }

    @Override
    public void onResults(Bundle results) {
        emitMatches("partialResults", results);
        stopAndNotify();
    }

    @Override
    public void onPartialResults(Bundle partial) {
        if (partialResults) {
            emitMatches("partialResults", partial);
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) {}

    private void emitMatches(String eventName, Bundle bundle) {
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        JSObject data = new JSObject();
        data.put("matches", new JSArray(matches));
        notifyListeners(eventName, data);
    }

    private void notifyListeningState(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("listeningState", data);
    }

    private void stopAndNotify() {
        boolean wasListening = listening;
        listening = false;
        destroyRecognizer();
        if (wasListening) {
            notifyListeningState("stopped");
        }
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
        destroyRecognizer();
        super.handleOnDestroy();
    }
}
