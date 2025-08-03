const { ipcRenderer } = require('electron');

let selectedIndex = 0;
let items = [];

ipcRenderer.on('update-clipboard', (event, { current, history }) => {
    const uniqueItems = [current, ...history.map(h => h.text)].filter((item, index, self) =>
        item && self.indexOf(item) === index
    );
    items = uniqueItems;
    updateList();
});

// Инициализация списка с заранее созданными элементами
function initializeList() {
    const list = document.getElementById('clipboard-list');
    for (let i = 0; i < 100; i++) { // Предполагаем максимум 100 элементов
        const li = document.createElement('li');
        li.innerHTML = `<span class="entry-text"></span>`;
        li.addEventListener('click', () => selectItem(i));
        list.appendChild(li);
    }
    updateList(); // Первоначальное заполнение
}

function updateList() {
    const list = document.getElementById('clipboard-list');
    const itemsToShow = Math.min(items.length, list.children.length); // Ограничиваем количеством элементов

    // Обновляем только видимые элементы
    for (let i = 0; i < itemsToShow; i++) {
        const li = list.children[i];
        const displayText = items[i] ? (items[i].length > 50 ? items[i].slice(0, 50) + '...' : items[i]) : 'Пустой элемент';
        li.querySelector('.entry-text').textContent = displayText;
        li.classList.toggle('selected', i === selectedIndex);
    }

    // Скрываем лишние элементы
    for (let i = itemsToShow; i < list.children.length; i++) {
        list.children[i].style.display = 'none';
    }

    // Показываем только нужное количество
    for (let i = 0; i < itemsToShow; i++) {
        list.children[i].style.display = '';
    }

    // Мгновенный скроллинг к выделенному элементу
    const selectedElement = list.children[selectedIndex];
    if (selectedElement && selectedElement.style.display !== 'none') {
        selectedElement.scrollIntoView({ block: 'nearest' });
    }
}

function selectItem(index) {
    if (index >= 0 && index < items.length) {
        selectedIndex = index;
        updateList();
    }
}

// Обработка клавиш с оптимизацией
let lastKeyTime = 0;
const debounceDelay = 50; // Задержка в мс для обработки быстрых нажатий

document.addEventListener('keydown', (event) => {
    const now = Date.now();
    if (now - lastKeyTime < debounceDelay) return; // Игнорируем слишком частые нажатия
    lastKeyTime = now;

    if (event.key === 'ArrowDown') {
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateList();
        event.preventDefault();
    } else if (event.key === 'ArrowUp') {
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateList();
        event.preventDefault();
    } else if (event.key === 'Enter') {
        if (items[selectedIndex]) {
            ipcRenderer.send('paste-clipboard', items[selectedIndex]);
        }
    }
});

// Кнопка очистки
document.getElementById('clear-button').addEventListener('click', () => {
    console.log('clear clipboard');
    ipcRenderer.send('clear-clipboard-history');
});

// Обработка действий (прикрепить/удалить)
document.getElementById('clipboard-list').addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li) return;

    const index = Array.from(li.parentNode.children).indexOf(li);
    if (event.target.classList.contains('pin')) {
        console.log(`Прикрепить элемент: ${items[index]}`);
        // Логика для прикрепления
    } else if (event.target.classList.contains('delete')) {
        items.splice(index, 1);
        if (selectedIndex >= items.length) selectedIndex = items.length - 1;
        updateList();
        // Логика сохранения изменений
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initializeList();
    ipcRenderer.send('request-clipboard-update');
});