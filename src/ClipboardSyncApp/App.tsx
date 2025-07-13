import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, StatusBar, useColorScheme, PermissionsAndroid, Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Hotspot from '@react-native-tethering/hotspot';

function App() {
    const isDarkMode = useColorScheme() === 'dark';
    const [hotspotStatus, setHotspotStatus] = useState('Checking...');

    // Функция для копирования текста в буфер обмена
    const copyToClipboard = () => {
        Clipboard.setString('Hello from phone!');
        Alert.alert('Success', 'Text copied to clipboard!');
    };

    // Функция для запроса разрешений
    const requestPermissions = async () => {
        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
            ]);
            if (
                granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
            ) {
                return true;
            } else {
                Alert.alert('Error', 'Location permissions denied. Please grant them in Settings.');
                return false;
            }
        } catch (err) {
            Alert.alert('Error', 'Permission request failed: ' + err);
            return false;
        }
    };

    // Функция для проверки разрешения WRITE_SETTINGS
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
            Alert.alert('Error', 'Failed to check WRITE_SETTINGS: ' + err);
            return false;
        }
    };

    // Функция для включения точки доступа
    const enableHotspot = async () => {
        const hasLocationPermissions = await requestPermissions();
        if (!hasLocationPermissions) return;

        const hasWriteSettings = await checkWriteSettingsPermission();
        if (!hasWriteSettings) return;

        try {
            await Hotspot.default.setHotspotEnabled(true);
            setHotspotStatus('Enabled');
            Alert.alert('Success', 'Hotspot enabled!');
        } catch (err) {
            Alert.alert('Error', 'Failed to enable hotspot: ' + err);
        }
    };

    // Функция для выключения точки доступа
    const disableHotspot = async () => {
        try {
            await Hotspot.default.setHotspotEnabled(false);
            setHotspotStatus('Disabled');
            Alert.alert('Success', 'Hotspot disabled!');
        } catch (err) {
            Alert.alert('Error', 'Failed to disable hotspot: ' + err);
        }
    };

    // Функция для проверки статуса точки доступа
    const checkHotspotStatus = async () => {
        try {
            const isEnabled = await Hotspot.default.isHotspotEnabled();
            setHotspotStatus(isEnabled ? 'Enabled' : 'Disabled');
            Alert.alert('Hotspot Status', `Hotspot is ${isEnabled ? 'Enabled' : 'Disabled'}`);
        } catch (err) {
            Alert.alert('Error', 'Failed to check hotspot status: ' + err);
        }
    };

    // Проверка статуса и разрешений при запуске
    useEffect(() => {
        requestPermissions();
        checkWriteSettingsPermission();
        checkHotspotStatus();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <Text style={styles.text}>Hotspot Status: {hotspotStatus}</Text>
            <Text style={styles.text}>Press to copy text or manage hotspot</Text>
            <Button title="Copy Text" onPress={copyToClipboard} />
            <Button title="Enable Hotspot" onPress={enableHotspot} />
            <Button title="Disable Hotspot" onPress={disableHotspot} />
            <Button title="Check Hotspot Status" onPress={checkHotspotStatus} />
            <Button title="Open Write Settings" onPress={Hotspot.default.openWriteSettings} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        fontSize: 16,
        marginBottom: 20,
    },
});

export default App;