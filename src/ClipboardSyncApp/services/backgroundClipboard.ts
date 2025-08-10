import BackgroundService from 'react-native-background-actions';
import Clipboard from '@react-native-clipboard/clipboard';
import { signalRService } from './signalr';
import { AppState, NativeModules } from 'react-native';
const { NotificationChannelModule } = NativeModules; // Для вызова native-модуля

let lastClipboardText = '';

const sleep = (time: number) =>
    new Promise(resolve => setTimeout(resolve, time));

export const clipboardTask = async (taskData: any) => {
    const { delay } = taskData;
    console.log('[BackgroundClipboard] Started with delay', delay, 'AppState:', AppState.currentState);

    try {
        while (BackgroundService.isRunning()) {
            try {
                const text = await Clipboard.getString();
                console.log('[BackgroundClipboard] Raw clipboard text:', text, 'AppState:', AppState.currentState);

                if (text && text !== lastClipboardText) {
                    lastClipboardText = text;
                    console.log('[BackgroundClipboard] Clipboard changed:', text);

                    if (signalRService.isConnected()) {
                        await signalRService.sendClipboard(text, 0);
                        console.log('[BackgroundClipboard] Sent to SignalR:', text);
                    } else {
                        console.warn('[BackgroundClipboard] SignalR not connected, skipping send');
                    }
                } else if (!text) {
                    console.warn('[BackgroundClipboard] Clipboard is empty or inaccessible');
                }
            } catch (err) {
                console.error('[BackgroundClipboard] Error in loop:', err);
            }

            await sleep(delay);
        }
    } catch (e) {
        console.error('[BackgroundClipboard] Fatal error:', e);
    }

    console.log('[BackgroundClipboard] Stopped');
};

export const startClipboardService = async () => {
    await stopClipboardService();
    const options = {
        taskName: 'ClipboardSync',
        taskTitle: 'Clipboard Sync Running',
        taskDesc: 'Syncing your clipboard in the background',
        taskIcon: { name: 'ic_launcher', type: 'mipmap' },
        color: '#ff00ff',
        parameters: { delay: 2000 },
        stopWithTask: true,
        linkingURI: 'clipboardsync://app',
        notificationConfig: {
            isOngoing: true,
            priority: 'high',
            channelId: 'clipboardsync_channel',
            channelName: 'ClipboardSync Service',
            channelDescription: 'Notifications for ClipboardSync background service',
            channelImportance: 4,
        },
    };

    console.log('[BackgroundClipboard] Starting...');
    try {
        if (NotificationChannelModule) {
            await NotificationChannelModule.createNotificationChannel();
            console.log('[BackgroundClipboard] Notification channel created');
        }
        await BackgroundService.start(clipboardTask, options);
        console.log('[BackgroundClipboard] Service started successfully');
    } catch (e) {
        console.error('[BackgroundClipboard] Failed to start service:', e);
    }
};

export const stopClipboardService = async () => {
    if (BackgroundService.isRunning()) {
        console.log('[BackgroundClipboard] Stopping...');
        try {
            await BackgroundService.stop();
            console.log('[BackgroundClipboard] Service stopped successfully');
        } catch (e) {
            console.error('[BackgroundClipboard] Failed to stop service:', e);
        }
  
    }
};