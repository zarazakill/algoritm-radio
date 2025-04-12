/**
 * Вспомогательные функции для работы с UI
 */
export class UIHelpers {
    /**
     * Форматирование времени в mm:ss
     * @param {number} seconds - Время в секундах
     * @returns {string} - Отформатированное время
     */
    static formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    /**
     * Склонение числительных
     * @param {number} number - Число
     * @param {string[]} words - Массив форм слова [один, два, много]
     * @returns {string} - Правильная форма слова
     */
    static pluralize(number, words) {
        return words[
            (number % 100 > 4 && number % 100 < 20) ? 2
            : [2, 0, 1, 1, 1, 2][(number % 10 < 5) ? Math.abs(number) % 10 : 5]
        ];
    }

    /**
     * Обновление иконки громкости
     * @param {HTMLElement} button - Элемент кнопки
     * @param {number} volume - Текущая громкость (0-1)
     * @param {boolean} muted - Состояние mute
     */
    static updateVolumeIcon(button, volume, muted) {
        if (!button) return;

        if (muted || volume === 0) {
            button.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (volume < 0.5) {
            button.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    /**
     * Создание элемента истории треков
     * @param {Object} item - Данные трека
     * @param {number} index - Индекс в списке
     * @returns {HTMLElement} - Созданный элемент списка
     */
    static createHistoryItem(item, index) {
        const li = document.createElement('li');
        if (index === 0) li.classList.add('new-track');

        const song = item.song || {};
        const title = song.title || 'Неизвестный трек';
        const artist = song.artist || 'Неизвестный исполнитель';
        const duration = item.duration ? this.formatTime(item.duration) : '';

        li.innerHTML = `
            <span class="track-title">${title}</span>
            <span class="track-artist">${artist}</span>
            ${duration ? `<span class="track-time">${duration}</span>` : ''}
        `;

        return li;
    }
    setStatus(text, isError = false) {
    if (this.elements.statusEl) {
        this.elements.statusEl.textContent = text;
        this.elements.statusEl.className = isError ? 'status-error' : 'status-success';
        
        if (isError && text.includes('CORS')) {
            // Показать дополнительную информацию о CORS
            console.error('CORS error:', text);
        }
    }
}
}
