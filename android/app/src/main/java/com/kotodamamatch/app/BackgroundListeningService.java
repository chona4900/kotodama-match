package com.kotodamamatch.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class BackgroundListeningService extends Service {
    private static final String CHANNEL_ID = "kotodama_listening";
    private static final int NOTIFICATION_ID = 4101;
    // SpeechRecognizerの一時エラー時に、ユーザーが明示的にMICを止めるまで
    // バックグラウンド待受を継続すべきか判断するためのプロセス内状態。
    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    public static void start(Context context) {
        Intent intent = new Intent(context, BackgroundListeningService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, BackgroundListeningService.class));
    }

    // Settings can grant permission after the original foreground notification
    // was suppressed. Repost it without restarting microphone capture.
    public static void refreshNotification(Context context) {
        if (!running) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null && manager.areNotificationsEnabled()) {
            manager.notify(NOTIFICATION_ID, buildNotification(context));
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        running = true;
        createNotificationChannel();
        Notification notification = buildNotification(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    private static Notification buildNotification(Context context) {
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, openAppIntent, pendingIntentFlags);

        // Notification.Builder(Context, channelId) is Android 8+ only. The app
        // still supports Android 7.0, where the channel-less constructor is the
        // compatible equivalent (notification channels do not exist yet).
        Notification.Builder notificationBuilder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(context, CHANNEL_ID)
            : new Notification.Builder(context);
        return notificationBuilder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("コトダマっちが言霊をききとり中")
            .setContentText("マイクを止めるには、コトダマっちを開いてMICを押してください。")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();

    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        running = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "言霊のききとり",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("バックグラウンドで言霊をききとっている間に表示します。");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
}
