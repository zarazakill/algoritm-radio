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

        // Используем textContent вместо innerHTML для безопасности и производительности
        const titleSpan = document.createElement('span');
        titleSpan.className = 'track-title';
        titleSpan.textContent = title;

        const artistSpan = document.createElement('span');
        artistSpan.className = 'track-artist';
        artistSpan.textContent = artist;

        li.appendChild(titleSpan);
        li.appendChild(artistSpan);

        if (duration) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'track-time';
            timeSpan.textContent = duration;
            li.appendChild(timeSpan);
        }

        return li;
    }
    
    /**
     * Показывает уведомление
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип уведомления (success, error, warning, info)
     * @param {number} duration - Продолжительность отображения в мс
     */
    static showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconClass = 'info-circle';
        if (type === 'success') iconClass = 'check-circle';
        if (type === 'error') iconClass = 'exclamation-circle';
        if (type === 'warning') iconClass = 'exclamation-triangle';
        
        toast.innerHTML = `
            <i class="fas fa-${iconClass} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;
        
        container.appendChild(toast);
        
        // Анимация появления
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Добавляем обработчик для закрытия
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });
        }
        
        // Автоматическое скрытие
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }
    
    /**
     * Создает и возвращает SVG элемент для дефолтной обложки альбома
     * @returns {string} - SVG разметка
     */
    static getDefaultAlbumArtSVG() {
        return `
        <svg viewBox="0 0 200 200" class="default-album-art">
            <circle cx="100" cy="100" r="95" fill="#2d3748" stroke="#a29bfe" stroke-width="2" />
            <path d="M100 30 C 50 30 30 50 30 100 C 30 150 50 170 100 170 C 150 170 170 150 170 100 C 170 50 150 30 100 30 Z" fill="#1c2531" />
            <circle cx="100" cy="100" r="30" fill="#a29bfe" />
            <circle cx="100" cy="100" r="10" fill="#2d3748" />
            <g class="sound-waves">
                <circle cx="100" cy="100" r="45" fill="none" stroke="#6c5ce7" stroke-width="2" stroke-dasharray="2,6" />
                <circle cx="100" cy="100" r="60" fill="none" stroke="#6c5ce7" stroke-width="1.5" stroke-dasharray="2,8" />
                <circle cx="100" cy="100" r="75" fill="none" stroke="#6c5ce7" stroke-width="1" stroke-dasharray="1,10" />
            </g>
        </svg>`;
    }
}