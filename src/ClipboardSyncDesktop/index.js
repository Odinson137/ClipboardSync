const { app, BrowserWindow, Tray, Menu, clipboard, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

let mainWindow = null;
let tray = null;
let clipboardWindow = null;

app.disableHardwareAcceleration();

// Путь к файлам хранения
const storagePath = path.join(os.homedir(), '.config', 'ClipboardSync', 'storage.json');
const historyPath = path.join(os.homedir(), '.config', 'ClipboardSync', 'clipboard_history.json');

// URL сервера
const serverUrl = 'https://probable-dogfish-known.ngrok-free.app';

// Проверка авторизации
function isAuthenticated() {
    try {
        if (fs.existsSync(storagePath)) {
            const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
            console.log('storage.json:', data);
            return data.token ? data : false;
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error.message);
        return false;
    }
}

// Чтение истории копирований
function readClipboardHistory() {
    try {
        if (fs.existsSync(historyPath)) {
            return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        }
        return [];
    } catch (error) {
        console.error('Ошибка чтения истории:', error.message);
        return [];
    }
}

// Сохранение истории копирований
function saveClipboardHistory(text) {
    try {
        let history = readClipboardHistory();
        const existingIndex = history.findIndex(item => item.text === text);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
            history.unshift({ text, timestamp: new Date().toISOString() });
        } else {
            history.unshift({ text, timestamp: new Date().toISOString() });
        }
        fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 100), null, 2));
        console.log('История сохранена:', text);
        clipboard.writeText(text);

        // Отправка на сервер через SignalR
        const userData = isAuthenticated();
        if (userData && userData.token && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('save-clipboard-via-signalr', { text, userId: userData.userId, token: userData.token });
        }
    } catch (error) {
        console.error('Ошибка сохранения истории:', error.message);
    }
}

// Очистка истории
function clearClipboardHistory() {
    try {
        fs.writeFileSync(historyPath, JSON.stringify([], null, 2));
        console.log('История очищена');
        if (clipboardWindow) {
            updateClipboardContent();
        }
    } catch (error) {
        console.error('Ошибка очистки истории:', error.message);
    }
}

// Отправка текста на сервер (через HTTP, оставляем для совместимости)
async function sendToServer(token, text) {
    try {
        const response = await axios.post(`${serverUrl}/api/clipboard`, {
            content: text,
            type: 'text'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Текст отправлен на сервер (HTTP):', response.data);
    } catch (error) {
        console.error('Ошибка отправки на сервер (HTTP):', error.message);
    }
}

// Создание главного окна
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('renderer/index.html');

    mainWindow.on('close', (event) => {
        if (mainWindow && !app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('focus', () => {
        console.log('Главное окно сфокусировано');
    });

    return mainWindow;
}

// Создание окна буфера обмена
function createClipboardWindow() {
    console.log("Create clipboard window");
    const token = isAuthenticated().token;
    if (!token) {
        console.log('Токен отсутствует, открытие главного окна');
        new Notification({
            title: 'ClipboardSync',
            body: 'Пожалуйста, авторизуйтесь для доступа к буферу обмена'
        }).show();
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
        return;
    }

    if (clipboardWindow) {
        clipboardWindow.show();
        clipboardWindow.focus();
        return;
    }

    clipboardWindow = new BrowserWindow({
        width: 400,
        height: 500,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        movable: true,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#00000000'
    });
    clipboardWindow.loadFile('renderer/clipboard.html');

    clipboardWindow.on('blur', () => {
        if (clipboardWindow) {
            console.log('Окно буфера потеряло фокус, закрывается');
            clipboardWindow.close();
        }
    });

    clipboardWindow.on('closed', () => {
        clipboardWindow = null;
    });

    clipboardWindow.webContents.on('did-finish-load', () => {
        updateClipboardContent(token);
        clipboardWindow.focus();
    });
}

// Обновление содержимого буфера обмена
function updateClipboardContent(token) {
    if (clipboardWindow) {
        const text = clipboard.readText();
        const userData = isAuthenticated();
        const history = readClipboardHistory();
        clipboardWindow.webContents.send('update-clipboard', { current: text, history });
    }
}

// Мониторинг изменений буфера обмена
function monitorClipboard() {
    let lastText = clipboard.readText();
    setInterval(() => {
        const currentText = clipboard.readText();
        if (currentText !== lastText && currentText.trim() !== '') {
            lastText = currentText;
            const userData = isAuthenticated();
            if (userData && userData.token) {
                saveClipboardHistory(currentText);
                sendToServer(userData.token, currentText);
            }
            if (clipboardWindow) {
                updateClipboardContent(userData.token);
            }
        }
    }, 500); // Проверяем каждые 500 мс
}

// Создание трея
function createTray() {
    tray = new Tray(path.join(__dirname, 'renderer', 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Показать', click: () => mainWindow.show() },
        { label: 'Выход', click: () => {
                app.isQuitting = true;
                app.quit();
            }}
    ]);
    tray.setToolTip('ClipboardSync');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });
}

// Одиночный экземпляр
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('Приложение уже запущено, выход');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        console.log('Попытка запуска второго экземпляра:', commandLine);
        if (commandLine.includes('--show-clipboard')) {
            createClipboardWindow();
        }
    });

    app.whenReady().then(() => {
        createMainWindow();
        createTray();
        monitorClipboard(); // Запускаем мониторинг буфера обмена

        if (process.argv.includes('--show-clipboard')) {
            createClipboardWindow();
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

ipcMain.on('paste-clipboard', (event, text) => {
    console.log('Получена команда вставки:', text);
    saveClipboardHistory(text);
    if (clipboardWindow) {
        clipboardWindow.close();
    }
});

ipcMain.on('clear-clipboard-history', () => {
    clearClipboardHistory();
});

ipcMain.on('request-clipboard-update', (event) => {
    if (clipboardWindow) {
        updateClipboardContent(isAuthenticated().token);
    }
});

ipcMain.on('minimize-to-tray', () => {
    if (mainWindow) {
        mainWindow.minimize();
        mainWindow.hide();
    }
});

ipcMain.on('focus-main-window', () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});