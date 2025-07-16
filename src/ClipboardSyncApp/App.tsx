import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    StatusBar,
    useColorScheme,
    PermissionsAndroid,
    Alert,
    ScrollView,
    TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import * as Hotspot from '@react-native-tethering/hotspot';

export default function App() {
    const isDarkMode = useColorScheme() === 'dark';
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [userId, setUserId] = useState(null);
    const [connection, setConnection] = useState(null);
    const [hotspotStatus, setHotspotStatus] = useState('Checking...');
    const [clipboardContent, setClipboardContent] = useState('');
    const [deviceIp, setDeviceIp] = useState('Unknown');
    const [connectedDevices, setConnectedDevices] = useState([]);
    const serverUrl = 'http://192.168.1.5:8080'; // Your PC's IP in the Wi-Fi network
    // For ngrok (if needed): const serverUrl = 'https://your-ngrok-id.ngrok.io';
    // For production: const serverUrl = 'https://your-domain.com';

    // Initialize SignalR and hotspot
    useEffect(() => {
        // SignalR setup
        const hubConnection = new HubConnectionBuilder()
            .withUrl(`${serverUrl}/hub/clipboardsync`, {
                skipNegotiation: true,
                transport: HttpTransportType.WebSockets, // Force WebSockets to avoid URL parsing issues
            })
            .configureLogging(LogLevel.Information)
            .withAutomaticReconnect()
            .build();

        hubConnection.on('ReceiveClipboard', (clipboardId, content, type) => {
            if (type === 'Text') {
                Clipboard.setString(content);
                setClipboardContent(content);
                Alert.alert('New Clipboard', `Received: ${content} (ID: ${clipboardId})`);
            }
        });

        hubConnection.on('ReceiveCommand', async (commandId, applicationId, type) => {
            Alert.alert('New Command', `Command: ${type} (ID: ${commandId})`);
            if (type === 'EnableHotSpot') {
                await enableHotspot();
            }
        });

        hubConnection.on('DeviceConnected', (appId, deviceName) => {
            Alert.alert('Device Connected', `Device: ${deviceName} (ID: ${appId})`);
        });

        hubConnection.on('DeviceDisconnected', (connectionId) => {
            Alert.alert('Device Disconnected', `Connection ID: ${connectionId}`);
        });

        // Start SignalR with error handling
        const startSignalR = async () => {
            try {
                await hubConnection.start();
                console.log('SignalR Connected to', `${serverUrl}/hub/clipboardsync`);
                setConnection(hubConnection);
            } catch (err) {
                console.error('SignalR Error:', err);
                Alert.alert('SignalR Error', `Failed to connect: ${err.message}`);
            }
        };

        startSignalR();

        // Load userId from AsyncStorage
        AsyncStorage.getItem('userId').then(id => {
            if (id) {
                setUserId(id);
                if (hubConnection.state === 'Disconnected') {
                    startSignalR().then(() => {
                        hubConnection.invoke('RegisterDevice', id, 'MobileDevice');
                    });
                } else {
                    hubConnection.invoke('RegisterDevice', id, 'MobileDevice');
                }
            }
        });

        // Check permissions and hotspot status
        requestPermissions();
        checkWriteSettingsPermission();
        checkHotspotStatus();

        return () => {
            hubConnection.stop();
        };
    }, []);

    // Check permissions
    const requestPermissions = async () => {
        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ]);
            if (
                granted['android.permission.ACCESS_FINE_LOCATION'] !== PermissionsAndroid.RESULTS.GRANTED ||
                granted['android.permission.ACCESS_COARSE_LOCATION'] !== PermissionsAndroid.RESULTS.GRANTED
            ) {
                Alert.alert('Error', 'Location permissions denied. Please grant them in Settings.');
                return false;
            }
            return true;
        } catch (err) {
            Alert.alert('Error', `Permission request failed: ${err}`);
            return false;
        }
    };

    // Check WRITE_SETTINGS permission
    const checkWriteSettingsPermission = async () => {
        try {
            const granted = await Hotspot.default.isWriteSettingsGranted();
            if (!granted) {
                Alert.alert(
                    'Permission Required',
                    'Please grant WRITE_SETTINGS permission.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: Hotspot.default.openWriteSettings },
                    ]
                );
                return false;
            }
            return true;
        } catch (err) {
            Alert.alert('Error', `Failed to check WRITE_SETTINGS: ${err}`);
            return false;
        }
    };

    // Check hotspot status
    const checkHotspotStatus = async () => {
        try {
            const isEnabled = await Hotspot.default.isHotspotEnabled();
            setHotspotStatus(isEnabled ? 'Enabled' : 'Disabled');
        } catch (err) {
            setHotspotStatus('Failed');
            Alert.alert('Error', `Failed to check hotspot status: ${err.message}`);
        }
    };

    // Enable hotspot
    const enableHotspot = async () => {
        const hasLocationPermissions = await requestPermissions();
        if (!hasLocationPermissions) return;

        const hasWriteSettings = await checkWriteSettingsPermission();
        if (!hasWriteSettings) return;

        try {
            await Hotspot.default.setHotspotEnabled(true);
            setHotspotStatus('Enabled');
            Alert.alert('Success', 'Hotspot enabled!');
            await updateDeviceIp();
            await updateConnectedDevices();
        } catch (err) {
            setHotspotStatus('Failed');
            Alert.alert('Error', `Failed to enable hotspot: ${err.message}`);
        }
    };

    // Disable hotspot
    const disableHotspot = async () => {
        try {
            await Hotspot.default.setHotspotEnabled(false);
            setHotspotStatus('Disabled');
            setDeviceIp('Unknown');
            setConnectedDevices([]);
            Alert.alert('Success', 'Hotspot disabled!');
        } catch (err) {
            setHotspotStatus('Failed');
            Alert.alert('Error', `Failed to disable hotspot: ${err.message}`);
        }
    };

    // Open tethering settings
    const openTetheringSettings = async () => {
        try {
            await Hotspot.default.navigateToTethering();
            Alert.alert('Success', 'Opened tethering settings.');
        } catch (err) {
            Alert.alert('Error', `Failed to open tethering settings: ${err.message}`);
        }
    };

    // Get device IP
    const updateDeviceIp = async () => {
        try {
            const ip = await Hotspot.default.getMyDeviceIp();
            setDeviceIp(ip || 'Not connected to hotspot');
        } catch (err) {
            setDeviceIp('Failed');
            Alert.alert('Error', `Failed to get device IP: ${err.message}`);
        }
    };

    // Get connected devices
    const updateConnectedDevices = async () => {
        try {
            const devices = await Hotspot.default.getConnectedDevices();
            setConnectedDevices(devices);
        } catch (err) {
            setConnectedDevices([]);
            Alert.alert('Error', `Failed to get connected devices: ${err.message}`);
        }
    };

    // Register user
    const register = async () => {
        try {
            const response = await fetch(`${serverUrl}/api/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, password }),
            });
            const result = await response.json();
            if (response.ok) {
                setUserId(result.userId);
                await AsyncStorage.setItem('userId', result.userId);
                Alert.alert('Success', `Registered with ID: ${result.userId}`);
                if (connection && connection.state === 'Connected') {
                    connection.invoke('RegisterDevice', result.userId, 'MobileDevice');
                }
            } else {
                Alert.alert('Error', result.message || 'Registration failed');
            }
        } catch (err) {
            Alert.alert('Error', `Registration failed: ${err.message}`);
        }
    };

    // Login user
    const login = async () => {
        try {
            const response = await fetch(`${serverUrl}/api/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, password }),
            });
            const result = await response.json();
            if (response.ok) {
                setUserId(result.userId);
                await AsyncStorage.setItem('userId', result.userId);
                Alert.alert('Success', 'Logged in successfully!');
                if (connection && connection.state === 'Connected') {
                    connection.invoke('RegisterDevice', result.userId, 'MobileDevice');
                }
            } else {
                Alert.alert('Error', result.message || 'Login failed');
            }
        } catch (err) {
            Alert.alert('Error', `Login failed: ${err.message}`);
        }
    };

    // Copy to clipboard
    const copyToClipboard = async () => {
        if (!userId || !connection || connection.state !== 'Connected') {
            Alert.alert('Error', 'Please log in and ensure hub connection.');
            return;
        }
        const text = 'Hello from phone!';
        Clipboard.setString(text);
        setClipboardContent(text);
        try {
            await connection.invoke('SendClipboard', userId, text, 0);
            Alert.alert('Success', 'Clipboard sent to server!');
        } catch (err) {
            Alert.alert('Error', `Failed to send clipboard: ${err.message}`);
        }
    };

    // Send command
    const sendCommand = async (commandType) => {
        if (!userId || !connection || connection.state !== 'Connected') {
            Alert.alert('Error', 'Please log in and ensure hub connection.');
            return;
        }
        try {
            const applicationId = '794798d3-4c34-4203-9a36-bc41b93f9074'; // Replace with real ID
            console.log(userId);
            console.log(applicationId);
            console.log(commandType);
            await connection.invoke('SendCommand', userId, applicationId, commandType);
            Alert.alert('Success', `Command ${commandType} sent!`);
        } catch (err) {
            Alert.alert('Error', `Failed to send command: ${err.message}`);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <Text style={styles.text}>User: {userId ? userId : 'Not logged in'}</Text>
            <Text style={styles.text}>Hotspot Status: {hotspotStatus}</Text>
            <Text style={styles.text}>Device IP: {deviceIp}</Text>
            <Text style={styles.text}>Clipboard: {clipboardContent || 'Empty'}</Text>
            <Text style={styles.text}>
                Connected Devices: {connectedDevices.length > 0 ? connectedDevices.map(d => d.ipAddress).join(', ') : 'None'}
            </Text>
            {!userId ? (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        value={userName}
                        onChangeText={setUserName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <Button title="Register" onPress={register} />
                    <Button title="Login" onPress={login} />
                </>
            ) : (
                <>
                    <Button title="Copy Text to Clipboard" onPress={copyToClipboard} />
                    <Button title="Enable Hotspot" onPress={() => sendCommand(1)} />
                    <Button title="Disable Hotspot" onPress={disableHotspot} />
                    <Button title="Check Hotspot Status" onPress={checkHotspotStatus} />
                    <Button title="Open Write Settings" onPress={Hotspot.default.openWriteSettings} />
                    <Button title="Open Tethering Settings" onPress={openTetheringSettings} />
                    <Button title="Get Device IP" onPress={updateDeviceIp} />
                    <Button title="Get Connected Devices" onPress={updateConnectedDevices} />
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        fontSize: 16,
        marginBottom: 10,
    },
    input: {
        width: '80%',
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 10,
    },
});