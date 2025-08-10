const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

class Storage {
    constructor() {
        this.storagePath = path.join(os.homedir(), '.config', 'ClipboardSync', 'storage.json');
        this.data = {};
        this.isLoaded = false; // Флаг, показывающий, загружены ли данные
        this.load(); // Запускаем загрузку
    }

    async load() {
        try {
            await fs.mkdir(path.dirname(this.storagePath), { recursive: true }); // Создаём директорию, если не существует
            const data = await fs.readFile(this.storagePath, 'utf-8');
            this.data = JSON.parse(data);
            console.log('Storage загружен:', this.data);
            this.isLoaded = true; // Устанавливаем флаг после успешной загрузки
        } catch (error) {
            console.warn('Ошибка загрузки storage, создаём пустой объект:', error.message);
            this.data = {};
            this.isLoaded = true; // Даже при ошибке считаем загрузку завершенной
        }
    }

    async save() {
        try {
            await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
            await fs.writeFile(this.storagePath, JSON.stringify(this.data, null, 2));
            console.log('Storage сохранён:', this.data);
        } catch (error) {
            console.error('Ошибка сохранения storage:', error);
        }
    }

    async set(key, value) {
        this.data[key] = value;
        console.log(`Storage: установлено ${key} = ${value}`);
        await this.save();
    }

    async get(key, defaultValue = null) {
        // Ждём, пока данные загрузятся, если ещё не загружены
        while (!this.isLoaded) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Пауза 100мс
        }
        const value = this.data[key] ?? defaultValue;
        console.log(`Storage: получено ${key} = ${value}`);
        return value;
    }

    async getOrCreateDeviceId() {
        // Ждём загрузку данных
        while (!this.isLoaded) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let deviceId = this.data.deviceId;
        if (!deviceId) {
            deviceId = randomUUID(); // генерируем уникальный ID
            this.data.deviceId = deviceId;
            await this.save();
            console.log('Создан и сохранён новый deviceId:', deviceId);
        } else {
            console.log('Используем существующий deviceId:', deviceId);
        }
        return deviceId;
    }
}

module.exports = new Storage(); // Экспортируем экземпляр