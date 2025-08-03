const { ipcRenderer } = require('electron');
const store = require('./storage');
const { connectSignalR, sendDevice, copyToClipboard } = require('./signalr');
const { register, login, autoLogin } = require('./api');

document.addEventListener('DOMContentLoaded', async () => {
    // Отладка кнопок
    const buttons = [
        'registerButton', 'loginButton', 'sendDeviceButton', 'copyButton'
    ];
    buttons.forEach(id => {
        const element = document.getElementById(id);
        console.log(`Кнопка ${id}: ${element ? 'найдена' : 'не найдена'}`);
    });

    // Привязка слушателей событий
    const registerButton = document.getElementById('registerButton');
    const loginButton = document.getElementById('loginButton');
    const sendDeviceButton = document.getElementById('sendDeviceButton');
    const copyButton = document.getElementById('copyButton');

    if (!registerButton || !loginButton || !sendDeviceButton || !copyButton) {
        console.error('Одна или несколько кнопок не найдены в DOM');
        return;
    }

    registerButton.addEventListener('click', () => {
        console.log('Нажата кнопка Register');
        register(
            document.getElementById('username').value,
            document.getElementById('password').value
        );
    });

    loginButton.addEventListener('click', () => {
        console.log('Нажата кнопка Login');
        login(
            document.getElementById('username').value,
            document.getElementById('password').value,
            store,
            connectSignalR
        ).then(success => {
            if (success) {
                ipcRenderer.send('minimize-to-tray');
            }
        });
    });

    sendDeviceButton.addEventListener('click', () => {
        console.log('Нажата кнопка Send Device');
        sendDevice(store.get('userId'));
    });

    copyButton.addEventListener('click', () => {
        console.log('Нажата кнопка Copy to Clipboard');
        copyToClipboard(
            store.get('userId'),
            document.getElementById('clipboard-input').value
        );
    });

    // Обработка закрытия окна буфера
    ipcRenderer.on('close-clipboard-window', () => {
        ipcRenderer.send('focus-main-window');
    });

    // Ожидание загрузки данных перед автоавторизацией
    try {
        await new Promise(resolve => {
            const checkLoaded = setInterval(() => {
                if (store.isLoaded) {
                    clearInterval(checkLoaded);
                    resolve();
                }
            }, 100); // Проверяем каждые 100мс
        });
        autoLogin(store, connectSignalR).catch(err => {
            console.error('Ошибка автоавторизации:', err);
        });
    } catch (err) {
        console.error('Ошибка ожидания загрузки store:', err);
    }
});