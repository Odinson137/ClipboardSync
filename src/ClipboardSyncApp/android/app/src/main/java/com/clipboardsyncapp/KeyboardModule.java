package com.clipboardsyncapp;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.view.inputmethod.InputMethodManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.util.List;

public class KeyboardModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KeyboardModule";
    private ReactApplicationContext context;

    public KeyboardModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;
    }

    @Override
    public String getName() {
        return "KeyboardModule";
    }

    @ReactMethod
    public void isKeyboardEnabled(Promise promise) {
        try {
            InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
            boolean enabled = imm.getEnabledInputMethodList().stream()
                    .anyMatch(inputMethod -> inputMethod.getId().contains("com.clipboardsyncapp/.ClipboardSyncIME"));
            promise.resolve(enabled);
        } catch (Exception e) {
            promise.reject("KEYBOARD_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openKeyboardSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("KEYBOARD_SETTINGS_ERROR", e.getMessage());
        }
    }
}