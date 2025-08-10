package com.clipboardsyncapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class NotificationChannelModule extends ReactContextBaseJavaModule {
    private static final String CHANNEL_ID = "clipboardsync_channel";
    private static final String CHANNEL_NAME = "ClipboardSync Service";
    private static final String CHANNEL_DESCRIPTION = "Notifications for ClipboardSync background service";

    NotificationChannelModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "NotificationChannelModule";
    }

    @ReactMethod
    public void createNotificationChannel(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(CHANNEL_DESCRIPTION);
                channel.setLockscreenVisibility(NotificationManager.IMPORTANCE_HIGH);
                channel.enableVibration(true); // Для видимости
                NotificationManager manager = getReactApplicationContext().getSystemService(NotificationManager.class);
                manager.createNotificationChannel(channel);
                promise.resolve(true);
            } else {
                promise.resolve(false); // Каналы не нужны на Android < 8.0
            }
        } catch (Exception e) {
            promise.reject("CHANNEL_CREATION_ERROR", e.getMessage());
        }
    }
}