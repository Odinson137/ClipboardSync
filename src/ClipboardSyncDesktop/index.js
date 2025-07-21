const { app, BrowserWindow, Tray, Menu, clipboard, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');

const execPromise = util.promisify(exec);

let mainWindow = null;
let tray = null;
let clipboardWindow = null;
let lastActiveWindowId = null;

app.disableHardwareAcceleration();

function isAuthenticated() {
    let storagePath = path.join(os.homedir(), '.config', 'ClipboardSync', 'storage.json');
    try {
        if (fs.existsSync(storagePath)) {
            const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
            console.log('storage.json:', data);
            return data.userId;
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error.message);
        return false;
    }
}

async function getActiveWindowId() {
    try {
        const { stdout } = await execPromise('xdotool getactivewindow');
        return stdout.trim();
    } catch (error) {
        console.error('Ошибка получения активного окна:', error.message);
        return null;
    }
}

async function getCurrentLayout() {
    try {
        const { stdout } = await execPromise('setxkbmap -query | grep layout | awk \'{print $2}\'');
        return stdout.trim();
    } catch (error) {
        console.error('Ошибка получения текущей раскладки:', error.message);
        return 'us';
    }
}

async function setKeyboardLayout(layout) {
    try {
        await execPromise(`setxkbmap ${layout}`);
        console.log(`Установлена раскладка: ${layout}`);
    } catch (error) {
        console.error(`Ошибка установки раскладки ${layout}:`, error.message);
    }
}

async function pasteText(windowId, text) {
    if (!windowId) {
        console.error('ID окна не определён, вставка невозможна');
        return;
    }
    try {
        const escapedText = text
            .replace(/([\\"$`])/g, '\\$1')
            .replace(/\n/g, '\\n')
            .replace(/'/g, '\\\'');
        const originalLayout = await getCurrentLayout();
        console.log(`Текущая раскладка: ${originalLayout}`);
        await setKeyboardLayout('ru');
        await execPromise(`xdotool windowactivate --sync ${windowId}`);
        console.log(`Активировано окно с ID: ${windowId}`);
        try {
            await execPromise(`xdotool type --delay 50 "${escapedText}"`);
            console.log(`Вставлен текст через xdotool type: ${text}`);
        } catch (typeError) {
            console.error('Ошибка xdotool type:', typeError.message);
            await execPromise(`echo "${escapedText}" | xclip -selection clipboard`);
            console.log(`Текст скопирован в буфер через xclip: ${text}`);
            await execPromise(`xdotool key --delay 50 ctrl+v`);
            console.log(`Эмулирован Ctrl + V`);
        }
        if (originalLayout !== 'ru') {
            await setKeyboardLayout(originalLayout);
            console.log(`Восстановлена раскладка: ${originalLayout}`);
        }
    } catch (error) {
        console.error('Ошибка вставки текста:', error.message);
    }
}

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

async function createClipboardWindow() {
    if (!isAuthenticated()) {
        console.log('Пользователь не авторизован, открытие главного окна');
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

    await new Promise(resolve => setTimeout(resolve, 100));
    lastActiveWindowId = await getActiveWindowId();
    console.log('Последнее активное окно ID:', lastActiveWindowId);

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
        }
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
        updateClipboardContent();
        clipboardWindow.focus();
    });
}

function updateClipboardContent() {
    if (clipboardWindow) {
        const text = clipboard.readText();
        clipboardWindow.webContents.send('update-clipboard', text);
    }
}

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

ipcMain.on('paste-clipboard', async (event, text) => {
    console.log('Получена команда вставки:', text);
    clipboard.writeText(text);
    if (clipboardWindow) {
        clipboardWindow.close();
    }
    if (lastActiveWindowId) {
        await pasteText(lastActiveWindowId, text);
    }
});