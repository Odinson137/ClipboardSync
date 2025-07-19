const wifi = require('node-wifi');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

wifi.init({ iface: null });

function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.innerText = message;
    } else {
        console.error('Error element not found:', message);
    }
}

async function toggleWifi(enable) {
    try {
        await execPromise(`nmcli radio wifi ${enable ? 'on' : 'off'}`);
        showError(`WiFi ${enable ? 'enabled' : 'disabled'} on Linux`);
    } catch (error) {
        showError('Failed to toggle WiFi on Linux: ' + error.message);
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
    try {
        await execPromise(`bluetoothctl power ${enable ? 'on' : 'off'}`);
        showError(`Bluetooth ${enable ? 'enabled' : 'disabled'} on Linux`);
    } catch (error) {
        showError('Failed to toggle Bluetooth on Linux: ' + error.message);
    }
}

async function scanBluetoothDevices() {
    try {
        const { stdout } = await execPromise('bluetoothctl scan on && sleep 5 && bluetoothctl devices');
        showError('Bluetooth devices (Linux): ' + stdout);
    } catch (error) {
        showError('Failed to scan Bluetooth on Linux: ' + error.message);
    }
}

module.exports = { toggleWifi, getDeviceIp, toggleBluetooth, scanBluetoothDevices };