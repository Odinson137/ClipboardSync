import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Button,
    Alert,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import StartForegroundService from './StartForegroundService';
import { NativeModules } from 'react-native';

const { NativeBridgeModule } = NativeModules;
const SERVER_URL = 'https://probable-dogfish-known.ngrok-free.app';
const FETCH_TIMEOUT = 5000;

const getDeviceIdForService = async () => "212";
const getDeviceNameForService = () => "Android";

const fetchTimeout = async (input, init, timeout_ms = FETCH_TIMEOUT) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout_ms);
        const response = await fetch(input, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (e) {
        throw e;
    }
};

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState(null);
    const [clipboardContent, setClipboardContent] = useState('');
    const [enableLoadingPage, setEnableLoadingPage] = useState(true);
    const [enableLoginPage, setEnableLoginPage] = useState(false);
    const [loginStatusMessage, setLoginStatusMessage] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [wsIsRunning, setWsIsRunning] = useState('false');
    const [wsPageMessage, setWsPageMessage] = useState('');
    const [deviceInfo, setDeviceInfo] = useState({ id: '', name: '' });

    useEffect(() => {
        const initDeviceInfo = async () => {
            try {
                const deviceId = await getDeviceIdForService();
                const deviceName = getDeviceNameForService();
                setDeviceInfo({ id: deviceId, name: deviceName });
                console.log('Device Info:', { id: deviceId, name: deviceName });
            } catch (error) {
                console.error('Failed to get device info:', error);
            }
        };
        initDeviceInfo();
    }, []);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                const storedUserName = await AsyncStorage.getItem('userName');
                
                if (storedToken && storedUserName) {
                    setToken(storedToken);
                    setUserName(storedUserName);
                    setIsAuthenticated(true);
                    await startForegroundService();

                    setEnableLoadingPage(false);
                    setEnableLoginPage(false);
                } else {
                    setEnableLoadingPage(false);
                    setEnableLoginPage(true);
                }
            } catch (error) {
                Alert.alert('Ошибка', 'Не удалось восстановить сессию');
                setEnableLoadingPage(false);
                setEnableLoginPage(true);
            }
        };
        restoreSession();
    }, [deviceInfo]);

    const startForegroundService = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('token');
            console.log('Start ForegroundService: ' + storedToken);
            const serviceData = {
                token: storedToken,
                device_id: deviceInfo.id,
                device_name: deviceInfo.name,
                cipher_enabled: 'false',
            };

            console.log('Starting foreground service');
            const result = await StartForegroundService(serviceData);
            if (result[0]) {
                await AsyncStorage.setItem('wsIsRunning', 'true');
                setWsIsRunning('true');
                setWsPageMessage('✅ Clipboard monitoring service started');
            } else {
                setWsPageMessage('❌ Failed to start service: ' + result[1]);
            }
        } catch (error) {
            console.error('Error starting foreground service:', error);
            setWsPageMessage('❌ Error starting service: ' + error.message);
        }
    };

    const stopForegroundService = async () => {
        try {
            await AsyncStorage.setItem('wsIsRunning', 'false');
            setWsIsRunning('false');
            setWsPageMessage('✅ Service stopped');
        } catch (error) {
            console.error('Error stopping service:', error);
            setWsPageMessage('❌ Error stopping service: ' + error.message);
        }
    };

    const handleLogin = async () => {
        try {
            setLoginStatusMessage('⌛ Please wait...');
            const response = await fetchTimeout(`${SERVER_URL}/api/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, password }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed');

            const { token } = data;
            setToken(token);
            setIsAuthenticated(true);

            await Promise.all([
                AsyncStorage.setItem('token', token),
                AsyncStorage.setItem('userName', userName),
            ]);

            setLoginStatusMessage('✅ Login successful');
            setEnableLoginPage(false);
            await startForegroundService();
        } catch (error) {
            console.error('Login error:', error);
            setLoginStatusMessage(`❌ ${error.message || 'Login failed'}`);
        }
    };

    const handleLogout = async () => {
        try {
            await stopForegroundService();
            await Promise.all([
                AsyncStorage.removeItem('token'),
                AsyncStorage.removeItem('userName'),
            ]);

            setIsAuthenticated(false);
            setToken(null);
            setUserName('');
            setPassword('');
            setClipboardContent('');
            setEnableLoginPage(true);
            setWsIsRunning('false');
            setWsPageMessage('');
        } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout properly');
        }
    };

    const copyToClipboard = async () => {
        try {
            const text = 'Example text from client';
            Clipboard.setString(text);
            Alert.alert('Успех', 'Текст скопирован в буфер обмена');
        } catch (error) {
            console.error('Copy to clipboard error:', error);
            Alert.alert('Ошибка', error.message || 'Не удалось скопировать текст');
        }
    };

    const toggleService = async () => {
        if (wsIsRunning === 'true') {
            await stopForegroundService();
        } else {
            await startForegroundService();
        }
    };

    const checkClipboardContent = async () => {
        try {
            const content = await Clipboard.getString();
            setClipboardContent(content || 'Буфер обмена пуст');
        } catch (error) {
            console.error('Error reading clipboard:', error);
            setClipboardContent('Ошибка чтения буфера');
        }
    };

    useEffect(() => {
        if (wsIsRunning === 'true') {
            const interval = setInterval(checkClipboardContent, 2000);
            return () => clearInterval(interval);
        }
    }, [wsIsRunning]);

    if (enableLoadingPage) {
        return (
            <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight }}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.appTitle}>ClipboardSync</Text>
                    <View style={styles.loadingBottomContainer}>
                        <Text style={styles.loadingText}>Loading device information...</Text>
                        <ActivityIndicator size="large" />
                        <Text style={styles.deviceInfo}>
                            Device: {deviceInfo.name} ({deviceInfo.id.substring(0, 8)}...)
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    if (enableLoginPage) {
        return (
            <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.appTitle}>ClipboardSync</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Username:</Text>
                        <TextInput
                            style={styles.input}
                            value={userName}
                            onChangeText={setUserName}
                            autoCapitalize="none"
                            placeholder="Enter your username"
                        />
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Password:</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            placeholder="Enter your password"
                        />
                    </View>
                    {loginStatusMessage && (
                        <Text style={styles.message}>{loginStatusMessage}</Text>
                    )}
                    <TouchableOpacity
                        style={[styles.loginButton, (!userName || !password) && styles.disabledButton]}
                        onPress={handleLogin}
                        disabled={!userName || !password}
                    >
                        <Text style={styles.loginButtonText}>Login</Text>
                    </TouchableOpacity>
                    <View style={styles.deviceInfoContainer}>
                        <Text style={styles.deviceInfo}>Device: {deviceInfo.name}</Text>
                        <Text style={styles.deviceId}>ID: {deviceInfo.id}</Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight }}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.appTitle}>ClipboardSync</Text>
                <View style={styles.statusContainer}>
                    <Text style={[styles.statusIndicator, { color: wsIsRunning === 'true' ? 'green' : 'red' }]}>
                        ● Service: {wsIsRunning === 'true' ? 'Running' : 'Stopped'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.serviceButton, { backgroundColor: wsIsRunning === 'true' ? '#800020' : 'green' }]}
                    onPress={toggleService}
                >
                    <Text style={styles.serviceButtonText}>
                        {wsIsRunning === 'true' ? 'Stop Service' : 'Start Service'}
                    </Text>
                </TouchableOpacity>
                {wsPageMessage && <Text style={styles.message}>{wsPageMessage}</Text>}
                <View style={styles.clipboardSection}>
                    <Text style={styles.sectionTitle}>Current Clipboard</Text>
                    <Text style={styles.clipboardContent} numberOfLines={3}>
                        {clipboardContent}
                    </Text>
                    <Button title="Refresh Clipboard" onPress={checkClipboardContent} />
                </View>
                <Button title="Copy Example Text" onPress={copyToClipboard} color="#007BFF" />
                <View style={styles.userInfo}>
                    <Text style={styles.userInfoText}>Logged in as: {userName}</Text>
                </View>
                <Button title="Выйти" onPress={handleLogout} color="red" />
                <View style={styles.instructions}>
                    <Text style={styles.instructionsTitle}>Instructions</Text>
                    <View style={styles.instructionItem}>
                        <Text style={styles.instructionText}>• Service automatically syncs clipboard between devices</Text>
                        <Text style={styles.instructionText}>• Keep the service running for continuous sync</Text>
                    </View>
                    <View style={styles.deviceInfoBox}>
                        <Text style={styles.deviceInfoTitle}>Device Information</Text>
                        <Text style={styles.deviceInfoText}>Name: {deviceInfo.name}</Text>
                        <Text style={styles.deviceInfoText}>ID: {deviceInfo.id}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 20, flexGrow: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    appTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingBottom: 20, color: '#2c3e50' },
    loadingBottomContainer: { alignItems: 'center', gap: 10 },
    loadingText: { fontSize: 16, color: '#555', marginBottom: 10 },
    deviceInfo: { fontSize: 14, color: '#666', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
    label: { flex: 1, fontSize: 16, fontWeight: '500', color: '#2c3e50' },
    input: { flex: 2, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: '#f8f9fa' },
    loginButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginVertical: 15 },
    disabledButton: { backgroundColor: '#ccc' },
    loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    message: { color: '#5081ab', textAlign: 'center', marginVertical: 12, fontSize: 16, padding: 10, backgroundColor: '#f0f8ff', borderRadius: 6 },
    serviceButton: { padding: 15, borderRadius: 8, alignItems: 'center', marginVertical: 10 },
    serviceButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    statusContainer: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 15 },
    statusIndicator: { fontSize: 14, fontWeight: 'bold' },
    clipboardSection: { marginVertical: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#2c3e50' },
    clipboardContent: { fontSize: 14, color: '#495057', marginBottom: 10, padding: 10, backgroundColor: 'white', borderRadius: 6, borderWidth: 1, borderColor: '#dee2e6' },
    instructions: { marginTop: 30, padding: 15, backgroundColor: '#e8f4f8', borderRadius: 8 },
    instructionsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#2c3e50' },
    instructionItem: { marginBottom: 15 },
    instructionText: { fontSize: 14, color: '#495057', marginBottom: 5 },
    deviceInfoBox: { marginTop: 15, padding: 12, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#dee2e6' },
    deviceInfoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#2c3e50' },
    deviceInfoText: { fontSize: 12, color: '#6c757d', marginBottom: 3 },
    deviceInfoContainer: { marginTop: 20, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 6 },
    deviceId: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
    userInfo: { marginVertical: 15, padding: 10, backgroundColor: '#e8f5e8', borderRadius: 6, alignItems: 'center' },
    userInfoText: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32' },
});

export default App;