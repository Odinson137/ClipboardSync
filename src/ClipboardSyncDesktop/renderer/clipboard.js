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

function updateList() {
    const list = document.getElementById('clipboard-list');
    list.innerHTML = '';
    items.forEach((text, index) => {
        const li = document.createElement('li');
        const displayText = text ? (text.length > 50 ? text.slice(0, 50) + '...' : text) : 'Пустой элемент';
        li.innerHTML = `
            <span class="entry-text">${displayText}</span>
        `;
        if (index === selectedIndex) {
            li.classList.add('selected');
        }
        li.addEventListener('click', () => selectItem(index));
        list.appendChild(li);
    });
    const selectedElement = list.children[selectedIndex];
    if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function selectItem(index) {
    selectedIndex = index;
    updateList();
}

// Обработка клавиш
document.addEventListener('keydown', (event) => {
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
        // Логика для прикрепления (например, добавить в начало и сохранить)
    } else if (event.target.classList.contains('delete')) {
        items.splice(index, 1);
        if (selectedIndex >= items.length) selectedIndex = items.length - 1;
        updateList();
        // Добавить логику сохранения изменений в historyPath или отправки на сервер
    }
});

// Инициализация
ipcRenderer.send('request-clipboard-update');