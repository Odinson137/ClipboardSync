import notifee, { AndroidImportance } from '@notifee/react-native';
import { NativeEventEmitter, NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signalRService } from './services/signalr';

module.exports = async (serviceData) => {
    notifee.registerForegroundService(() => {
        return new Promise(async () => {
            try {
                const { ClipboardListener } = NativeModules;

                signalRService.configure(serviceData);
                await signalRService.connect(serviceData.device_name, serviceData.device_id, serviceData.token);

                const emitter = new NativeEventEmitter(ClipboardListener);
                ClipboardListener.startListening();

                const sub = emitter.addListener('onClipboardChange', async (params) => {
                    if (params?.content && params?.type) {
                        await signalRService.sendClipboard(params.content, params.type);
                    }
                });

                async function loop() {
                    while (true) {
                        const ws = await AsyncStorage.getItem('wsIsRunning');
                        if (ws !== 'true') break;
                        await new Promise(res => setTimeout(res, 2000));
                    }
                    await signalRService.disconnect();
                    ClipboardListener.stopListening();
                    sub.remove();
                    await notifee.stopForegroundService();
                }

                loop();
            } catch (e) {
                console.error('Service error', e);
                await signalRService.disconnect();
                await notifee.stopForegroundService();
            }
        });
    });

    const channelId = await notifee.createChannel({
        id: 'ClipboardSync',
        name: 'ClipboardSync Monitor',
        importance: AndroidImportance.LOW,
        sound: '',
    });

    await notifee.displayNotification({
        title: 'ClipboardSync Service',
        body: 'Monitoring clipboard for changes',
        android: { channelId, asForegroundService: true, smallIcon: 'ic_small_icon', ongoing: true },
    });

    return [true, 'Foreground service running'];
};
