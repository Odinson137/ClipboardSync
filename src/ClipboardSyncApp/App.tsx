import React, { useState, useEffect } from 'react';
import {
    View, Text, Button, Alert, StyleSheet, NativeModules, DeviceEventEmitter, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import AuthScreen from './screens/AuthScreen';
import { signalRService } from './services/signalr';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceId';

const AccessibilityModule = NativeModules.AccessibilityModule;

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [clipboardContent, setClipboardContent] = useState('');
    const [isAccessibilityEnabled, setIsAccessibilityEnabled] = useState(false);
    const [lastServiceText, setLastServiceText] = useState<string>('');
    const [lastServiceTs, setLastServiceTs] = useState<number>(0);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                if (storedToken) {
                    setToken(storedToken);
                    setIsAuthenticated(true);
                    await initSignalR(storedToken);
                    await refreshAccessibilityStatus();
                }
            } catch {
                Alert.alert('Ошибка', 'Не удалось восстановить сессию');
            }
        };
        restoreSession();

        const clipSub = DeviceEventEmitter.addListener('ClipboardChanged', (text) => {
            setClipboardContent(text);
            if (signalRService.isConnected()) {
                signalRService.sendClipboard(text, 0).catch(err => console.error('Send error:', err));
            }
        });

        const accessDeniedSub = DeviceEventEmitter.addListener('ClipboardAccessDenied', (message) => {
            Alert.alert('Требуется действие', message, [{ text: 'OK' }]);
        });

        const statusSub = DeviceEventEmitter.addListener('AccessibilityStatus', async (status) => {
            await refreshAccessibilityStatus();
        });

        return () => {
            clipSub.remove();
            accessDeniedSub.remove();
            statusSub.remove();
        };
    }, []);

    const initSignalR = async (authToken: string) => {
        const deviceId = await getOrCreateDeviceId();
        const deviceName = getDeviceName();
        await signalRService.connect(deviceName, deviceId, authToken);
    };

    const refreshAccessibilityStatus = async () => {
        if (Platform.OS !== 'android') return;
        // проверка через модуль (внутри 3 пути + флажок от сервиса)
        const connected = await AccessibilityModule.getAccessibilityStatus();
        setIsAccessibilityEnabled(!!connected);
    };

    const checkAccessibilityService = async () => {
        if (Platform.OS === 'android') {
            const enabled = await AccessibilityModule.isAccessibilityServiceEnabled();
            setIsAccessibilityEnabled(enabled);
            if (!enabled) {
                Alert.alert(
                    'Требуется разрешение',
                    'Включите Accessibility Service для фонового чтения буфера обмена',
                    [
                        { text: 'Отмена' },
                        { text: 'Открыть настройки', onPress: () => AccessibilityModule.openAccessibilitySettings() },
                    ]
                );
            }
        }
    };

    const handleLoginSuccess = async (newToken: string) => {
        setToken(newToken);
        setIsAuthenticated(true);
        await AsyncStorage.setItem('token', newToken);
        await initSignalR(newToken);
        await refreshAccessibilityStatus();
    };

    const handleLogout = async () => {
        await signalRService.disconnect();
        await AsyncStorage.removeItem('token');
        setIsAuthenticated(false);
        setToken(null);
        setClipboardContent('');
        setIsAccessibilityEnabled(false);
    };

    function  test() {
        console.log('test');
    }
    const copyToClipboard = async () => {
        try {
            const text = 'Example text from client';
            Clipboard.setString(text);
            await signalRService.sendClipboard(text, 0);
            Alert.alert('Успех', 'Буфер отправлен');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Отправка не удалась');
        }
    };

    // КНОПКА ДЛЯ ЯВНОЙ ПРОВЕРКИ: что сервис реально читал буфер
    const fetchLastServiceEvent = async () => {
        try {
            const raw = await AccessibilityModule.getLastClipboardEvent();
            const parsed = JSON.parse(raw);
            setLastServiceText(parsed.text || '');
            setLastServiceTs(parsed.ts || 0);
            if (!parsed.text) {
                Alert.alert('Проверка', 'Сервис ещё не прочитал буфер (нет события). Скопируй текст в любом приложении.');
            }
        } catch (e) {
            Alert.alert('Ошибка', 'Не удалось получить последнее событие от сервиса');
        }
    };

    if (!isAuthenticated) {
        return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ClipboardSync</Text>

            <Text>Clipboard (RN): {clipboardContent}</Text>
            <Text>Accessibility Service: {isAccessibilityEnabled ? 'Включен' : 'Выключен'}</Text>

            {!isAccessibilityEnabled && (
                <Button title="Включить Accessibility Service" onPress={checkAccessibilityService} />
            )}

            <View style={{ height: 12 }} />

            <Button title="Send Example Clipboard" onPress={copyToClipboard} />
            <View style={{ height: 12 }} />
            <Button title="Проверить сервис (последнее чтение)" onPress={fetchLastServiceEvent} />

            {lastServiceTs > 0 && (
                <View style={{ marginTop: 12 }}>
                    <Text>Последнее чтение сервисом:</Text>
                    <Text selectable>
                        {new Date(lastServiceTs).toLocaleString()} • {lastServiceText}
                    </Text>
                    <Text style={{ fontSize: 12, opacity: 0.7 }}>
                        (Это записано сервисом в SharedPreferences и обновляется при каждом копировании)
                    </Text>
                </View>
            )}

            <View style={{ height: 24 }} />
            <Button title="Выйти" onPress={handleLogout} color="red" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
});

export default App;
