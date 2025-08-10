import BackgroundService from 'react-native-background-actions';
import Clipboard from '@react-native-clipboard/clipboard';
import { signalRService } from './signalr';

let lastClipboardText = '';

const sleep = (time: number) =>
    new Promise(resolve => setTimeout(resolve, time));

export const clipboardTask = async (taskData: any) => {
    const { delay } = taskData;
    console.log('[BackgroundClipboard] Started with delay', delay);

    try {
        while (BackgroundService.isRunning()) {
            try {
                const text = await Clipboard.getString();

                if (text && text !== lastClipboardText) {
                    lastClipboardText = text;
                    console.log('[BackgroundClipboard] Clipboard changed:', text);

                    // Проверка подключения SignalR
                    if (signalRService.isConnected()) {
                        await signalRService.sendClipboard(text, 0);
                    } else {
                        console.warn('[BackgroundClipboard] SignalR not connected, skipping send');
                    }
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
        taskDesc: 'Syncing your clipboard in background',
        taskIcon: { name: 'ic_launcher', type: 'mipmap' },
        color: '#ff00ff',
        parameters: { delay: 2000 },
        stopWithTask: true,
        linkingURI: 'clipboardsync://app', // Для возврата в приложение
        notificationConfig: {
            isOngoing: true, // Уведомление нельзя смахнуть
            priority: 'high', // Высокий приоритет
        },
    };
    console.log('[BackgroundClipboard] Starting...');
    await BackgroundService.start(clipboardTask, options);
};

export const stopClipboardService = async () => {
    if (BackgroundService.isRunning()) {
        console.log('[BackgroundClipboard] Stopping...');
        await BackgroundService.stop();
    }
};
