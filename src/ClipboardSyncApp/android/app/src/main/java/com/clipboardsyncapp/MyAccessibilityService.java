package com.clipboardsyncapp;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class MyAccessibilityService extends AccessibilityService {
    private static final String TAG = "MyAccessibilityService";
    private static final String PREFS = "clipboardsync_prefs";
    private static final String KEY_CONNECTED = "service_connected";
    private static final String KEY_LAST_TEXT = "last_clip_text";
    private static final String KEY_LAST_TS = "last_clip_ts";
    private static final String CHANNEL_ID = "clipboardsync_channel";

    private String lastClipboardText = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable debounceRunnable;
    private static final long DEBOUNCE_DELAY = 300;

    private ClipboardManager.OnPrimaryClipChangedListener clipListener = new ClipboardManager.OnPrimaryClipChangedListener() {
        @Override
        public void onPrimaryClipChanged() {
            Log.d(TAG, "OnPrimaryClipChanged fired");
            triggerClipboardCheckNow();
        }
    };

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        // Логируем для отладки
        Log.d(TAG, "Event type=" + event.getEventType() + " from pkg=" + event.getPackageName());

        int t = event.getEventType();
        if (t == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                || t == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED
                || t == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
                || t == AccessibilityEvent.TYPE_VIEW_CLICKED
                || t == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || t == AccessibilityEvent.TYPE_VIEW_FOCUSED
                || t == AccessibilityEvent.TYPE_TOUCH_INTERACTION_END
                || t == AccessibilityEvent.TYPE_TOUCH_EXPLORATION_GESTURE_END
                || t == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            debounceClipboardCheck();
        }
    }

    private void debounceClipboardCheck() {
        if (debounceRunnable != null) handler.removeCallbacks(debounceRunnable);
        debounceRunnable = this::checkClipboardOrPrompt;
        handler.postDelayed(debounceRunnable, DEBOUNCE_DELAY);
    }

    private void triggerClipboardCheckNow() {
        if (debounceRunnable != null) handler.removeCallbacks(debounceRunnable);
        checkClipboardOrPrompt();
    }

    private void checkClipboardOrPrompt() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        try {
            if (clipboard != null && clipboard.hasPrimaryClip()) {
                ClipData clip = clipboard.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence cs = clip.getItemAt(0).coerceToText(this);
                    String text = (cs != null) ? cs.toString() : null;
                    if (text != null && !text.equals(lastClipboardText)) {
                        lastClipboardText = text;
                        Log.d(TAG, "Clipboard changed: " + text);
                        saveLastClipboard(text);
                        showNotification(text);
                        sendEventToJS("ClipboardChanged", text);
                    }
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Clipboard access denied (no focus / background)", e);
            sendEventToJS("ClipboardAccessDenied", "Откройте приложение, чтобы разрешить доступ к буферу");
            // OPTIONAL: можно поднять активити, но это навязчиво — не делаем по умолчанию
        }
    }

    private void saveLastClipboard(String text) {
        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        sp.edit()
                .putString(KEY_LAST_TEXT, text)
                .putLong(KEY_LAST_TS, System.currentTimeMillis())
                .apply();
    }

    private void showNotification(String text) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentTitle("ClipboardSync")
                .setContentText(text.length() > 60 ? text.substring(0, 60) + "…" : text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false);
        Notification n = b.build();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(1001, n);
    }

    private void sendEventToJS(String eventName, String text) {
        ReactApplication app = (ReactApplication) getApplication();
        ReactContext reactContext =
                app.getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, text);
        } else {
            Log.w(TAG, "ReactContext not available; saved to SharedPreferences");
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Service interrupted");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.e(TAG, "=== Accessibility Service CONNECTED ===");

        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        sp.edit().putBoolean(KEY_CONNECTED, true).apply();
        sendEventToJS("AccessibilityStatus", "connected");

        // регистрируем слушатель буфера (если ОС позволит — будет стрелять)
        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) clipboard.addPrimaryClipChangedListener(clipListener);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to register clipboard listener", t);
        }

        Toast.makeText(this, "Accessibility Service Connected", Toast.LENGTH_SHORT).show();
    }

    @Override
    public boolean onUnbind(Intent intent) {
        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        sp.edit().putBoolean(KEY_CONNECTED, false).apply();
        sendEventToJS("AccessibilityStatus", "disconnected");

        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null && clipListener != null) {
                clipboard.removePrimaryClipChangedListener(clipListener);
            }
        } catch (Throwable ignored) {}

        return super.onUnbind(intent);
    }
}
