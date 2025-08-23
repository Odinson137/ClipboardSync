package com.clipboardsyncapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.inputmethodservice.InputMethodService;
import android.util.Log;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.LinearLayout;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class ClipboardSyncIME extends InputMethodService {
    private static final String TAG = "ClipboardSyncIME";
    private String lastClipboardText = "";

    @Override
    public View onCreateInputView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT));
        return layout;
    }

    @Override
    public void onStartInput(EditorInfo attribute, boolean restarting) {
        super.onStartInput(attribute, restarting);
        checkClipboard();
    }

    private void checkClipboard() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        try {
            if (clipboard.hasPrimaryClip()) {
                ClipData clip = clipboard.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence text = clip.getItemAt(0).getText();
                    if (text != null && !text.toString().equals(lastClipboardText)) {
                        lastClipboardText = text.toString();
                        Log.d(TAG, "Clipboard changed: " + text);
                        sendEventToJS("ClipboardChanged", text.toString());
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Clipboard access error", e);
            sendEventToJS("ClipboardError", "Ошибка доступа к буферу: " + e.getMessage());
        }
    }

    private void sendEventToJS(String eventName, String text) {
        try {
            ReactApplicationContext reactContext = MainApplication.getReactContext();
            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(eventName, text);
            } else {
                Log.w(TAG, "ReactContext not available for event: " + eventName);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to JS: " + eventName, e);
        }
    }

    @Override
    public void onFinishInput() {
        super.onFinishInput();
        checkClipboard();
    }
}
