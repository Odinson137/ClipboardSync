package com.clipboardsyncapp;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.List;

public class AccessibilityModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext context;
    private static final String PREFS = "clipboardsync_prefs";
    private static final String KEY_CONNECTED = "service_connected";
    private static final String KEY_LAST_TEXT = "last_clip_text";
    private static final String KEY_LAST_TS = "last_clip_ts";

    public AccessibilityModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;
    }

    @Override
    public String getName() {
        return "AccessibilityModule";
    }

    @ReactMethod
    public void isAccessibilityServiceEnabled(Promise promise) {
        promise.resolve(isServiceEnabledInternal());
    }

    private boolean isServiceEnabledInternal() {
        AccessibilityManager am = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        String expectedId = context.getPackageName() + "/" + MyAccessibilityService.class.getName();

        List<AccessibilityServiceInfo> list =
                am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
        for (AccessibilityServiceInfo s : list) {
            if (expectedId.equals(s.getId())) return true;
        }

        try {
            String enabledServices = Settings.Secure.getString(
                    context.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (!TextUtils.isEmpty(enabledServices) && enabledServices.contains(expectedId)) {
                return true;
            }
        } catch (Exception ignored) {}

        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return sp.getBoolean(KEY_CONNECTED, false);
    }

    @ReactMethod
    public void getAccessibilityStatus(Promise promise) {
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        promise.resolve(sp.getBoolean(KEY_CONNECTED, false));
    }

    @ReactMethod
    public void getLastClipboardEvent(Promise promise) {
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String text = sp.getString(KEY_LAST_TEXT, "");
        long ts = sp.getLong(KEY_LAST_TS, 0L);
        promise.resolve("{\"text\":\"" + escape(text) + "\",\"ts\":" + ts + "}");
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    @ReactMethod
    public void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
