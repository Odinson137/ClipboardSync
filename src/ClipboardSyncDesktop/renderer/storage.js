const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class Storage {
    constructor() {
        // Путь к файлу хранения: ~/.config/ClipboardSync/storage.json
        this.storagePath = path.join(os.homedir(), '.config', 'ClipboardSync', 'storage.json');
        this.data = {};
        this.load();
    }

    async load() {
        try {
            await fs.mkdir(path.dirname(this.storagePath), { recursive: true }); // Создаём директорию, если не существует
            const data = await fs.readFile(this.storagePath, 'utf-8');
            this.data = JSON.parse(data);
            console.log('Storage загружен:', this.data);
        } catch (error) {
            console.warn('Ошибка загрузки storage, создаём пустой объект:', error.message);
            this.data = {};
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

    set(key, value) {
        this.data[key] = value;
        console.log(`Storage: установлено ${key} = ${value}`);
        this.save();
    }

    get(key, defaultValue = null) {
        const value = this.data[key] ?? defaultValue;
        console.log(`Storage: получено ${key} = ${value}`);
        return value;
    }
}

module.exports = new Storage(); // Экспортируем экземпляр