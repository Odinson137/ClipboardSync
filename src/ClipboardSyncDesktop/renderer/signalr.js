const signalR = require('@microsoft/signalr');
const { clipboard, ipcRenderer } = require('electron');

let connection;

function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.innerText = message;
    } else {
        console.error('Ошибка: элемент error не найден:', message);
    }
}

function connectSignalR(userId, token) {
    const serverUrl = 'https://probable-dogfish-known.ngrok-free.app';
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
        document.getElementById('connection-status').innerText = 'Подключено';
    });

    connection.on('DeviceDisconnected', (deviceId) => {
        document.getElementById('connection-status').innerText = 'Отключено';
    });

    connection.on('ReceiveClipboard', (content, type) => {
        if (type === 'text') {
            clipboard.writeText(content);
            showError('Получен контент буфера обмена: ' + content);
            ipcRenderer.send('update-clipboard', content); // Обновляем окно буфера
        }
    });

    connection.onclose(() => {
        document.getElementById('connection-status').innerText = 'Отключено';
    });

    connection.start()
        .then(() => {
            document.getElementById('connection-status').innerText = 'Подключено';
        })
        .catch((err) => showError('Ошибка подключения SignalR: ' + err.message));

    return connection;
}

async function sendDevice(userId) {
    const deviceName = 'ElectronClient-' + Math.random().toString(36).substring(7);
    try {
        await connection.invoke('RegisterDevice', userId, deviceName);
        showError('Устройство успешно отправлено');
    } catch (error) {
        showError('Ошибка отправки устройства: ' + error.message);
    }
}

async function copyToClipboard(userId, text) {
    if (!text) {
        showError('Введите текст для копирования');
        return;
    }
    try {
        clipboard.writeText(text);
        await connection.invoke('SendClipboard', userId, text, 0);
        showError('Текст скопирован в буфер обмена и отправлен на сервер');
        ipcRenderer.send('update-clipboard', text); // Обновляем окно буфера
    } catch (error) {
        showError('Ошибка копирования или отправки: ' + error.message);
    }
}

module.exports = { connectSignalR, sendDevice, copyToClipboard };