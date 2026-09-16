package com.kotodamamatch.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        BackgroundListeningService.refreshNotification(this);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpeechRecognitionPlugin.class);
        registerPlugin(KotodamaBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
