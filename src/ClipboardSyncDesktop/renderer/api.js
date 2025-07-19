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
        store.set('userId', userId);
        store.set('token', token);
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

module.exports = { register, login };