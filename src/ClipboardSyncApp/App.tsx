import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    Alert,
    StyleSheet,
    NativeModules,
    DeviceEventEmitter,
    Platform,
    PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import AuthScreen from './screens/AuthScreen';
import { signalRService } from './services/signalr';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceId';

const KeyboardModule = NativeModules.KeyboardModule;

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState(null);
    const [clipboardContent, setClipboardContent] = useState('');
    const [isKeyboardEnabled, setIsKeyboardEnabled] = useState(false);
    const [manualInput, setManualInput] = useState('');

    useEffect(() => {
        const requestPermissions = async () => {
            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                ]);
                console.log('Permissions:', granted);
            } catch (error) {
                console.error('Permission request error:', error);
                Alert.alert('Ошибка', 'Не удалось запросить разрешения: ' + error.message);
            }
        };

        const restoreSession = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                if (storedToken) {
                    console.log('Restoring session with token:', storedToken);
                    setToken(storedToken);
                    setIsAuthenticated(true);
                    await initSignalR(storedToken).catch((err) => {
                        console.error('SignalR init error:', err);
                        Alert.alert('Ошибка', 'Не удалось инициализировать SignalR: ' + err.message);
                    });
                    await checkKeyboard().catch((err) => {
                        console.error('Keyboard check error:', err);
                        Alert.alert('Ошибка', 'Не удалось проверить клавиатуру: ' + err.message);
                    });
                }
            } catch (error) {
                console.error('Restore session error:', error);
                Alert.alert('Ошибка', 'Не удалось восстановить сессию: ' + error.message);
            }
        };

        requestPermissions();
        restoreSession();

        const clipboardListener = DeviceEventEmitter.addListener('ClipboardChanged', (text) => {
            console.log('Clipboard changed event:', text);
            setClipboardContent(text);
            if (signalRService.isConnected()) {
                signalRService.sendClipboard(text, 0).catch((err) => {
                    console.error('Send clipboard error:', err);
                    Alert.alert('Ошибка', 'Не удалось отправить буфер: ' + err.message);
                });
            }
        });

        const clipboardErrorListener = DeviceEventEmitter.addListener('ClipboardError', (message) => {
            console.log('Clipboard error:', message);
            Alert.alert('Ошибка', message, [{ text: 'OK' }]);
        });

        return () => {
            clipboardListener.remove();
            clipboardErrorListener.remove();
        };
    }, []);

    const initSignalR = async (authToken) => {
        try {
            const deviceId = await getOrCreateDeviceId();
            const deviceName = getDeviceName();
            console.log('Connecting to SignalR with deviceId:', deviceId, 'deviceName:', deviceName);
            await signalRService.connect(deviceName, deviceId, authToken);
        } catch (error) {
            console.error('SignalR connection error:', error);
            throw error;
        }
    };

    const checkKeyboard = async () => {
        if (Platform.OS === 'android') {
            try {
                const enabled = await KeyboardModule.isKeyboardEnabled();
                console.log('Keyboard enabled:', enabled);
                setIsKeyboardEnabled(enabled);
                if (!enabled) {
                    Alert.alert(
                        'Требуется разрешение',
                        'Включите клавиатуру ClipboardSync в настройках для мониторинга буфера обмена',
                        [
                            { text: 'Отмена' },
                            {
                                text: 'Открыть настройки',
                                onPress: async () => {
                                    try {
                                        await KeyboardModule.openKeyboardSettings();
                                    } catch (error) {
                                        console.error('Open keyboard settings error:', error);
                                        Alert.alert('Ошибка', 'Не удалось открыть настройки клавиатуры: ' + error.message);
                                    }
                                },
                            },
                        ]
                    );
                }
            } catch (error) {
                console.error('Keyboard check error:', error);
                throw error;
            }
        }
    };

    const handleLoginSuccess = async (newToken) => {
        try {
            setToken(newToken);
            setIsAuthenticated(true);
            await AsyncStorage.setItem('token', newToken);
            await initSignalR(newToken);
            await checkKeyboard();
        } catch (error) {
            console.error('Login success error:', error);
            Alert.alert('Ошибка', 'Ошибка при входе: ' + error.message);
        }
    };

    const handleLogout = async () => {
        try {
            await signalRService.disconnect();
            await AsyncStorage.removeItem('token');
            setIsAuthenticated(false);
            setToken(null);
            setClipboardContent('');
            setIsKeyboardEnabled(false);
        } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Ошибка', 'Ошибка при выходе: ' + error.message);
        }
    };

    const copyToClipboard = async () => {
        try {
            const text = 'Example text from client';
            Clipboard.setString(text);
            await signalRService.sendClipboard(text, 0);
            Alert.alert('Успех', 'Буфер отправлен');
        } catch (error) {
            console.error('Copy to clipboard error:', error);
            Alert.alert('Ошибка', error.message || 'Отправка не удалась');
        }
    };

    const handleManualPaste = async () => {
        try {
            if (manualInput) {
                setClipboardContent(manualInput);
                if (signalRService.isConnected()) {
                    await signalRService.sendClipboard(manualInput, 0);
                    Alert.alert('Успех', 'Текст отправлен через SignalR');
                } else {
                    Alert.alert('Ошибка', 'SignalR не подключен');
                }
            } else {
                Alert.alert('Ошибка', 'Введите текст для отправки');
            }
        } catch (error) {
            console.error('Manual paste error:', error);
            Alert.alert('Ошибка', error.message || 'Ошибка отправки');
        }
    };

    if (!isAuthenticated) {
        return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ClipboardSync</Text>
            <Text>Clipboard: {clipboardContent}</Text>
            <Text>Keyboard: {isKeyboardEnabled ? 'Включена' : 'Выключена'}</Text>
            {!isKeyboardEnabled && (
                <Button title="Включить клавиатуру" onPress={checkKeyboard} />
            )}
            <TextInput
                style={styles.input}
                placeholder="Вставьте текст вручную"
                value={manualInput}
                onChangeText={setManualInput}
            />
            <Button title="Отправить введенный текст" onPress={handleManualPaste} />
            <Button title="Send Example Clipboard" onPress={copyToClipboard} />
            <Button title="Выйти" onPress={handleLogout} color="red" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10 },
});

export default App;