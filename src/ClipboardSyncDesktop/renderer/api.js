const axios = require('axios');

function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.innerText = message;
    } else {
        console.error('Ошибка: элемент error не найден:', message);
    }
}

async function register(username, password) {
    const serverUrl = 'https://probable-dogfish-known.ngrok-free.app';
    if (!username || !password) {
        showError('Требуются имя пользователя и пароль');
        return false;
    }
    try {
        const response = await axios.post(`${serverUrl}/api/user/register`, {
            userName: username,
            password: password,
        });
        console.log('Ответ регистрации:', response.data);
        showError('Регистрация успешна! Пожалуйста, войдите.');
        return true;
    } catch (error) {
        showError('Ошибка регистрации: ' + (error.response?.data || error.message));
        return false;
    }
}

async function login(username, password, store, connectSignalR) {
    const serverUrl = 'https://probable-dogfish-known.ngrok-free.app';
    if (!username || !password) {
        showError('Требуются имя пользователя и пароль');
        return false;
    }
    try {
        const response = await axios.post(`${serverUrl}/api/user/login`, {
            userName: username,
            password: password,
        });
        const { userId, token } = response.data;
        await store.set('userId', userId);
        await store.set('token', token);
        await store.set('userName', username);
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('user-name').innerText = username;
        connectSignalR(userId, token);
        return true;
    } catch (error) {
        showError('Ошибка входа: ' + (error.response?.data || error.message));
        return false;
    }
}

async function autoLogin(store, connectSignalR) {
    const token = await store.get('token');
    const userName = await store.get('userName'); // Асинхронное чтение
    console.log('Token from store:', token);
    console.log('UserName from store:', userName);

    if (!token || !userName) {
        console.log('Токен или имя пользователя не найдены, требуется авторизация');
        showError(`${token} ${userName} Токен или имя пользователя не найдены, требуется авторизация`);
        return false;
    }
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').style.display = 'block';
    document.getElementById('user-name').innerText = userName;
    connectSignalR(null, token); // userId не нужен, так как токен содержит его
    return true;
}

module.exports = { register, login, autoLogin };