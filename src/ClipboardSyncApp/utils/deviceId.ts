import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'DEVICE_ID_KEY';

export async function getOrCreateDeviceId(): Promise<string> {
    try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

        if (!deviceId) {
            deviceId = uuid.v4().toString();
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
            console.log('[DeviceID] New generated:', deviceId);
        } else {
            console.log('[DeviceID] Loaded from storage:', deviceId);
        }

        return deviceId;
    } catch (error) {
        console.error('[DeviceID] Error working with AsyncStorage:', error);
        return uuid.v4().toString();
    }
}

export function getDeviceName(): string {
    return Platform.OS + '-' + Platform.Version;
}
