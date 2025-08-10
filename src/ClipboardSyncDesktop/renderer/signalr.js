const signalR = require('@microsoft/signalr');
const { clipboard, ipcRenderer } = require('electron');
const os = require('os');
const storage = require('./storage');

let connection;
let lastValue = null;
function updateStatus(message, isError = false) {
    const statusElement = document.getElementById('connection-status');
    const errorElement = document.getElementById('error');

    if (statusElement) {
        statusElement.innerText = message;
        statusElement.style.color = isError ? '#d32f2f' : '#2e7d32';
    }

    if (errorElement) {
        errorElement.innerText = message;
    }

    console.log(`[SignalR Status] ${message}`);
}

async function connectSignalR(userId, token) {
    const serverUrl = 'https://probable-dogfish-known.ngrok-free.app';
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    // Уничтожаем старое подключение, если есть
    if (connection) {
        connection.stop();
    }

    let id = "12345"
    console.log(`[SignalR Connection ID] ${id}`);

    const deviceId = await storage.getOrCreateDeviceId();
    const deviceName = os.hostname() || 'UnknownDevice';
    
    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${serverUrl}/hub/clipboardsync?deviceName=${deviceName}&applicationType=1&deviceIdentifier=${deviceId}`, {
            accessTokenFactory: () => token,
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets,
        })
        .configureLogging(signalR.LogLevel.Information)
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
                if (retryContext.previousRetryCount >= maxReconnectAttempts) {
                    updateStatus('Превышено количество попыток переподключения', true);
                    return null; // Остановить переподключение
                }

                const delay = Math.min(1000 * (2 ** retryContext.previousRetryCount), 10000); // Экспоненциальная задержка
                reconnectAttempts = retryContext.previousRetryCount + 1;
                updateStatus(`Переподключение... Попытка ${reconnectAttempts}`);
                return delay;
            }
        })
        .build();

    // События с обновлением статуса
    connection.on('DeviceConnected', (deviceId) => {
        document.getElementById('device-id').innerText = deviceId || 'Unknown';
        updateStatus('Подключено');
    });

    connection.on('DeviceDisconnected', (deviceId) => {
        updateStatus('Отключено от устройства');
    });

    connection.on('ReceiveClipboard', (id, content, type) => {
        if (type === 0 && content) {
            lastValue = content;
            clipboard.writeText(content);
            updateStatus('Получен контент из буфера обмена');
            ipcRenderer.send('update-clipboard', content);
        }
    });

    // События состояния подключения
    connection.onclose((error) => {
        if (error) {
            updateStatus('Соединение закрыто. Попытка переподключения...', true);
        } else {
            updateStatus('Отключено');
        }
    });

    connection.onreconnecting(() => {
        updateStatus('Соединение потеряно. Переподключение...', true);
    });

    connection.onreconnected(() => {
        updateStatus('Переподключено');
        reconnectAttempts = 0;
    });

    // Запуск подключения с повторными попытками
    async function start() {
        try {
            await connection.start();
            updateStatus('Подключено');
            reconnectAttempts = 0;
        } catch (err) {
            updateStatus(`Ошибка подключения. Повторная попытка...`, true);
            setTimeout(start, 3000); // Повтор каждые 3 секунды, если withAutomaticReconnect не сработал
        }
    }

    // Запускаем
    start();

    return connection;
}

async function sendDevice(userId) {
    const deviceName = 'ElectronClient-' + Math.random().toString(36).substring(7);
    try {
        await connection.invoke('RegisterDevice', userId, deviceName);
        updateStatus('Устройство зарегистрировано: ' + deviceName);
    } catch (error) {
        updateStatus('Ошибка регистрации устройства: ' + error.message, true);
    }
}

async function copyToClipboard(userId, text) {
    if (!text || text.trim() === '') {
        updateStatus('Введите текст для копирования', true);
        return;
    }

    try {
        clipboard.writeText(text);
        await connection.invoke('SendClipboard', text, 0); // Исправлено: userId вместо text
        updateStatus('Текст отправлен в облако');
        ipcRenderer.send('update-clipboard', text);
    } catch (error) {
        updateStatus('Ошибка отправки: ' + error.message, true);
    }
    lastValue = null;
}

// Обработчик для отправки через SignalR
ipcRenderer.on('save-clipboard-via-signalr', async (event, { text, userId, token }) => {
    if (lastValue === text) return;
    
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        try {
            await copyToClipboard(userId, text); // Вызов метода для отправки через SignalR
            console.log('Текст отправлен на сервер через SignalR:', text);
        } catch (error) {
            console.error('Ошибка отправки через SignalR:', error.message);
        }
    } else {
        console.warn('Нет активного подключения SignalR для отправки:', text);
    }
});

module.exports = { connectSignalR, sendDevice, copyToClipboard, updateStatus };