/**
 * Вспомогательные функции для работы с пользовательским интерфейсом
 */
export class UIHelpers {
    /**
     * Форматирование времени в заданный формат
     * @param {number} seconds - Время в секундах
     * @param {string} [format='mm:ss'] - Формат вывода (mm:ss, hh:mm:ss)
     * @returns {string} - Отформатированное время
     */
    static formatTime(seconds, format = 'mm:ss') {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);

        switch (format) {
            case 'hh:mm:ss':
                return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
            case 'mm:ss':
            default:
                return `${hours > 0 ? `${hours}:` : ''}${mins < 10 && hours > 0 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
    }

    /**
     * Склонение числительных
     * @param {number} number - Число
     * @param {string[]} forms - Массив форм слова [один, два, много]
     * @returns {string} - Правильная форма слова
     * @example pluralize(5, ['яблоко', 'яблока', 'яблок']) → "яблок"
     */
    static pluralize(number, forms) {
        if (!forms || forms.length < 3) return '';
        
        const n = Math.abs(number);
        const n10 = n % 10;
        const n100 = n % 100;
        
        return (n100 > 4 && n100 < 20) ? forms[2] 
             : (n10 === 1) ? forms[0]
             : (n10 >= 2 && n10 <= 4) ? forms[1]
             : forms[2];
    }

    /**
     * Обновление иконки громкости с поддержкой кастомных классов
     * @param {HTMLElement} button - Элемент кнопки
     * @param {number} volume - Текущая громкость (0-1)
     * @param {boolean} muted - Состояние mute
     * @param {Object} [icons] - Кастомные классы иконок
     * @param {string} [icons.muted='fa-volume-mute']
     * @param {string} [icons.low='fa-volume-down']
     * @param {string} [icons.high='fa-volume-up']
     */
    static updateVolumeIcon(button, volume, muted, icons = {}) {
        if (!button || !button.classList) return;

        const iconClasses = {
            muted: 'fa-volume-mute',
            low: 'fa-volume-down',
            high: 'fa-volume-up',
            ...icons
        };

        // Удаляем предыдущие классы иконок
        button.querySelector('i')?.classList.remove(
            iconClasses.muted, 
            iconClasses.low, 
            iconClasses.high
        );

        let iconClass;
        if (muted || volume === 0) {
            iconClass = iconClasses.muted;
        } else if (volume < 0.5) {
            iconClass = iconClasses.low;
        } else {
            iconClass = iconClasses.high;
        }

        let icon = button.querySelector('i');
        if (!icon) {
            icon = document.createElement('i');
            icon.className = 'fas';
            button.appendChild(icon);
        }
        
        icon.classList.add(iconClass);
    }

    /**
     * Создание элемента истории треков с улучшенной безопасностью и семантикой
     * @param {Object} item - Данные трека
     * @param {number} index - Индекс в списке
     * @param {Object} [options] - Дополнительные опции
     * @param {Function} [options.onClick] - Обработчик клика
     * @returns {HTMLElement} - Созданный элемент списка
     */
static createHistoryItem(item, index, options = {}) {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    if (index === 0) li.classList.add('new-track');

    const song = item.song || {};
    const title = song.title || 'Неизвестный трек';
    const artist = song.artist || 'Неизвестный исполнитель';
    const duration = item.duration ? this.formatTime(item.duration) : '';

    // Основной контейнер
    const container = document.createElement('div');
    container.className = 'track-container';
    
    // Контейнер для текстовой информации
    const textContainer = document.createElement('div');
    textContainer.className = 'track-text';
    
    // Название трека
    const titleSpan = document.createElement('span');
    titleSpan.className = 'track-title';
    titleSpan.textContent = title;
    
    // Исполнитель
    const artistSpan = document.createElement('span');
    artistSpan.className = 'track-artist';
    artistSpan.textContent = artist;
    
    // Время (располагается справа)
    const timeSpan = document.createElement('span');
    timeSpan.className = 'track-time';
    timeSpan.textContent = duration;
    
    // Собираем структуру
    textContainer.appendChild(titleSpan);
    textContainer.appendChild(document.createElement('br')); // Перенос строки
    textContainer.appendChild(artistSpan);
    
    container.appendChild(textContainer);
    container.appendChild(timeSpan); // Время добавляем отдельно
    
    li.appendChild(container);

    if (typeof options.onClick === 'function') {
        li.addEventListener('click', options.onClick);
        li.style.cursor = 'pointer';
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
    }

    return li;
}

    /**
     * Экранирование HTML для безопасной вставки в DOM
     * @param {string} str - Строка для экранирования
     * @returns {string} - Экранированная строка
     */
    static escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Создает элемент с безопасной вставкой HTML
     * @param {string} tag - Тег элемента
     * @param {string} html - HTML содержимое
     * @param {Object} [attrs] - Атрибуты элемента
     * @returns {HTMLElement} - Созданный элемент
     */
    static createSafeElement(tag, html, attrs = {}) {
        const elem = document.createElement(tag);
        elem.innerHTML = this.escapeHtml(html);
        
        for (const [key, value] of Object.entries(attrs)) {
            elem.setAttribute(key, value);
        }
        
        return elem;
    }
}
