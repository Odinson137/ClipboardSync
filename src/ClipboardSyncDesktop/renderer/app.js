const signalR = require('@microsoft/signalr');
const axios = require('axios');
const Store = require('electron-store');
const { clipboard } = require('electron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const store = new Store();
let connection;

function showError(message) {
    document.getElementById('error').innerText = message;
}

async function register() {
    const serverUrl = 'http://192.168.1.5:8080'; // Define here
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const response = await axios.post(`${serverUrl}/api/user/register`, {
            userName: username,
            password: password,
        });
        console.log(response);
        showError('Registration successful! Please login.');
    } catch (error) {
        showError('Registration failed: ' + (error.response?.data || error.message));
    }
}

async function login() {
    const serverUrl = 'http://192.168.1.5:8080'; // Define here
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const response = await axios.post(`${serverUrl}/api/user/login`, {
            userName: username,
            password: password,
        });
        const { userId, token } = response.data;
        store.set('userId', userId);
        store.set('token', token);
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('user-name').innerText = username;
        connectSignalR(userId, token);
    } catch (error) {
        showError('Login failed: ' + (error.response?.data || error.message));
    }
}

function connectSignalR(userId, token) {
    const serverUrl = 'http://192.168.1.5:8080'; // Define here
    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${serverUrl}/hub/clipboardsync`, {
            accessTokenFactory: () => token,
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets,
        })
        .configureLogging(signalR.LogLevel.Information)
        .withAutomaticReconnect()
        .build();

    connection.on('DeviceConnected', (deviceId) => {
        document.getElementById('device-id').innerText = deviceId;
        document.getElementById('connection-status').innerText = 'Connected';
    });

    connection.on('DeviceDisconnected', (deviceId) => {
        document.getElementById('connection-status').innerText = 'Disconnected';
    });

    connection.on('ReceiveClipboard', (content, type) => {
        if (type === 'text') {
            clipboard.writeText(content);
            showError('Received clipboard content: ' + content);
        }
    });

    connection.onclose(() => {
        document.getElementById('connection-status').innerText = 'Disconnected';
    });

    connection.start()
        .then(() => {
            document.getElementById('connection-status').innerText = 'Connected';
            setupClipboardListener();
        })
        .catch((err) => showError('SignalR connection failed: ' + err.message));
}

async function sendDevice() {
    const userId = store.get('userId');
    const deviceName = 'ElectronClient-' + Math.random().toString(36).substring(7);
    try {
        await connection.invoke('RegisterDevice', userId, deviceName);
        showError('Device sent successfully');
    } catch (error) {
        showError('Failed to send device: ' + error.message);
    }
}

async function copyToClipboard() {
    const text = document.getElementById('clipboard-input').value;
    try {
        clipboard.writeText(text);
        const userId = store.get('userId');
        await connection.invoke('SendClipboard', userId, text, 'text');
        showError('Text copied to clipboard and sent to server');
    } catch (error) {
        showError('Failed to copy or send: ' + error.message);
    }
}

function setupClipboardListener() {
    connection.on('ReceiveClipboard', (content, type) => {
        if (type === 'text') {
            clipboard.writeText(content);
            showError('Received clipboard content: ' + content);
        }
    });
}

async function toggleWifi(enable) {
    if (process.platform === 'linux') {
        try {
            await execPromise(`nmcli radio wifi ${enable ? 'on' : 'off'}`);
            showError(`WiFi ${enable ? 'enabled' : 'disabled'} on Linux`);
        } catch (error) {
            showError('Failed to toggle WiFi on Linux: ' + error.message);
        }
    } else if (process.platform === 'win32') {
        try {
            await execPromise(`netsh wlan ${enable ? 'start' : 'stop'} hostednetwork`);
            showError(`WiFi ${enable ? 'enabled' : 'disabled'} on Windows`);
        } catch (error) {
            showError('Failed to toggle WiFi on Windows: ' + error.message);
        }
    }
}

async function getDeviceIp() {
    try {
        const interfaces = await wifi.getCurrentConnections();
        const ip = interfaces[0]?.ip || 'Unknown';
        showError('Device IP: ' + ip);
        return ip;
    } catch (error) {
        showError('Failed to get IP: ' + error.message);
        return null;
    }
}

async function toggleBluetooth(enable) {
    if (process.platform === 'linux') {
        try {
            await execPromise(`bluetoothctl power ${enable ? 'on' : 'off'}`);
            showError(`Bluetooth ${enable ? 'enabled' : 'disabled'} on Linux`);
        } catch (error) {
            showError('Failed to toggle Bluetooth on Linux: ' + error.message);
        }
    } else if (process.platform === 'win32') {
        try {
            await execPromise(`powershell -Command "Get-PnpDevice | Where-Object {$_.Class -eq 'Bluetooth'} | ${enable ? 'Enable-PnpDevice' : 'Disable-PnpDevice'} -Confirm:$false"`);
            showError(`Bluetooth ${enable ? 'enabled' : 'disabled'} on Windows`);
        } catch (error) {
            showError('Failed to toggle Bluetooth on Windows: ' + error.message);
        }
    }
}

async function scanBluetoothDevices() {
    if (process.platform === 'linux') {
        try {
            const { stdout } = await execPromise('bluetoothctl scan on && sleep 5 && bluetoothctl devices');
            showError('Bluetooth devices (Linux): ' + stdout);
        } catch (error) {
            showError('Failed to scan Bluetooth on Linux: ' + error.message);
        }
    } else if (process.platform === 'win32') {
        try {
            const { stdout } = await execPromise('powershell -Command "Get-PnpDevice | Where-Object {$_.Class -eq \'Bluetooth\'}"');
            showError('Bluetooth devices (Windows): ' + stdout);
        } catch (error) {
            showError('Failed to scan Bluetooth on Windows: ' + error.message);
        }
    }
}