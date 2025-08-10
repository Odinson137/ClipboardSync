import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, StyleSheet, InteractionManager, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import AuthScreen from './screens/AuthScreen';
import { signalRService } from './services/signalr';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceId';
import { startClipboardService, stopClipboardService } from './services/backgroundClipboard';

// Function to request battery optimization exemption
const requestBatteryOptimizationExemption = async () => {
    if (Platform.OS === 'android') {
        try {
            console.log('Requested battery optimization exemption');
        } catch (err) {
            console.warn('Error requesting battery optimization exemption:', err);
            Alert.alert('Ошибка', 'Не удалось открыть настройки оптимизации батареи');
        }
    }
};

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [clipboardContent, setClipboardContent] = useState('');

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                if (storedToken) {
                    setToken(storedToken);
                    setIsAuthenticated(true);
                    await initSignalR(storedToken);

                    // Запуск только после полной отрисовки и подключения SignalR
                    InteractionManager.runAfterInteractions(async () => {
                        if (signalRService.isConnected()) {
                            console.log('Starting background service after init...');
                            await requestBatteryOptimizationExemption(); // Request exemption before starting service
                            await startClipboardService();
                        } else {
                            console.warn('SignalR not ready, delaying background service');
                        }
                    });
                }
            } catch (error) {
                Alert.alert('Ошибка', 'Не удалось восстановить сессию');
            }
        };
        restoreSession();
    }, []);

    const initSignalR = async (authToken: string) => {
        const deviceId = await getOrCreateDeviceId();
        const deviceName = getDeviceName();
        await signalRService.connect(deviceName, deviceId, authToken);
    };

    const handleLoginSuccess = async (newToken: string) => {
        setToken(newToken);
        setIsAuthenticated(true);
        await AsyncStorage.setItem('token', newToken);
        await initSignalR(newToken);
        // Request exemption and start service after login
        InteractionManager.runAfterInteractions(async () => {
            await requestBatteryOptimizationExemption();
            await startClipboardService();
        });
    };

    const handleLogout = async () => {
        try {
            await stopClipboardService();
            await signalRService.disconnect(); // Закрыть соединение
        } catch (e) {
            console.warn('Ошибка при завершении соединения', e);
        }
        await AsyncStorage.removeItem('token');
        setIsAuthenticated(false);
        setToken(null);
        setClipboardContent('');
    };

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

    if (!isAuthenticated) {
        return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ClipboardSync</Text>
            <Text>Clipboard: {clipboardContent}</Text>
            <Button title="Send Example Clipboard" onPress={copyToClipboard} />
            <Button title="Выйти" onPress={handleLogout} color="red" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
});

export default App;